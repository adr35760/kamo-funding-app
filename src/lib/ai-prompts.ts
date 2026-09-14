import type { ProjectExtended } from './ai-extended';

/**
 * AIクラファンページ作成ツール — プロンプト設計
 * 
 * KAMOファンディング専用のプロンプトテンプレート。
 * 「本業停滞層向け」に特化し、短期キャンペーン型クラファンを前提とする。
 */

export const SYSTEM_PROMPT = `あなたはKAMOファンディングのクラウドファンディング支援アシスタントです。
対象は「本業の売上が停滞している事業者」で、短期キャンペーン型のクラウドファンディングを通じて本業の売上向上を目指しています。
以下の原則に従ってください：
1. 感情的すぎず、具体的で行動を促すトーン
2. 本業の課題とクラファンの関連性を明確に
3. リターンは「支援者が得をする」設計而非「おまけ」
4. KAMOファンディングの掲載フォーマットに従う
5. storyは lead→background→vision→use_of_funds→schedule→appeal の構造で生成
6. リターンは「商品 / 体験 / サービス / スポンサー」の4カテゴリで構成し、各カテゴリを必ず1件以上生成する
7. スポンサー層にはブロンズ/シルバー/ゴールド/ダイヤモンドの名称を使用
8. project.extended の7項目（名称案3案・概要・なぜ・創出・発表会企画・活動歴・費用内訳）を必ず生成する
9. 文字数指定は厳守する
10. extended.title_proposals と project.title は**各23文字ちょうど**で、**必ず「〜したい！」で終える**。記号や空白で字数を稼がず、日本語として自然な名称にする
11. extended.cost_breakdown の amount の合計は goal_amount と完全に一致させる`;

/**
 * リターンのカテゴリ（t iku指示: 商品・体験・サービス・スポンサーの4構成）
 * 内部キーは英語、画面表示は下の REWARD_CATEGORY_LABELS を使う。
 */
export const REWARD_CATEGORIES = ['product', 'experience', 'service', 'sponsor'] as const;
export type RewardCategory = (typeof REWARD_CATEGORIES)[number];

export const REWARD_CATEGORY_LABELS: Record<RewardCategory, string> = {
  product: '商品',
  experience: '体験',
  service: 'サービス',
  sponsor: 'スポンサー',
};

/** 表示用の色。既存トーン（赤=主/金=スポンサー）を踏襲し新配色は作らない。 */
export const REWARD_CATEGORY_STYLES: Record<RewardCategory, { color: string; icon: string }> = {
  product: { color: '#E60012', icon: '📦' },
  experience: { color: '#E60012', icon: '🎫' },
  service: { color: '#E60012', icon: '🛠️' },
  sponsor: { color: '#D4A017', icon: '🤝' },
};

/** 未知・未設定の category を4カテゴリのどれかに寄せる（LLM出力のゆらぎ対策） */
export function normalizeRewardCategory(value: unknown, tier?: string): RewardCategory {
  const raw = String(value ?? '').trim().toLowerCase();
  const map: Record<string, RewardCategory> = {
    product: 'product', goods: 'product', item: 'product', 商品: 'product', 物販: 'product',
    experience: 'experience', event: 'experience', 体験: 'experience', イベント: 'experience',
    service: 'service', 'service_ticket': 'service', サービス: 'service', 役務: 'service',
    sponsor: 'sponsor', sponsorship: 'sponsor', スポンサー: 'sponsor', 協賛: 'sponsor',
  };
  if (map[raw]) return map[raw];
  // category が取れない場合は tier から推定（sponsor tier はスポンサー、それ以外は商品）
  return tier === 'sponsor' ? 'sponsor' : 'product';
}

export interface HearingInput {
  industry: string;          // 業種
  businessDescription: string; // 事業概要
  goalAmount: number;        // 目標金額
  deadlineDays: number;      // 募集期間
  targetAudience: string;    // ターゲット層
  currentChallenge: string;  // 本業の現状課題
  /**
   * 今回プロジェクトをおこなうきっかけ（任意）。
   * 生成結果の「なぜこの企画を始めたのか」に直結させる。
   */
  projectTrigger?: string;
  crowdfundingGoal: string;  // クラファンで実現したいこと
  creatorName: string;       // 起案者名
  /**
   * プロジェクト実施名（個人・法人・団体名のいずれか）。
   * 旧 `organization`（組織名）の後継で、掲載内容の事業者名を引き継ぐ。
   */
  projectEntityName?: string;
  /**
   * 起案者プロフィール（300文字以内・任意）。
   * creator.bio と extended の元ネタ。空ならAIが推定で埋める。
   */
  creatorProfile?: string;
  /**
   * 達成したい想い！支援者さんへのメッセージ（400文字以内・任意）。
   * 生成結果の story.appeal と extended の該当箇所の起点にする。
   * 空ならAIが推定して書く（`buildLinkLines` と同じく空欄は行を出さない）。
   */
  supporterMessage?: string;
  /**
   * SNS・サイトのURL（すべて任意）。
   * URLは公開して差し支えない情報なので、メール・電話とは違い掲載JSONにも載せる。
   * 🔴 **空欄の項目は掲載物にもメールにも行を出さない**（`""` で埋めた行を並べない）。
   */
  snsX?: string;
  snsFacebook?: string;
  snsInstagram?: string;
  siteUrl?: string;
  /**
   * 🔴 旧「組織名」。互換のため残してあるが**新規入力では使わない**。
   * `projectEntityName` が未指定のときのフォールバックとしてのみ参照する。
   */
  organization?: string;
  /**
   * 活動履歴（起業してからの時系列。任意）。
   * 生成側の「活動歴」の元ネタとして使う。空ならAIが推定で埋める。
   */
  activityHistory?: string;
}

/**
 * ⚠️ 支援金振込口座は HearingInput に含めない。
 * AIプロンプト・掲載用JSON・PDFのどこにも載せないため、
 * 生成系とは完全に別の型・別の経路（/api/ai/submit の bank_account）で扱う。
 */

/**
 * 🔴 事務局提出用の連絡先（メールアドレス・電話番号）。
 *
 * **HearingInput には絶対に含めない。** 口座情報と同じ設計で、
 * AIプロンプト・掲載用JSON・PDFのどこにも載らないよう
 * **型のレベルで経路を分けている**（公開ページに個人の連絡先が
 * 載る事故を構造的に封じるため）。事務局宛メールにのみ載せる。
 */
export interface ContactInput {
  email: string;
  phone: string;
}
export interface BankAccountInput {
  bankName: string;
  branchName: string;
  accountType: string;
  accountNumber: string;
  accountHolder: string;
}

/** 起案者のSNS・サイトリンク。入力があったキーだけが存在する */
export interface CreatorLinks {
  x?: string;
  facebook?: string;
  instagram?: string;
  website?: string;
}

/**
 * ヒアリング入力からSNSリンクを組み立てる。
 * 🔴 **空欄のキーは作らない** — `{ x: '' }` のような行が
 *   掲載JSON・PDF・メールに出るのを防ぐため、undefined ではなくキー自体を落とす。
 */
export function buildCreatorLinks(input: {
  snsX?: string; snsFacebook?: string; snsInstagram?: string; siteUrl?: string;
}): CreatorLinks | undefined {
  const entries: Array<[keyof CreatorLinks, string | undefined]> = [
    ['x', input.snsX],
    ['facebook', input.snsFacebook],
    ['instagram', input.snsInstagram],
    ['website', input.siteUrl],
  ];
  const links: CreatorLinks = {};
  for (const [k, v] of entries) {
    const s = (v ?? '').trim();
    if (s) links[k] = s;
  }
  return Object.keys(links).length > 0 ? links : undefined;
}

export interface ProjectStory {
  lead: string;
  background: string;
  vision: string;
  use_of_funds: string;
  schedule: string;
  appeal: string;
}

export interface Reward {
  /** リターンの種類（商品/体験/サービス/スポンサー）— 表示のグループ分けに使う */
  category: RewardCategory;
  tier: 'entry' | 'standard' | 'premium' | 'vip' | 'sponsor';
  title: string;
  description: string;
  image_url: string;
  price: number;
  shipping_included: boolean;
  estimated_delivery: string;
  stock_limit: number | null;
  is_designated: boolean;
  designated_name: string;
  sponsor_name?: string; // ブロンズ/シルバー/ゴールド/ダイヤモンド (sponsor tier only)
}

export interface CrowdfundingPage {
  project: {
    title: string;
    subtitle: string;
    main_image_url: string;
    goal_amount: number;
    project_type: string;
    story: ProjectStory;
    creator: {
      name: string;
      avatar: string;
      bio: string;
      organization: string;
      /**
       * SNS・サイトのリンク。**入力があったものだけ**が入る
       * （空欄を空文字で埋めた項目は載せない）。
       */
      links?: CreatorLinks;
    };
    legal_info: {
      business_name: string;
      address: string;
      representative: string;
      contact_email: string;
      price_range: string;
      delivery: string;
      payment: string;
      shipping: string;
      returns: string;
      defects: string;
    };
    /**
     * 追加7項目（名称案3案・概要・なぜ・創出・発表会企画・活動歴・費用内訳）。
     * 既存データ（この項目が無い過去の保存分）でも壊れないよう optional。
     */
    extended?: ProjectExtended;
  };
  rewards: Reward[];
}

/**
 * ヒアリング入力からプロンプトを構築
 */
/**
 * SNS・サイトのURLをプロンプトに載せる行を作る。
 * 🔴 入力があったものだけを出す（空欄の行を並べない）。
 */
function buildLinkLines(input: HearingInput): string {
  const rows: string[] = [];
  if (input.snsX?.trim()) rows.push(`- XのURL: ${input.snsX.trim()}`);
  if (input.snsFacebook?.trim()) rows.push(`- FacebookのURL: ${input.snsFacebook.trim()}`);
  if (input.snsInstagram?.trim()) rows.push(`- InstagramのURL: ${input.snsInstagram.trim()}`);
  if (input.siteUrl?.trim()) rows.push(`- HPやブログのURL: ${input.siteUrl.trim()}`);
  return rows.length ? `\n${rows.join('\n')}` : '';
}

export function buildPageGenerationPrompt(input: HearingInput): string {
  return `以下のヒアリング情報をもとに、KAMOファンディングのクラウドファンディングページの内容を生成してください。

【ヒアリング情報】
- 業種: ${input.industry}
- 事業概要: ${input.businessDescription}
- 目標金額: ¥${input.goalAmount.toLocaleString()}
- 募集期間: ${input.deadlineDays}日
- ターゲット層: ${input.targetAudience}
- 本業の現状課題: ${input.currentChallenge}${input.projectTrigger ? `
- 今回プロジェクトをおこなうきっかけ（起案者の申告。**extended.why_started はこの内容を必ず起点にして書く**こと。ここに書かれていない動機を捏造しない）:
${input.projectTrigger}` : ''}
- クラファンで実現したいこと: ${input.crowdfundingGoal}
- 起案者名: ${input.creatorName}
- プロジェクト実施名（個人・法人・団体名のいずれか）: ${input.projectEntityName ?? ''}${input.creatorProfile ? `
- 起案者プロフィール（起案者の申告。**creator.bio と extended はこの内容を必ず起点にして書く**こと。ここに書かれていない経歴を捏造しない）:
${input.creatorProfile}` : ''}${input.supporterMessage?.trim() ? `
- 達成したい想い・支援者へのメッセージ（起案者の申告。**story.appeal はこの内容を必ず起点にして書く**こと。ここに書かれていない想いを捏造しない）:
${input.supporterMessage.trim()}` : ''}${buildLinkLines(input)}${input.activityHistory ? `
- これまでの活動履歴（起案者の申告。extended.activity_history はこの内容を時系列に整形して使うこと。捏造しない）:
${input.activityHistory}` : ''}

【出力要件】
以下のJSONスキーマに従って出力してください:

{
  "project": {
    "title": "キャッチーで具体的なタイトル",
    "subtitle": "サブタイトル（一言で伝える魅力）",
    "main_image_url": "",
    "goal_amount": ${input.goalAmount},
    "project_type": "実行確約型",
    "story": {
      "lead": "冒頭のリード文（読者を引き込む一文）",
      "background": "事業の背景と現状の課題（2〜3文の要約でよい）",
      "vision": "このプロジェクトが実現したい未来（2〜3文の要約でよい）",
      "use_of_funds": "資金の使途（2〜3文の要約でよい）",
      "schedule": "実施スケジュール（日程の列挙。字数を稼がない）",
      "appeal": "支援者へのメッセージ・訴求（2〜3文の要約でよい）"
    },
    "creator": {
      "name": "${input.creatorName}",
      "avatar": "",
      "bio": "起案者の簡単な紹介",
      "organization": "${input.projectEntityName ?? ''}"
    },
    "legal_info": {
      "business_name": "${input.projectEntityName ?? ''}",
      "address": "",
      "representative": "${input.creatorName}",
      "contact_email": "",
      "price_range": "各プロジェクトページ参照",
      "delivery": "各プロジェクトページ記載",
      "payment": "クレジットカード/購入時決済",
      "shipping": "無料(商品代金に含む)",
      "returns": "破損・発送ミスのみ14日以内",
      "defects": "14日以内にお問い合わせ"
    },
    "extended": {
      "title_proposals": ["23文字ちょうど・したい！で終わる名称案1", "23文字ちょうど・したい！で終わる名称案2", "23文字ちょうど・したい！で終わる名称案3"],
      "overview": "プロジェクト概要（2〜3文の要約でよい）",
      "why_started": "なぜこの企画を始めたのか（2〜3文の要約でよい）",
      "what_creates": "この企画で何を創出するのか（2〜3文の要約でよい）",
      "announcement_event": {
        "format": "支援者向け発表会の開催形式",
        "timing": "開催時期",
        "program": ["プログラム項目1", "プログラム項目2", "プログラム項目3", "プログラム項目4"],
        "supporter_perks": ["支援者特典1", "支援者特典2", "支援者特典3"]
      },
      "activity_history": [
        { "date": "2023年4月", "event": "出来事" }
      ],
      "cost_breakdown": [
        { "item": "費目名", "amount": 0, "ratio": 0 }
      ]
    }
  },
  "rewards": [
    {
      "category": "product",
      "tier": "entry",
      "title": "リターン名",
      "description": "リターンの内容説明",
      "image_url": "",
      "price": 0,
      "shipping_included": true,
      "estimated_delivery": "2026-XX-XX",
      "stock_limit": null,
      "is_designated": false,
      "designated_name": ""
    }
    // ... 下記の配分で**合計15件**（商品6・体験4・サービス3・スポンサー2）
  ]
}

【story（掲載本文）について】
🔴 **story の本文はここでは要約で構いません**（background / vision / use_of_funds / appeal は各2〜3文）。
   長い本文は**この後の別のリクエストで書かせる**ので、ここで長く書く必要はありません。
   lead は読者を引き込む短いリード文、schedule は日程の列挙にしてください。

【extended（追加7項目）の要件（必須）】
1. title_proposals: プロジェクト名称の提案を**3案**。**各案は必ず23文字ちょうど**（日本語の文字数。半角空白・記号での字数稼ぎは禁止）で、**必ず「〜したい！」で終える**（例:「地元食材のデリバリーを地域のみんなと実現したい！」）。3案はそれぞれ切り口を変える（例: 価値訴求型／課題解決型／共感喚起型）
   🔴 **project.title も同じルール（23文字ちょうど・「〜したい！」締め）**で生成すること。名称案と主タイトルで規則が違うと掲載時に不整合になる。
2. overview: プロジェクト概要。**2〜3文の要約でよい**（長い本文は別リクエストで書かせます）
3. why_started: なぜこの企画を始めたのか。**2〜3文の要約でよい**
4. what_creates: この企画で何を創出するのか。**2〜3文の要約でよい**

5. announcement_event: 支援者向け発表会の企画。format（開催形式：会場/オンライン/ハイブリッド等）、timing（開催時期）、program（当日の進行を4項目以上）、supporter_perks（支援者への特典を3項目以上）
6. activity_history: 活動歴。**古い順**に4件以上。date は「2023年4月」形式、event は40〜80文字程度の具体的な出来事
7. cost_breakdown: 費用内訳を4〜6項目。item（費目）、amount（円・整数）、ratio（目標金額に対する割合%）。
   🔴 **amount の合計は必ず ${input.goalAmount}（goal_amount）と完全一致**させること。クラファン手数料・リターン原価・事務費も費目に含めて構わない

【リターンの構成（必須）】
🔴 **リターンは合計15件**生成してください。カテゴリ別の件数は次のとおりです（合計15件）:
- "product"（商品）: **6件**。物としてお届けするリターン。¥1,000〜¥30,000程度
- "experience"（体験）: **4件**。現地・オンラインでの体験型リターン。¥10,000〜¥100,000程度
- "service"（サービス）: **3件**。役務・相談・利用権などのリターン。¥5,000〜¥50,000程度
- "sponsor"（スポンサー）: **2件**。企業・団体向けの協賛枠（ロゴ掲載・広告掲載など）。**¥100,000以上**でスポンサー名称（ブロンズ/シルバー/ゴールド/ダイヤモンド）を sponsor_name に入れる

🔴 **15件の内容はすべて別物**にしてください。金額を少し変えただけの同じ内容を並べないこと。
🔴 **"tier" を偏らせない**こと。15件が全部 premium のような分布は選択肢にならないので、
   entry / standard / premium / vip / sponsor が**それぞれ最低1件以上**含まれるようにしてください。
   目安の配分は entry 4件・standard 4件・premium 4件・vip 1件・sponsor 2件です。
- entry: ¥1,000-3,000 / standard: ¥5,000-8,000 / premium: ¥10,000-30,000 / vip: ¥50,000-100,000 / sponsor: ¥100,000以上

JSONのみ出力してください。 markdownのコードブロックは不要です。`;
}

/**
 * リターン価格の逆算ロジック
 */
export function calculateRewardTiers(goalAmount: number, estimatedSupporters: number = 50): {
  entry: number;
  standard: number;
  premium: number;
  vip: number;
  sponsor: number;
} {
  const avgAmount = goalAmount / estimatedSupporters;
  return {
    entry: Math.round((avgAmount * 0.4) / 100) * 100,         // 0.3-0.5倍
    standard: Math.round((avgAmount * 1.2) / 100) * 100,       // 1.0-1.5倍
    premium: Math.round((avgAmount * 4) / 100) * 100,          // 3-5倍
    vip: Math.round((avgAmount * 10) / 100) * 100,             // 10倍
    sponsor: Math.round((avgAmount * 25) / 100) * 100,         // 20倍以上
  };
}

/**
 * 400文字級の本文7項目だけを書かせる**2回目の呼び出し**用プロンプト。
 *
 * 🔴 なぜ分離したか（2026-09-14 実測に基づく構造変更）:
 *   1回のリクエストでページ全体（リターン15件・23文字の名称案3案・費用内訳の
 *   合計一致・法務情報…）と一緒に長文7項目を書かせると、**本番で170〜277字**
 *   しか返らない。プロンプトを3通り強化しても、入力材料を厚くしても伸びなかった。
 *   一方、同じモデルに**見出し1つだけを渡して400字以上を要求すると658字**返る。
 *   つまり字数指示が他の制約に埋もれて薄まっている。
 *   → **要求を「長文を書くこと」だけに絞った専用の呼び出しに分ける。**
 *
 * 出力は7キーだけの小さなJSON。構造が単純なので途中で切れるリスクも下がる。
 */
export function buildLongTextPrompt(
  input: HearingInput,
  context: {
    title: string;
    subtitle: string;
    /** 1回目で得た要約。書き直しの 材料として渡す */
    summaries: Record<string, string>;
    /** 費用内訳（use_of_funds の根拠に使わせる） */
    costBreakdown: Array<{ item: string; amount: number; ratio: number }>;
  }
): string {
  const cost = context.costBreakdown.length
    ? context.costBreakdown.map(c => `- ${c.item}: ${c.amount.toLocaleString()}円（${c.ratio}%）`).join('\n')
    : '（内訳は未定。目標金額の配分を妥当に設定して書いてよい）';

  return `クラウドファンディングページの**本文だけ**を書いてください。構造やリターンは既に確定しているので、**文章を書くことだけに集中してください**。

【プロジェクト】
- タイトル: ${context.title}
- サブタイトル: ${context.subtitle}
- 業種: ${input.industry}
- 事業概要: ${input.businessDescription}
- 目標金額: ¥${input.goalAmount.toLocaleString()}
- 募集期間: ${input.deadlineDays}日
- ターゲット層: ${input.targetAudience}
- 本業の現状課題: ${input.currentChallenge}
- クラファンで実現したいこと: ${input.crowdfundingGoal}
- 起案者名: ${input.creatorName}
- プロジェクト実施名: ${input.projectEntityName ?? ''}${input.projectTrigger?.trim() ? `
- 今回プロジェクトをおこなうきっかけ（起案者の申告。**why_started はこれを必ず起点にする**。ここに無い動機を捏造しない）:
${input.projectTrigger.trim()}` : ''}${input.creatorProfile?.trim() ? `
- 起案者プロフィール（起案者の申告。ここに無い経歴を捏造しない）:
${input.creatorProfile.trim()}` : ''}${input.supporterMessage?.trim() ? `
- 達成したい想い・支援者へのメッセージ（起案者の申告。**appeal はこれを必ず起点にする**。ここに無い想いを捏造しない）:
${input.supporterMessage.trim()}` : ''}${input.activityHistory?.trim() ? `
- これまでの活動履歴（起案者の申告）:
${input.activityHistory.trim()}` : ''}

【資金の使途（確定済み。use_of_funds はこの費目と金額をそのまま使うこと）】
${cost}

【すでに作成済みの要約（これを膨らませてください。内容を矛盾させないこと）】
- background: ${context.summaries.background ?? ''}
- vision: ${context.summaries.vision ?? ''}
- use_of_funds: ${context.summaries.use_of_funds ?? ''}
- appeal: ${context.summaries.appeal ?? ''}
- overview: ${context.summaries.overview ?? ''}
- why_started: ${context.summaries.why_started ?? ''}
- what_creates: ${context.summaries.what_creates ?? ''}

【書き方（最重要）】
🔴 **7つの項目すべてを、それぞれ「7文以上」で書いてください。** 6文以下は不合格です。
   日本語の1文は平均55〜65文字なので、7文書けば自然に400文字を超えます。
   **文字数を数える必要はありません。「7文書き切る」ことだけを守ってください。**
🔴 各項目は**必ず句点（。）で言い切る**こと。「三つあります」と数を宣言したら、その数だけ列挙し切ること。
🔴 箇条書き・記号の羅列にしないこと。**地の文（散文）**で書いてください。
🔴 数字・固有名詞・具体的な場面を入れること。抽象論だけで7文埋めないでください。

【各項目に含める内容（これを順に書けば7文になります）】
- background（事業の背景と現状の課題）:
  ①事業の現状 ②現状を示す数字や事実 ③課題が起きている具体的な場面 ④課題を放置した場合のリスク
  ⑤これまで試した対策 ⑥それでも足りなかった理由 ⑦だから今回挑戦する
- vision（実現したい未来）:
  ①実現したい状態 ②支援者にとっての変化 ③地域にとっての変化 ④事業者自身にとっての変化
  ⑤1年後の姿 ⑥3年後の姿 ⑦その未来に向けた決意
- use_of_funds（資金の使途）:
  ①資金の総額と使途の全体像 ②〜⑥上記の費目それぞれの金額と、その費目が必要な理由
  ⑦使途と進捗の報告方法
- appeal（支援者へのメッセージ）:
  ①読んでくれたお礼 ②起案者の実体験のエピソード ③そこで感じたこと ④このプロジェクトへの想い
  ⑤支援者が受け取るもの ⑥一緒に実現したい未来 ⑦支援のお願い
- overview（プロジェクト概要）:
  ①誰が ②何を ③誰に向けて ④なぜ（課題） ⑤どうやって ⑥目標金額と募集期間 ⑦リターンと報告方針
- why_started（なぜこの企画を始めたのか）:
  ①きっかけの出来事 ②そのときの状況 ③感じた危機感 ④現状の課題 ⑤これまでの取り組み
  ⑥それでは足りない理由 ⑦クラウドファンディングを選んだ理由
- what_creates（この企画で何を創出するのか）:
  ①創出する価値の総論 ②支援者にとっての価値 ③地域にとっての価値 ④業界にとっての価値
  ⑤新しく生まれる仕組み ⑥続けることで積み上がるもの ⑦その先の展望

【出力形式】
次の7キーだけを持つJSONを出力してください。値はすべて文字列（改行は含めない）:

{
  "background": "…",
  "vision": "…",
  "use_of_funds": "…",
  "appeal": "…",
  "overview": "…",
  "why_started": "…",
  "what_creates": "…"
}

JSONのみ出力してください。markdownのコードブロックは不要です。`;
}

/** 2回目の呼び出しで書かせる本文のキー */
export const LONG_TEXT_KEYS = [
  'background', 'vision', 'use_of_funds', 'appeal',
  'overview', 'why_started', 'what_creates',
] as const;
export type LongTextKey = (typeof LONG_TEXT_KEYS)[number];
