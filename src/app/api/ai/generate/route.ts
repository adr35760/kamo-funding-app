import { NextRequest, NextResponse } from 'next/server';
import {
  SYSTEM_PROMPT,
  buildPageGenerationPrompt,
  buildLongTextPrompt,
  buildLongTextExpandPrompt,
  buildLegalInfo,
  longTextLabel,
  LONG_TEXT_KEYS,
  calculateRewardTiers,
  normalizeRewardCategory,
  REWARD_CATEGORIES,
  buildCreatorLinks,
  type HearingInput,
  type CrowdfundingPage,
  type RewardCategory,
} from '@/lib/ai-prompts';
import { sendAiGenerationNotifyEmail } from '@/lib/email';
import { logAiGenerationNotify } from '@/lib/email-log';
import {
  normalizeExtended,
  parseActivityHistory,
  isTruncatedText,
  charLength,
  adjustTitleProposal,
  adjustLongText,
  normalizeLongStory,
  LONG_STORY_KEYS,
  LONG_TEXT_MIN,
  ensureClosingAsk,
  LONG_TEXT_MAX,
  type ProjectExtended,
} from '@/lib/ai-extended';

/**
 * POST /api/ai/generate
 * 
 * ヒアリング入力からクラファンページのひな形をAI生成する。
 * OpenAI APIキーが未設定の場合はモック応答を返す（開発・UIテスト用）。
 * 
 * Body: HearingInput
 * Response: { success: true, page: CrowdfundingPage, mode: "live" | "mock" }
 */
/**
 * リクエストボディ。
 *
 * 🔴 `contact`（メール・電話）は **HearingInput の外**に置く。
 *   プロンプト生成に渡る `input` と型レベルで分離しておくことで、
 *   掲載JSON・PDF・AIプロンプトへ連絡先が混入する経路を作らない。
 *   使うのは事務局宛メールだけ。口座情報と同じ設計。
 */
interface GenerateRequestBody extends HearingInput {
  contact?: { email?: string; phone?: string };
  /** 口座のマスク済み表示のみ（生値は受け取らない） */
  bankMasked?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequestBody = await request.json();
    // contact / bankMasked を除いた残りだけを生成用の入力として扱う
    const { contact, bankMasked, ...input } = body as GenerateRequestBody;

    // 入力バリデーション
    if (!input.industry || !input.goalAmount || !input.creatorName) {
      return NextResponse.json(
        { success: false, error: '必須項目が不足しています（業種・目標金額・起案者名）' },
        { status: 400 }
      );
    }

    const apiKey = process.env.KAMO_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    const apiBaseUrl = process.env.KAMO_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

    if (!apiKey) {
      // モック応答（APIキー未到着時のUIテスト用）
      const mockPage = generateMockPage(input);
      notifyOffice(mockPage, input, 'mock', contact, bankMasked);
      return NextResponse.json({
        success: true,
        page: mockPage,
        mode: 'mock',
      });
    }

    // 本物のLLM呼び出し
    const prompt = buildPageGenerationPrompt(input);
    // Gensparkプロキシの場合は利用可能なモデルを使用、直接OpenAIの場合はgpt-4o
    const model = apiBaseUrl.includes('genspark') ? 'gpt-5.1' : 'gpt-4o';

    // 1回目: ページの**構造**を作らせる（リターン13件・名称案・費用内訳・法務情報）。
    // 400文字級の本文はここでは要求しない（2〜3文の要約で足りる）。
    //
    // 🔴 なぜ2回に分けるか（2026-09-14 の実測）:
    //   1回のリクエストで構造と長文7項目を同時に要求すると、本番で**170〜277字**しか
    //   返らなかった。プロンプト3通り・入力材料の増量・maxTokens 16,000 いずれも効果なし。
    //   レスポンス全体が7,139字＝トークン上限にも余裕があり、切られてもいない。
    //   一方、同じモデルに**見出し1つだけ渡して400字以上を要求すると658字**返る。
    //   字数指示が他の制約（13件・23文字ちょうど・合計一致）に埋もれて薄まっていた。
    //   → 本文は「長文を書くこと」だけを要求する2回目の呼び出しに分離する。
    let parsed: CrowdfundingPage | null = null;
    let best: CrowdfundingPage | null = null;
    let lastError = '';

    // 構造の生成。JSONが途中で切れた場合だけ1回やり直す（本文の短さでは再生成しない）。
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await callLLM({
        apiBaseUrl, apiKey, model,
        userPrompt: prompt,
        // 構造＋リターン13件ぶん。本文要求を外したので 12,000 で足りる。
        maxTokens: 12000,
      });
      if (!result.ok) {
        lastError = result.error;
        // JSONが途中で切れた場合は**もう1回だけ引く**。即モックに落とすと本文の品質が別物になる。
        console.info(`ai/generate: structure call failed (attempt ${attempt + 1}): ${result.error}`);
        continue;
      }
      parsed = result.page;
      best = result.page;
      break;
    }
    parsed = best ?? parsed;

    if (!parsed) {
      console.error('OpenAI API error:', lastError);
      // フォールバック to mock（追加7項目もモック側で埋まる）
      const mockPage = generateMockPage(input);
      notifyOffice(mockPage, input, 'mock_fallback', contact, bankMasked);
      return NextResponse.json({ success: true, page: mockPage, mode: 'mock_fallback' });
    }

    // LLM出力の category のゆらぎを正規化し、4カテゴリが欠けたらモック側の該当リターンで補う
    let page = ensureAllRewardCategories(parsed, input);
    // 追加7項目をサーバ側で検証・補正する（文字数・費用内訳の合計＝目標金額）
    page = withNormalizedExtended(page, input);

    // 2回目: 400文字級の本文7項目だけを書かせて差し替える。
    // 失敗しても1回目の要約が残るので、**ページが出ないことはない**。
    // 🔴 採用件数は console に出す（`long texts adopted 7/7 (...)`）。
    //   本番で短い出力が報告されたとき、**1回目が短いのか2回目が失敗しているのか**を
    //   ログだけで切り分けられるようにするため。推測で原因を探さないための装備。
    page = await withLongTexts(page, input, { apiBaseUrl, apiKey, model });

    notifyOffice(page, input, 'live', contact, bankMasked);

    return NextResponse.json({
      success: true,
      page,
      mode: 'live',
    });
  } catch (err) {
    console.error('API /ai/generate error:', err);
    return NextResponse.json(
      { success: false, error: 'AI生成中にエラーが発生しました' },
      { status: 500 }
    );
  }
}


/**
 * 2回目のLLM呼び出しで400文字級の本文7項目を書かせ、1回目の要約を置き換える。
 *
 * 🔴 この関数は**失敗しても例外を投げない**。書き直せなかった場合は1回目の
 *   要約がそのまま残るので、ページが出ないことはない。長文化は「良くなる方」
 *   の処理であって、生成の成否を握らせるべきものではない。
 *
 * 採否の基準:
 *   - 1回目の要約より**長くなったものだけ**採用する（短くなるなら意味がない）
 *   - 言いかけで途切れているものは採用しない（`pickLongText` と同じ考え方）
 *   - 長すぎるものは句点で切り詰める（`adjustLongText`）
 */
async function withLongTexts(
  page: CrowdfundingPage,
  input: HearingInput,
  llm: { apiBaseUrl: string; apiKey: string; model: string }
): Promise<CrowdfundingPage> {
  const story = page.project.story as unknown as Record<string, string>;
  const ext = (page.project.extended ?? {}) as unknown as Record<string, string>;
  const summaries: Record<string, string> = {};
  for (const k of LONG_TEXT_KEYS) {
    summaries[k] = String((k in story ? story[k] : ext[k]) ?? '');
  }

  // 🔴 項目ごとに1回ずつ、並列で呼ぶ。
  //   1リクエストで6項目まとめて書かせると、モデルが回答全体で長さを配分して
  //   1項目230〜290字で止まる（2026-09-15 本番実測）。項目を分けると配分相手が
  //   無くなり、1項目に集中して約400字を書く。
  //   並列なので所要時間は「6回ぶんの合計」ではなく「いちばん遅い1回」に近い。
  const ctx = {
    title: page.project.title,
    subtitle: page.project.subtitle,
    summaries,
    costBreakdown: page.project.extended?.cost_breakdown ?? [],
  };

  const results = await Promise.all(
    LONG_TEXT_KEYS.map(async k => {
      const first = await callLongTextLLM({
        ...llm,
        userPrompt: buildLongTextPrompt(k, input, ctx),
      });
      if (!first.ok) return { key: k, result: first };

      // 🔴 短かった項目だけ、**書いた本文を渡して「長くする」**2回目を投げる。
      //   このモデルは文数の指示は守るが1回の回答の総量をだいたい一定に保つため、
      //   骨組みを増やしても1文が短くなって合計は伸びない（本番実測）。
      //   「ゼロから書く」ではなく「この文章を伸ばす」に変えると基準が元の文章になる。
      // 🔴 closing（最後に）は締めの章なので下限を下げる（2026-09-22）。
      //   他と同じ450字下限にすると「もっと長く」と伸ばし直しが走り、
      //   上限に当たって**結びのお願いが切り落とされる**。
      const minFor = k === 'closing' ? 180 : LONG_TEXT_MIN;
      const draft = adjustLongText(String(first.texts.text ?? ''));
      if (!draft || isTruncatedText(draft) || charLength(draft) >= minFor) {
        return { key: k, result: first };
      }

      const retry = await callLongTextLLM({
        ...llm,
        userPrompt: buildLongTextExpandPrompt({
          label: longTextLabel(k),
          current: draft,
          min: minFor,
          max: LONG_TEXT_MAX,
        }),
      });
      if (!retry.ok) return { key: k, result: first };

      // 伸ばし直しが短くなった／壊れた場合は1回目を採る（悪い方に倒さない）
      const expanded = adjustLongText(String(retry.texts.text ?? ''));
      if (!expanded || isTruncatedText(expanded) || charLength(expanded) <= charLength(draft)) {
        return { key: k, result: first };
      }
      return { key: k, result: retry };
    })
  );

  const nextStory: Record<string, string> = { ...story };
  const nextExt: Record<string, string> = { ...ext };
  const adopted: string[] = [];
  const failed: string[] = [];
  for (const { key: k, result } of results) {
    if (!result.ok) {
      // その項目の書き直しに失敗しただけ。1回目の要約を残して続行する。
      failed.push(`${k}(${result.error})`);
      continue;
    }
    const raw = String(result.texts.text ?? '');
    if (!raw) continue;
    const cleaned = adjustLongText(raw);
    if (!cleaned || isTruncatedText(cleaned)) continue;
    // 要約より短くなるなら置き換えない
    if (charLength(cleaned) <= charLength(summaries[k])) continue;
    // 🔴 withLongTexts は withNormalizedExtended の**後**に走るので、ここでも
    //   締めの一文を保証する（そうしないと2回目の本文が無保証のまま採用される）。
    if (k in nextStory) nextStory[k] = cleaned;
    else nextExt[k] = k === 'closing' ? ensureClosingAsk(cleaned) : cleaned;
    adopted.push(`${k}=${charLength(cleaned)}`);
  }
  console.info(`ai/generate: long texts adopted ${adopted.length}/${LONG_TEXT_KEYS.length} (${adopted.join(' ')})`);
  if (failed.length) console.info(`ai/generate: long-text calls failed: ${failed.join(' ')}`);

  return {
    ...page,
    project: {
      ...page.project,
      story: nextStory as unknown as CrowdfundingPage['project']['story'],
      extended: nextExt as unknown as CrowdfundingPage['project']['extended'],
    },
  };
}

/**
 * 本文専用の呼び出し。**1項目ぶん**を書かせ、返るJSONは `{"text": "…"}` の1キーだけ。
 * ページ全体のパースとは分けている。
 */
async function callLongTextLLM(args: {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  userPrompt: string;
}): Promise<{ ok: true; texts: Record<string, string> } | { ok: false; error: string }> {
  try {
    const response = await fetch(`${args.apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${args.apiKey}`,
      },
      body: JSON.stringify({
        model: args.model,
        messages: [
          {
            role: 'system',
            content:
              'あなたは日本語のクラウドファンディングページのライターです。指定された1項目を、指定された①〜⑪の骨組みのとおり1スロット1文で、合計11文の地の文（散文）で書き切ってください。要約・箇条書き・番号の書き写しは禁止です。',
          },
          { role: 'user', content: args.userPrompt },
        ],
        temperature: 0.7,
        // 1項目ぶん（約400〜460字・11文）。JSONは1キーだけなので構造ぶんの余裕は要らない。
        // 6項目まとめてではなくなったので上限は大きく下げられるが、
        // 推論トークンを食う可能性を見て余裕を残す。
        max_completion_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    });
    if (!response.ok) {
      return { ok: false, error: `status=${response.status} ${await response.text()}` };
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { ok: false, error: 'empty response from LLM' };
    try {
      return { ok: true, texts: JSON.parse(content) as Record<string, string> };
    } catch {
      return { ok: false, error: 'JSON parse failed (truncated response?)' };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * LLMを1回呼び出してJSONをパースする。
 * response_format=json_object でも稀に途中で切れるため、パース失敗は ok:false で返す
 * （呼び出し側でモックへフォールバックできるようにする）。
 */
async function callLLM(args: {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  userPrompt: string;
  maxTokens: number;
}): Promise<{ ok: true; page: CrowdfundingPage } | { ok: false; error: string }> {
  try {
    const response = await fetch(`${args.apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${args.apiKey}`,
      },
      body: JSON.stringify({
        model: args.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: args.userPrompt },
        ],
        temperature: 0.7,
        max_completion_tokens: args.maxTokens,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      return { ok: false, error: `status=${response.status} ${await response.text()}` };
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { ok: false, error: 'empty response from LLM' };

    // 生成が途中で切れた場合はここで弾く（壊れたJSONを画面に出さない）
    try {
      return { ok: true, page: JSON.parse(content) as CrowdfundingPage };
    } catch {
      return { ok: false, error: 'JSON parse failed (truncated response?)' };
    }
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * 事務局（info@local-creation.com）へ生成リマインドを送る。
 *
 * 🔴 **await しない**。送信の成否は生成レスポンスと切り離す（t iku/PM合意）:
 *   ユーザーは自分の生成結果が見られれば目的を達しているので、
 *   事務局通知の失敗で画面がエラーになるのは筋が違う。失敗はログのみ。
 * 🔴 **DB（ai_generations）とは独立**。マイグレーション未実行でも届く。
 */
function notifyOffice(
  page: CrowdfundingPage,
  input: HearingInput,
  mode: string,
  contact?: { email?: string; phone?: string },
  bankMasked?: string
): void {
  void sendAiGenerationNotifyEmail({
    title: page.project.title,
    subtitle: page.project.subtitle,
    goalAmount: page.project.goal_amount || input.goalAmount,
    mode,
    creatorName: input.creatorName,
    projectEntityName: entityNameOf(input),
    contactEmail: contact?.email,
    contactPhone: contact?.phone,
    creatorProfile: input.creatorProfile,
    industry: input.industry,
    businessDescription: input.businessDescription,
    titleProposals: page.project.extended?.title_proposals,
    links: buildCreatorLinks(input),
    bankMasked,
  })
    .then(r => {
      if (!r.success) console.error('AI生成リマインド送信失敗:', r.error);
      // 「届いていない」と言われたときに実測で答えられるよう記録を残す。
      // 記録の失敗も無視する（email-log 側で例外を飲んでいる）。
      return logAiGenerationNotify({
        title: page.project.title,
        success: r.success,
        error: r.error,
      });
    })
    .catch(e => console.error('AI生成リマインド処理中の例外:', e));
}

/**
 * 掲載内容に載せる事業者名。
 *
 * B-1（2026-09-13）: ヒアリングの「組織名」は「プロジェクト実施名
 * （個人・法人・団体名のいずれか）」に置き換わった。掲載内容には事業者名が
 * 必要なので、消すのではなく**実施名が引き継ぐ**。
 * 旧 organization は過去データ互換のためのフォールバックとしてのみ見る。
 */
function entityNameOf(input: HearingInput): string {
  return (input.projectEntityName || input.organization || input.creatorName || '').trim();
}

/**
 * 追加7項目をサーバ側で検証・補正して page に載せ直す。
 * LLMは文字数も金額合計も外すので、必ずここを通す。
 */
function withNormalizedExtended(page: CrowdfundingPage, input: HearingInput): CrowdfundingPage {
  const raw = (page.project as { extended?: Partial<ProjectExtended> }).extended;
  const extended = normalizeExtended(raw, {
    goalAmount: page.project.goal_amount || input.goalAmount,
    title: page.project.title,
    industry: input.industry,
    fallback: buildFallbackExtended(input, page),
  });

  // ヒアリングで活動履歴が入力されていれば、AIの推定よりそれを優先する
  // （t iku指示: 入力があれば尊重して時系列整形、空ならAIが推定で埋める）
  const declared = parseActivityHistory(input.activityHistory);
  if (declared.length > 0) extended.activity_history = declared;

  // C（2026-09-13）: 主タイトルも名称案と同じ規則（23文字ちょうど・「したい！」締め）に揃える。
  // 名称案だけ23文字で主タイトルが別ルールだと掲載時に不整合になるため両方に効かせる。
  // 🔴 片方に絞る判断が出たらこの1行を外すだけで主タイトルは元の自由形式に戻る。
  const title = adjustTitleProposal(page.project.title, {
    title: page.project.title,
    industry: input.industry,
  });

  // SNSリンクは**ヒアリング入力を正**とする（LLMに作らせず、入力のあるキーだけ載せる）。
  // 空欄のキーは buildCreatorLinks() が落とすので、掲載JSON・PDFに空行が出ない。
  const links = buildCreatorLinks(input);
  const creator = { ...page.project.creator, ...(links ? { links } : {}) };
  if (!links) delete (creator as { links?: unknown }).links;

  // story の400文字級3項目（background / vision / appeal）を
  // extended の3項目と同じ経路で仕上げる（長すぎは句点で切り、言いかけの尾は落とす）。
  // lead / schedule / use_of_funds は対象外。
  const fallbackStory = buildMockPageBase(input).project.story as unknown as Record<string, string>;
  const story = normalizeLongStory(
    page.project.story as unknown as Record<string, unknown>,
    fallbackStory
  ) as unknown as CrowdfundingPage['project']['story'];

  // 🔴 特商法は**LLMの出力を必ず捨てて**サーバ側の定型で上書きする（2026-09-22）。
  //   審査提出フォーマットの原文どおりである必要があり、モデルの言い換え
  //   （「破損・発送ミスのみ14日以内」等の要約）が混ざると差し戻しになる。
  const legalInfo = buildLegalInfo(input);

  return { ...page, project: { ...page.project, title, creator, story, extended, legal_info: legalInfo } };
}

/**
 * 追加7項目のフォールバック。
 * LLMが項目を落とした場合や、APIキーが無いモック時に使う。
 * ヒアリング入力と既存ストーリーから組み立てるので、常に読める内容になる。
 */
function buildFallbackExtended(input: HearingInput, page?: CrowdfundingPage): ProjectExtended {
  // B-1（2026-09-13）: 旧「組織名」は廃止され、プロジェクト実施名が引き継ぐ。
  //   互換のため organization も見るが、優先は projectEntityName。
  const org = entityNameOf(input);
  const goal = page?.project.goal_amount || input.goalAmount;
  const now = new Date();
  const y = now.getFullYear();
  const eventTiming = `${y}年${((now.getMonth() + 3) % 12) + 1}月下旬`;

  const overview = `${org}は${input.industry}として${input.businessDescription}${input.currentChallenge ? `現在は${input.currentChallenge}という課題に直面しています。` : ''}本プロジェクトでは${input.crowdfundingGoal || '新たな取り組みの立ち上げ'}に挑戦します。目標金額は${goal.toLocaleString()}円で、募集期間は${input.deadlineDays}日間です。いただいた支援は設備や開発、告知などプロジェクトの実行に必要な費用に充当し、使途と進捗は支援者の皆様に随時ご報告します。${input.targetAudience ? `主な想定支援者は${input.targetAudience}の皆様です。` : ''}リターンは商品・体験・サービス・スポンサーの4種類を用意し、支援いただいた方それぞれに実感のある形でお返しします。単に資金を集めるのではなく、応援してくださる方と一緒に事業をつくる「共犯者」を募るプロジェクトとして進めていきます。`;

  // きっかけの入力があればそれを起点にする（無ければ現状課題から書く）
  const trigger = String(input.projectTrigger ?? '').trim();
  const why = `${trigger ? `このプロジェクトのきっかけは、${trigger}${/[。！？]$/.test(trigger) ? '' : '。'}` : ''}このプロジェクトを始めた理由は、${input.currentChallenge || '従来のやり方だけでは事業の成長に限界が見えてきたこと'}にあります。${input.businessDescription}これまで積み上げてきたものを守るだけでは、状況は好転しないという実感がありました。価格競争や環境の変化に押されるなかで、自分たちの強みをもう一度定義し直し、届け方そのものを変える必要があると考えました。${input.crowdfundingGoal || '新しい取り組み'}は、その答えとして選んだ一手です。ただ、これを自己資金だけで進めると、規模もスピードも中途半端になってしまいます。だからこそ、応援してくださる方と一緒に立ち上げたい。クラウドファンディングを選んだのは、資金だけでなく、共感してくれる仲間と最初のお客様を同時に得られる方法だからです。`;

  const what = `本プロジェクトで創出するのは、三つの価値です。第一に、支援者の皆様にとっての価値。${input.industry}ならではのリターンを通じて、支援が具体的な体験や商品として返る仕組みをつくります。第二に、地域にとっての価値。${input.crowdfundingGoal || '新しい取り組み'}が実現すれば、${input.targetAudience || '地域の皆様'}が受け取れる選択肢が増え、雇用や取引先とのつながりにも波及します。第三に、事業としての価値。今回の挑戦で得た顧客との関係やノウハウは一過性のものではなく、プロジェクト終了後も継続する収益の土台になります。単発のキャンペーンで終わらせず、ここで生まれたつながりを起点に本業の売上を押し上げていくことが、このプロジェクトの本当のゴールです。`;

  return {
    // 🔴 ここは素の候補。normalizeExtended() が 23文字・「したい！」締めに整える。
    title_proposals: [
      `${input.industry}の未来をみんなの力でつくりたい`,
      `${input.crowdfundingGoal || '新事業'}を地域の仲間と実現したい`,
      `${org}の挑戦を一緒にカタチにしたい`,
    ],
    overview,
    why_started: why,
    what_creates: what,
    // 「最後に」（2026-09-22 追加）。LLMが落としたとき・モック時の受け皿。
    closing: `ここまで読んでいただき、ありがとうございます。\n\n${input.crowdfundingGoal || 'この挑戦'}は、一人では形になりません。\n\n応援してくださる方がいる。紹介してくださる方がいる。一緒に考えてくださる方がいる。その存在だけで、進める距離は大きく変わります。\n\n${org}は、${input.targetAudience || '関わってくださるみなさま'}に届く形をつくりたいと考えています。\n\n支援してくださる方も、挑戦する私たちも、広めてくださる方も、全員が仲間です。\n\nどうか、皆様のお力を貸してください。`,
    announcement_event: {
      format: '会場開催＋オンライン配信のハイブリッド形式（アーカイブ配信あり）',
      timing: `${eventTiming}（プロジェクト達成後）`,
      program: [
        'オープニング／プロジェクト達成のご報告（10分）',
        `${input.creatorName}によるプロジェクト実施報告と資金使途の説明（20分）`,
        '新しい取り組みのお披露目・実演（30分）',
        '支援者の皆様との質疑応答・意見交換（20分）',
        '交流会／記念撮影（30分）',
      ],
      supporter_perks: [
        '支援者限定の招待（オンライン参加も可）',
        '当日限定の先行体験・試食／試用',
        '発表会限定ノベルティのプレゼント',
        '希望者はプロジェクトページの支援者名簿に掲載',
      ],
    },
    activity_history: [
      { date: `${y - 4}年4月`, event: `${org}として${input.industry}の事業を開始。地域のお客様を中心に基盤づくりに取り組む。` },
      { date: `${y - 2}年10月`, event: '既存事業の見直しを実施。強みと課題を整理し、新しい提供方法の検討を開始。' },
      { date: `${y - 1}年6月`, event: `${input.currentChallenge || '売上の停滞'}を受け、事業構造の転換に向けた準備に着手。` },
      { date: `${y}年${now.getMonth() + 1}月`, event: `${input.crowdfundingGoal || '新たな取り組み'}の実現に向け、KAMOファンディングでのクラウドファンディングに挑戦。` },
    ],
    cost_breakdown: [
      { item: '設備・環境整備費', amount: Math.round(goal * 0.35), ratio: 35 },
      { item: '開発・制作費（商品／サービス）', amount: Math.round(goal * 0.25), ratio: 25 },
      { item: 'リターン原価・発送費', amount: Math.round(goal * 0.15), ratio: 15 },
      { item: '広報・集客費', amount: Math.round(goal * 0.15), ratio: 15 },
      { item: 'クラウドファンディング手数料・事務費', amount: Math.round(goal * 0.1), ratio: 10 },
    ],
  };
}

/**
 * リターン件数の**下限**（t iku指示 2026-09-22: 10〜13件。旧: 13件固定）。
 *
 * 🔴 13件固定をやめた理由: 件数を埋めるためにモック側の汎用リターン
 *   （「特製ステッカー」等）が事業内容と無関係に足され、選択肢として
 *   機能しない水増しになっていた。**下限だけ持たせ、上限は縛らない。**
 *
 * 🔴 **これは努力目標で、達成できなくても生成は通す**（PM合意 2026-09-14）。
 *   件数が揃わないことを理由に生成全体を失敗させるのが最悪なので、
 *   不足分はモック側から補い、それでも届かなければ届いた件数で出す。
 */
const REWARD_TARGET_COUNT = 10;

/**
 * スポンサー枠の段階名を割り当てる。
 *
 * 🔴 2026-09-22 変更（t iku提示の見本に合わせる）: 松/竹/梅 →
 *   **応援 / パートナー / メイン**（金額は 応援 < パートナー < メイン）。
 *
 * 判定の順:
 *   1. sponsor_name にすでに段階名が入っていればそれを使う
 *   2. タイトル・説明文に段階名が出ていればそれを採る
 *      （LLMは「メインスポンサー」のようにタイトルへ書くことが多い）
 *   3. どちらも無ければ**金額の高い順に メイン → パートナー → 応援**を振る
 *
 * 3件でない場合も壊さない（2件ならメイン・パートナー、4件以上なら余りは応援のままにする）。
 */
function fillSponsorNames(
  rewards: Array<{ category: RewardCategory; price?: number; title?: string; description?: string; sponsor_name?: string }>
): void {
  const sponsors = rewards.filter(r => r.category === 'sponsor');
  if (sponsors.length === 0) return;

  // 🔴 高い順に並べている（3.の「金額の高い順に振る」がこの順序に依存する）。
  const RANKS = ['メイン', 'パートナー', '応援'] as const;
  // 旧称（松竹梅）で返ってきた場合の読み替え。過去のプロンプトを覚えているモデル対策。
  const LEGACY: Record<string, (typeof RANKS)[number]> = {
    松: 'メイン', 竹: 'パートナー', 梅: '応援',
  };
  const pickFromText = (r: { title?: string; description?: string }) => {
    const text = `${r.title ?? ''} ${r.description ?? ''}`;
    // 「パートナー」は「応援」より長いので先に見る（部分一致の取り違えを避ける）
    const found = RANKS.find(rank => text.includes(rank));
    if (found) return found;
    const legacy = Object.keys(LEGACY).find(k => text.includes(k));
    return legacy ? LEGACY[legacy] : undefined;
  };

  for (const r of sponsors) {
    const current = String(r.sponsor_name ?? '').trim();
    if (RANKS.some(rank => current === rank)) continue;
    if (LEGACY[current]) { r.sponsor_name = LEGACY[current]; continue; }
    const found = pickFromText(r);
    r.sponsor_name = found ?? '';
  }

  // 埋まらなかったものを、金額の高い順に未使用の段階で埋める
  const used = new Set(sponsors.map(r => r.sponsor_name).filter(Boolean));
  const blanks = sponsors.filter(r => !r.sponsor_name).sort((a, b) => (b.price || 0) - (a.price || 0));
  const free = RANKS.filter(rank => !used.has(rank));
  blanks.forEach((r, i) => {
    r.sponsor_name = free[i] ?? '応援';
  });
}

/**
 * カテゴリ別の目標件数（t iku指示 2026-09-22）。
 * 🔴 スポンサーだけは**3件で固定**（応援・パートナー・メインの3段階が揃わないと
 *   段階の意味が消えるため）。一般カテゴリは不足を埋める際の優先順の目安に使うだけ。
 */
const REWARD_TARGET_BY_CATEGORY: Record<RewardCategory, number> = {
  product: 2,
  service: 3,
  experience: 2,
  sponsor: 3,
};

/**
 * リターンの category を正規化し、4カテゴリ（商品/体験/サービス/スポンサー）が
 * すべて1件以上存在することを保証する。さらに目標件数（13件）に届かない場合は
 * モック側のリターンから不足分を補う。
 *
 * 欠けたカテゴリはモック生成の同カテゴリのリターンで補完する（空カテゴリを作らない）。
 */
function ensureAllRewardCategories(page: CrowdfundingPage, input: HearingInput): CrowdfundingPage {
  const rewards = (page.rewards || []).map((r) => ({
    ...r,
    category: normalizeRewardCategory((r as { category?: unknown }).category, r.tier),
  }));

  const present = new Set<RewardCategory>(rewards.map((r) => r.category));
  const missing = REWARD_CATEGORIES.filter((c) => !present.has(c));
  const fallbackRewards = missing.length > 0 || rewards.length < REWARD_TARGET_COUNT
    ? generateMockPage(input).rewards
    : [];
  if (missing.length > 0) {
    for (const cat of missing) {
      const spare = fallbackRewards.find((r) => r.category === cat);
      if (spare) rewards.push(spare);
    }
  }

  // 目標件数に届かない分をモック側から補う。
  // 既に入っている title と重複するものは足さない（同じリターンを2度並べない）。
  if (rewards.length < REWARD_TARGET_COUNT) {
    const taken = new Set(rewards.map((r) => String(r.title ?? '').trim()));
    // カテゴリの配分（商品3・サービス4・体験3・スポンサー3）に近づく順で足す
    const wanted = REWARD_TARGET_BY_CATEGORY;
    const countOf = (c: RewardCategory) => rewards.filter((r) => r.category === c).length;
    // 不足の大きいカテゴリから順に埋める
    const byNeed = [...fallbackRewards].sort((a, b) => {
      const na = (wanted[a.category] ?? 0) - countOf(a.category);
      const nb = (wanted[b.category] ?? 0) - countOf(b.category);
      return nb - na;
    });
    for (const spare of byNeed) {
      if (rewards.length >= REWARD_TARGET_COUNT) break;
      const key = String(spare.title ?? '').trim();
      if (taken.has(key)) continue;
      taken.add(key);
      rewards.push(spare);
    }
    if (rewards.length < REWARD_TARGET_COUNT) {
      // 補ってもなお届かない場合は**そのまま出す**。件数不足で失敗させない。
      console.info(`ai/generate: rewards ${rewards.length}/${REWARD_TARGET_COUNT} (件数不足のまま生成を通します)`);
    }
  }

  // 🔴 スポンサー枠の段階名（松/竹/梅）をサーバ側で必ず埋める。
  //   LLMは段階名をタイトルに書いて sponsor_name を空で返すことがある（本番実測 2026-09-18）。
  //   画面とPDFは sponsor_name を見て段階を出すので、空のままだと段階が消える。
  fillSponsorNames(rewards);

  // 表示順は REWARD_CATEGORIES の順（商品 → サービス → 体験 → スポンサー）。同カテゴリ内は金額の昇順
  const order = new Map<RewardCategory, number>(REWARD_CATEGORIES.map((c, i) => [c, i]));
  rewards.sort((a, b) => {
    const d = (order.get(a.category) ?? 99) - (order.get(b.category) ?? 99);
    return d !== 0 ? d : (a.price || 0) - (b.price || 0);
  });

  return { ...page, rewards };
}

/**
 * モックページ生成（APIキー未到着時のUIテスト用）
 * 実際のKAMOファンディングページに近い品質で出力する。
 */
function generateMockPage(input: HearingInput): CrowdfundingPage {
  const page = buildMockPageBase(input);
  // モック時も追加7項目を必ず埋める（文字数・費用内訳の合計もここで担保される）
  return withNormalizedExtended(page, input);
}

function buildMockPageBase(input: HearingInput): CrowdfundingPage {
  const tiers = calculateRewardTiers(input.goalAmount);
  const deliveryDate = new Date(Date.now() + input.deadlineDays * 86400000 + 14 * 86400000);
  const deliveryStr = deliveryDate.toISOString().split('T')[0];
  const startDate = new Date();
  const startStr = `${startDate.getMonth() + 1}月${startDate.getDate()}日`;
  const endDate = new Date(Date.now() + input.deadlineDays * 86400000);
  const endStr = `${endDate.getMonth() + 1}月${endDate.getDate()}日`;

  // 業種別テンプレート
  const templates = getIndustryTemplate(input.industry);
  const titleKeyword = input.crowdfundingGoal
    ? input.crowdfundingGoal.replace(/したい|したい！|を立ち上げたい.*/, '').slice(0, 20)
    : templates.titleKeyword;

  return {
    project: {
      title: `「${titleKeyword}」を${templates.titleAction}たい！`,
      subtitle: `${input.industry}の${templates.subtitleSuffix} — ${input.targetAudience || '地域の皆様'}に新しい価値を`,
      main_image_url: '',
      goal_amount: input.goalAmount,
      project_type: '実行確約型',
      story: {
        lead: `${startStr}、${entityNameOf(input)}の${input.creatorName}です。${input.businessDescription}${input.currentChallenge ? `\n\n今、${input.currentChallenge}という課題に直面しています。この課題を乗り越えるため、皆様のお力添えを借りたく、このプロジェクトを立ち上げました。` : ''}`,
        background: `${input.businessDescription}\n\nしかし、${input.currentChallenge || '市場環境の変化により、従来のやり方だけでは成長の限界を感じています'}。このままでは、${templates.backgroundRisk}という危機感があります。\n\nだからこそ、今、大胆な一手を打つ必要があります。${input.crowdfundingGoal || templates.defaultGoal} — これが実現できれば、${templates.backgroundHope}ことができます。`,
        vision: `${input.crowdfundingGoal || templates.defaultGoal}。\n\nこれが実現した未来を想像してください。\n${templates.visionDescription}\n\n${input.targetAudience || '地域の皆様'}にとって、${templates.visionBenefit}。これが私たちの描く未来です。`,
        use_of_funds: `皆様からいただいた支援金は、以下の用途で活用いたします。\n\n■ 内訳（目安）\n・${templates.fundUse1}: 約${Math.round(input.goalAmount * 0.4).toLocaleString()}円（40%）\n・${templates.fundUse2}: 約${Math.round(input.goalAmount * 0.3).toLocaleString()}円（30%）\n・${templates.fundUse3}: 約${Math.round(input.goalAmount * 0.2).toLocaleString()}円（20%）\n・クラファン手数料・事務費: 約${Math.round(input.goalAmount * 0.1).toLocaleString()}円（10%）\n\nすべての資金を、${input.crowdfundingGoal || 'プロジェクトの実現'}のために真摯に活用いたします。`,
        schedule: `■ 募集期間: ${startStr}〜${endStr}（${input.deadlineDays}日間）\n■ 達成後のスケジュール:\n・${endDate.getMonth() + 1}月下旬: 実行プロジェクト開始\n・${deliveryDate.getMonth() + 1}月: リターン製作・発送開始\n・${deliveryStr}頃: 全リターンのお届け完了予定\n\n※進捗は随时報告いたします。`,
        appeal: `最後まで読んでいただき、ありがとうございます。\n\n${input.supporterMessage?.trim() ? `${input.supporterMessage.trim()}${/[。！？]$/.test(input.supporterMessage.trim()) ? '' : '。'}\n\n` : ''}${input.creatorName}として、本業を本気で立て直そうとしています。${input.currentChallenge ? `${input.currentChallenge} — この壁を、皆様と一緒に乗り越えたい。` : 'この壁を、皆様と一緒に乗り越えたい。'}\n\n「共犯者」を募集します。このプロジェクトに共感してくださる方、一緒に${templates.appealGoal}を実現しませんか？\n\nあなたの支援が、私たちの挑戦を現実に変えます。ひとりひとりの支援が、大きなうねりになります。\n\nどうか、ご支援よろしくお願いいたします。`,
      },
      creator: {
        name: input.creatorName,
        avatar: '',
        // B-3: プロフィール入力があればそれを起点にする（捏造しない）
        bio: input.creatorProfile?.trim()
          ? input.creatorProfile.trim()
          : `${input.industry}で事業を展開する${entityNameOf(input)}。${input.businessDescription.split('。')[0]}。本業の課題をクラウドファンディングの力で突破すべく、挑戦中。`,
        organization: input.projectEntityName || input.organization || '',
        ...(buildCreatorLinks(input) ? { links: buildCreatorLinks(input) } : {}),
      },
      // 🔴 特商法は**サーバ側で固定**する（2026-09-22）。審査提出フォーマットの
      //   原文どおりでなければ差し戻されるため、LLM にもここにも書かせない。
      legal_info: buildLegalInfo(input),
    },
    rewards: [
      {
        category: 'product',
        tier: 'entry',
        title: `【応援コース】${templates.entryRewardName}`,
        description: `${input.creatorName}の挑戦を応援するコースです。\n\n${templates.entryRewardDesc}\n\n※お礼の手紙にお届け先情報は不要です。`,
        image_url: '',
        price: tiers.entry,
        shipping_included: true,
        estimated_delivery: deliveryStr,
        stock_limit: null,
        is_designated: false,
        designated_name: '',
      },
      {
        category: 'product',
        tier: 'standard',
        title: `【お試しコース】${templates.standardRewardName}`,
        description: `${templates.standardRewardDesc}\n\n${input.industry}の良さを存分に味わっていただけるセットです。ご自身はもちろん、ご家族や友人へのギフトとしてもお使いいただけます。`,
        image_url: '',
        price: tiers.standard,
        shipping_included: true,
        estimated_delivery: deliveryStr,
        stock_limit: 100,
        is_designated: false,
        designated_name: '',
      },
      {
        category: 'product',
        tier: 'premium',
        title: `【特別セットコース】${templates.premiumRewardName}`,
        description: `通常では販売していない限定の特別セットです。\n\n${templates.premiumRewardDesc}\n\nこのコースは本プロジェクト限定の特別仕様。数量限定でのご提供となります。`,
        image_url: '',
        price: tiers.premium,
        shipping_included: true,
        estimated_delivery: deliveryStr,
        stock_limit: 50,
        is_designated: false,
        designated_name: '',
      },
      {
        category: 'experience',
        tier: 'vip',
        title: `【VIP体験コース】${templates.vipRewardName}`,
        description: `${input.creatorName}と直接つながれるVIPコース。\n\n${templates.vipRewardDesc}\n\n※日時はご相談の上決定いたします。遠方の方はオンラインでの対応も可能です。`,
        image_url: '',
        price: tiers.vip,
        shipping_included: true,
        estimated_delivery: deliveryStr,
        stock_limit: 10,
        is_designated: false,
        designated_name: '',
      },
      {
        category: 'service',
        tier: 'standard',
        title: `【サービス利用コース】${templates.serviceRewardName}`,
        description: `${templates.serviceRewardDesc}\n\n※ご利用期間・日程はご相談の上で決定いたします。`,
        image_url: '',
        price: Math.round((tiers.standard + tiers.premium) / 2 / 100) * 100,
        shipping_included: false,
        estimated_delivery: deliveryStr,
        stock_limit: 30,
        is_designated: false,
        designated_name: '',
      },
      {
        category: 'sponsor',
        tier: 'sponsor',
        title: `メインスポンサー`,
        description: `・プロジェクトページへのロゴ掲載（最上位・最大サイズ）\n・発表会でのメインスポンサーとしてご紹介\n・発表会内での5分PRタイム\n・交流会ご招待3名様\n・${input.creatorName}による戦略相談90分\n・${templates.sponsorRewardDesc}\n\n本プロジェクトを最も強くご支援いただける企業・団体様向けです。特典はご相談のうえカスタマイズ可能です。`,
        image_url: '',
        price: tiers.sponsor,
        shipping_included: true,
        estimated_delivery: deliveryStr,
        stock_limit: 5,
        is_designated: false,
        designated_name: '',
        sponsor_name: 'メイン',
      },
      // ここから下は**目標件数に届かなかったときの補完用**（2026-09-14 / 件数は 2026-09-18 に13件へ変更）。
      // LLMが目標件数に届かなかったときに ensureAllRewardCategories() が不足カテゴリから
      // 順に採用する。既存6件と内容が重複しないよう、切り口を変えてある。
      {
        category: 'product',
        tier: 'entry',
        title: `【ミニ応援コース】ステッカー＆お礼メッセージ`,
        description: `気軽に応援いただけるコースです。\n\nプロジェクトオリジナルのステッカーと、${input.creatorName}からのお礼メッセージカードをお送りします。\n\n※少額から参加いただける入口のコースです。`,
        image_url: '',
        price: Math.max(1000, Math.round(tiers.entry * 0.6 / 100) * 100),
        shipping_included: true,
        estimated_delivery: deliveryStr,
        stock_limit: null,
        is_designated: false,
        designated_name: '',
      },
      {
        category: 'product',
        tier: 'standard',
        title: `【定番セットコース】${templates.standardRewardName}（通常サイズ）`,
        description: `${templates.standardRewardDesc}\n\nお試しサイズではなく、普段使いできる通常サイズでお届けします。リピートを前提に内容量を増やした構成です。`,
        image_url: '',
        price: Math.round(tiers.standard * 1.3 / 100) * 100,
        shipping_included: true,
        estimated_delivery: deliveryStr,
        stock_limit: 80,
        is_designated: false,
        designated_name: '',
      },
      {
        category: 'product',
        tier: 'premium',
        title: `【ギフトコース】${templates.premiumRewardName}（ラッピング付き）`,
        description: `${templates.premiumRewardDesc}\n\n贈り物としてそのままお渡しいただけるよう、専用の箱とラッピングでお届けします。メッセージカードの同封も承ります。`,
        image_url: '',
        price: Math.round(tiers.premium * 1.2 / 100) * 100,
        shipping_included: true,
        estimated_delivery: deliveryStr,
        stock_limit: 30,
        is_designated: false,
        designated_name: '',
      },
      {
        category: 'experience',
        tier: 'standard',
        title: `【オンライン見学コース】${input.creatorName}が現場を案内`,
        description: `現地に行かなくても参加いただけるオンライン見学です。\n\n${templates.vipRewardDesc}\n\n※後日アーカイブもご視聴いただけます。遠方の方におすすめです。`,
        image_url: '',
        price: Math.round(tiers.standard * 1.6 / 100) * 100,
        shipping_included: false,
        estimated_delivery: deliveryStr,
        stock_limit: 40,
        is_designated: false,
        designated_name: '',
      },
      {
        category: 'experience',
        tier: 'premium',
        title: `【体験コース】${templates.vipRewardName}（1名様）`,
        description: `${templates.vipRewardDesc}\n\nVIPコースより短い時間で、要点を体験いただける構成です。おひとりでのご参加を歓迎します。`,
        image_url: '',
        price: Math.round(tiers.premium * 1.1 / 100) * 100,
        shipping_included: false,
        estimated_delivery: deliveryStr,
        stock_limit: 20,
        is_designated: false,
        designated_name: '',
      },
      {
        category: 'experience',
        tier: 'premium',
        title: `【支援者交流会コース】発表会へご招待`,
        description: `プロジェクト達成後に開催する支援者向け発表会にご招待します。\n\n${input.creatorName}から進捗と今後の計画を直接ご報告し、支援者同士で交流いただける場です。\n\n※開催形式・日程は決定後にご案内します。`,
        image_url: '',
        price: Math.round(tiers.premium * 0.8 / 100) * 100,
        shipping_included: false,
        estimated_delivery: deliveryStr,
        stock_limit: 25,
        is_designated: false,
        designated_name: '',
      },
      {
        category: 'service',
        tier: 'entry',
        title: `【オンライン相談コース】30分の個別相談`,
        description: `${input.industry}に関するご相談を、オンラインで30分お受けします。\n\n${templates.serviceRewardDesc}\n\n※日程はご相談の上で決定いたします。`,
        image_url: '',
        price: Math.round(tiers.entry * 1.5 / 100) * 100,
        shipping_included: false,
        estimated_delivery: deliveryStr,
        stock_limit: 20,
        is_designated: false,
        designated_name: '',
      },
      {
        category: 'service',
        tier: 'premium',
        title: `【優先サポートコース】${templates.serviceRewardName}（1年間）`,
        description: `${templates.serviceRewardDesc}\n\n1年間にわたって優先的にご対応します。困ったときにすぐ相談できる窓口としてお使いください。`,
        image_url: '',
        price: Math.round(tiers.premium * 1.4 / 100) * 100,
        shipping_included: false,
        estimated_delivery: deliveryStr,
        stock_limit: 15,
        is_designated: false,
        designated_name: '',
      },
      {
        category: 'sponsor',
        tier: 'sponsor',
        title: `パートナースポンサー`,
        description: `・プロジェクトページへのロゴ掲載\n・発表会での企業ご紹介\n・発表会内での3分PRタイム\n・交流会ご招待2名様\n・個別相談60分\n\n事業のPRと合わせてご支援いただける企業・団体様向けです。`,
        image_url: '',
        price: Math.max(100000, Math.round(tiers.sponsor * 0.6 / 100) * 100), // パートナー: 10万円から
        shipping_included: true,
        estimated_delivery: deliveryStr,
        stock_limit: 10,
        is_designated: false,
        designated_name: '',
        sponsor_name: 'パートナー',
      },
      {
        // スポンサーは 応援 / パートナー / メイン の3段階（t iku指示 2026-09-22。旧: 松竹梅）。
        // LLMが3件揃えられなかったときの補完用。
        category: 'sponsor',
        tier: 'sponsor',
        title: `応援スポンサー`,
        description: `・プロジェクトページへの企業名掲載\n・発表会での企業名ご紹介\n・交流会ご招待1名様\n\nまずは応援の気持ちを形にしたい企業・団体様向けの、入口の段階です。`,
        image_url: '',
        price: 50000, // 応援スポンサー: 5万円から（t iku指示 2026-09-22。旧: 10万円）
        shipping_included: true,
        estimated_delivery: deliveryStr,
        stock_limit: 20,
        is_designated: false,
        designated_name: '',
        sponsor_name: '応援',
      },
    ],
  };
}

/**
 * 業種別テンプレート
 */
function getIndustryTemplate(industry: string) {
  const templates: Record<string, {
    titleKeyword: string;
    titleAction: string;
    subtitleSuffix: string;
    backgroundRisk: string;
    backgroundHope: string;
    visionDescription: string;
    visionBenefit: string;
    defaultGoal: string;
    fundUse1: string;
    fundUse2: string;
    fundUse3: string;
    appealGoal: string;
    entryRewardName: string;
    entryRewardDesc: string;
    standardRewardName: string;
    standardRewardDesc: string;
    premiumRewardName: string;
    premiumRewardDesc: string;
    vipRewardName: string;
    vipRewardDesc: string;
    serviceRewardName: string;
    serviceRewardDesc: string;
    sponsorRewardDesc: string;
  }> = {
    飲食: {
      titleKeyword: '新しい味の挑戦',
      titleAction: '進化さ',
      subtitleSuffix: '挑戦',
      backgroundRisk: '地域の食文化が失われる',
      backgroundHope: '地域の皆様に安心・安全な食を届け続け',
      visionDescription: '地域の食材を活かした新しいメニューが生まれ、食べ物を通じた人の輪が広がる。観光客にも地元の方にも愛される店になる。',
      visionBenefit: '美味しい食と温かいもてなしに出会える場所が残る',
      defaultGoal: '新しいデリバリーサービスとメニュー開発',
      fundUse1: '設備投資（デリバリー体制・調理器具）',
      fundUse2: '新メニュー開発・食材仕入れ',
      fundUse3: '販路拡大・集客活動',
      appealGoal: '地域の食を未来へ残す',
      entryRewardName: 'お礼のお手紙+オリジナルレシピカード',
      entryRewardDesc: '心を込めたお礼のお手紙と、当家自慢のオリジナルレシピカード（1品）をお送りします。',
      standardRewardName: 'お試しセット',
      standardRewardDesc: '当家の人気メニュー3品を特別セットにしてお届けします。冷凍便にて発送いたします。',
      premiumRewardName: '限定フルコース',
      premiumRewardDesc: '通常メニューにはない、季節の食材を活かした限定フルコース（2名様分）。店舗でのご利用またはお届け便を選択いただけます。',
      vipRewardName: 'シェフとつくるプライベート料理体験',
      vipRewardDesc: '当家の厨房で、${creatorName}と一緒に1品を調理する特別体験（2時間・2名様）。その後、完成した料理とお酒で乾杯！',
      serviceRewardName: '店内お食事ご利用券',
      serviceRewardDesc: '当店でのお食事にご利用いただけるご利用券です。メニューは店内の全品からお選びいただけます。',
      sponsorRewardDesc: '企業様のロゴを掲載した限定コラボメニューの開発・提供、および店舗での企業展示を実施します。',
    },
    小売: {
      titleKeyword: '新しいショッピング体験',
      titleAction: '進化さ',
      subtitleSuffix: '挑戦',
      backgroundRisk: '地域の商店街が衰退する',
      backgroundHope: '地域の皆様に便利で楽しい買い物体験を提供し',
      visionDescription: 'オンラインとオフラインを融合した新しい店舗形態が生まれ、地域の商店街に活気が戻る。',
      visionBenefit: 'いつでも便利に、そして楽しく買い物ができる場所が残る',
      defaultGoal: 'オンラインショップの立ち上げと店舗リニューアル',
      fundUse1: 'オンラインショップ構築・システム導入',
      fundUse2: '店舗リニューアル・ディスプレイ刷新',
      fundUse3: '新商品開発・仕入れ',
      appealGoal: '地域の商店街に活気を取り戻す',
      entryRewardName: 'お礼のお手紙+オリジナルエコバッグ',
      entryRewardDesc: '心を込めたお礼のお手紙と、当店オリジナルデザインのエコバッグをお送りします。',
      standardRewardName: 'お試しショッピングセット',
      standardRewardDesc: '当店の人気商品3点を特別セットにしてお届けします。ギフト包装も可能です。',
      premiumRewardName: '限定コレクションセット',
      premiumRewardDesc: '本プロジェクト限定のオリジナル商品セット。通常では販売しない特別アイテムが含まれます。',
      vipRewardName: 'プライベートショッピング体験',
      vipRewardDesc: '営業時間外の貸切ショッピング体験（2名様・2時間）。スタッフがコーディネートをサポートし、その後ティータイム付き。',
      serviceRewardName: 'お買い物ご利用券',
      serviceRewardDesc: '当店でのお買い物にご利用いただけるご利用券です。店頭・オンラインどちらでもお使いいただけます。',
      sponsorRewardDesc: '店舗での企業ロゴ展示、コラボレーション商品の開発・販売、および店舗イベントでのPRを実施します。',
    },
    サービス: {
      titleKeyword: 'サービスの新展開',
      titleAction: '広げ',
      subtitleSuffix: '挑戦',
      backgroundRisk: '顧客のニーズに応えられなくなる',
      backgroundHope: 'より多くの方に質の高いサービスを提供し',
      visionDescription: '新しいサービスラインが確立され、より多くの顧客に価値を届けられる体制が整う。',
      visionBenefit: 'いつでも、どこでも、質の高いサービスを受けられる',
      defaultGoal: '新サービスの立ち上げと提供体制の拡充',
      fundUse1: '新サービス開発・システム構築',
      fundUse2: 'スタッフ研修・体制強化',
      fundUse3: '集客・マーケティング活動',
      appealGoal: 'サービスの質を落とさず、より多くの人へ',
      entryRewardName: 'お礼のお手紙+オリジナルグッズ',
      entryRewardDesc: '心を込めたお礼のお手紙と、当店オリジナルのロゴグッズ（ステッカーやタオル等）をお送りします。',
      standardRewardName: 'お試しサービス券',
      standardRewardDesc: '当店の基本サービスを1回無料でご利用いただける券をお届けします。ご家族・ご友人へのギフトとしてもお使いいただけます。',
      premiumRewardName: '限定プレミアムサービス',
      premiumRewardDesc: '通常メニューにはない特別サービス。プロジェクト限定の特別コースで、通常の1.5倍の時間をかけた至極の体験をご提供します。',
      vipRewardName: 'プライベートコンサルティング',
      vipRewardDesc: '${creatorName}による1対1のプライベートコンサルティング（2時間）。あなたの課題に合わせた個別アドバイスを実施します。',
      serviceRewardName: 'サービス回数券',
      serviceRewardDesc: '当店の基本サービスを複数回ご利用いただける回数券です。ご家族・ご友人との併用も可能です。',
      sponsorRewardDesc: '企業向けの特別サービスプランの提供、共同セミナーの開催、およびプロジェクトページでの企業PRを実施します。',
    },
    製造: {
      titleKeyword: 'ものづくりの新境地',
      titleAction: '開拓',
      subtitleSuffix: '挑戦',
      backgroundRisk: '技術の継承が途絶える',
      backgroundHope: '日本のものづくりの価質を世界に発信し',
      visionDescription: '新しい製造ラインが稼働し、これまで作れなかった製品が生まれる。技術の継承も確実なものになる。',
      visionBenefit: '高品質な日本製の製品が手に入り続ける',
      defaultGoal: '新製品開発と製造ラインの導入',
      fundUse1: '製造設備・機械の導入',
      fundUse2: '新製品の試作・開発',
      fundUse3: '販路開拓・展示会出展',
      appealGoal: 'ものづくりの魂を未来へ',
      entryRewardName: 'お礼のお手紙+製造工程見学動画',
      entryRewardDesc: '心を込めたお礼のお手紙と、工場の製造工程を見学できる限定動画の視聴リンクをお送りします。',
      standardRewardName: '新製品お試しセット',
      standardRewardDesc: '今回開発した新製品のミニサイズ版をお届けします。市場に出る前に手に入れる特別な体験です。',
      premiumRewardName: '限定記念モデル',
      premiumRewardDesc: 'プロジェクト支援者限定の記念モデル。シリアルナンバー入りで、世界に〇個だけの特別仕様です。',
      vipRewardName: '工場見学+ものづくり体験',
      vipRewardDesc: '当社の工場を見学いただき、職人と一緒に1品を作る体験（半日・2名様）。お弁当付き。',
      serviceRewardName: '製品メンテナンスサポート',
      serviceRewardDesc: 'お手持ちの製品の点検・調整・修理を承るサポートサービスです。職人が直接対応いたします。',
      sponsorRewardDesc: '企業様との共同開発プロジェクトの優先交渉権、製造ラインのレンタル優先権、および製品への企業ロゴ刻印を実施します。',
    },
    IT: {
      titleKeyword: 'テクノロジーで新しい未来を',
      titleAction: '切り拓',
      subtitleSuffix: '挑戦',
      backgroundRisk: 'デジタル化の波に乗り遅れる',
      backgroundHope: 'テクノロジーの力で地域の課題を解決し',
      visionDescription: '新しいプロダクトがリリースされ、これまでなかったデジタルサービスが地域を便利にする。',
      visionBenefit: 'テクノロジーの力で日々の生活がもっと便利になる',
      defaultGoal: '新プロダクトの開発とリリース',
      fundUse1: 'プロダクト開発・エンジニアリング',
      fundUse2: 'インフラ・サーバー構築',
      fundUse3: 'ユーザーテスト・マーケティング',
      appealGoal: 'テクノロジーで地域を元気に',
      entryRewardName: 'お礼のお手紙+ベータ版アクセス権',
      entryRewardDesc: '心を込めたお礼のお手紙と、新プロダクトのベータ版への先行アクセス権をお送りします。',
      standardRewardName: '1年間プレミアムプラン',
      standardRewardDesc: '新プロダクトのプレミアムプランを1年間無料でご利用いただけます。一般公開前の先行利用です。',
      premiumRewardName: '限定ライフタイムライセンス',
      premiumRewardDesc: 'プロジェクト支援者限定のライフタイムライセンス（永久利用権）。将来の機能拡張もすべて含まれます。',
      vipRewardName: '開発者と1対1のワークショップ',
      vipRewardDesc: '${creatorName}と1対1で、プロダクトの使い方やカスタマイズ方法を深く学ぶワークショップ（2時間・オンライン）。',
      serviceRewardName: '導入サポート＋優先サポート枠',
      serviceRewardDesc: 'プロダクトの初期設定・導入をお手伝いし、以後の優先サポート枠をご提供します。',
      sponsorRewardDesc: 'プロダクトへの企業ロゴ掲載、APIアクセスの優先提供、および共同開発パートナーとしての優先交渉権を提供します。',
    },
  };

  return templates[industry] || templates['サービス'];
}

/**
 * 関数の実行時間上限（秒）。
 *
 * 2026-09-14 の増量（400文字級7項目＋リターン13件、maxTokens 16,000）で
 * 生成1回が実測 64〜82 秒かかるため明示する。既定値では足りない。
 *
 * 🔴 300 を指定できる根拠（推測ではなく実測）:
 *   増量前の本番 /api/ai/generate が **61秒・68秒** で完走している。
 *   Hobby プランの上限は60秒なので、60秒を超えて完走している事実から
 *   このプロジェクトは Pro（上限300秒）である。Hobby なら既にタイムアウトしている。
 *
 * 🔴 実測が 82 秒まで出ているので、60 では足りない。ここを下げないこと。
 */
export const maxDuration = 300;
