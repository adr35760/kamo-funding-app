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
6. リターンは「商品 / サービス / 体験 / スポンサー」の4カテゴリで構成し、各カテゴリを必ず1件以上生成する。スポンサーは松・竹・梅の3段階
7. スポンサー層は松/竹/梅の3段階の名称を使用（t iku指示 2026-09-18。旧: ブロンズ〜ダイヤモンド）
8. project.extended の7項目（名称案3案・概要・なぜ・創出・発表会企画・活動歴・費用内訳）を必ず生成する
9. 文字数指定は厳守する
10. extended.title_proposals と project.title は**各23文字ちょうど**で、**必ず「〜したい！」で終える**。記号や空白で字数を稼がず、日本語として自然な名称にする
11. extended.cost_breakdown の amount の合計は goal_amount と完全に一致させる`;

/**
 * リターンのカテゴリ（t iku指示: 商品・体験・サービス・スポンサーの4構成）
 * 内部キーは英語、画面表示は下の REWARD_CATEGORY_LABELS を使う。
 */
/**
 * 🔴 この配列の順序が**画面・PDFの表示順**になる。
 *   t iku指示 2026-09-18 の並び（商品→サービス→体験→スポンサー）に合わせている。
 */
export const REWARD_CATEGORIES = ['product', 'service', 'experience', 'sponsor'] as const;
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
  /**
   * 提供できる商品・サービス／できること（箇条書き・任意。t iku指示 2026-09-18）。
   *
   * 🔴 リターン生成の**一次資料**。ここに書かれたものを優先して
   *   商品3・サービス4・体験3・スポンサー松竹梅3の13件に割り当てる。
   *   空欄のときだけAIが事業内容から推定する。
   */
  offerings?: string;
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
  /** スポンサー枠の段階名。松 / 竹 / 梅（t iku指示 2026-09-18。旧: ブロンズ〜ダイヤモンド） */
  sponsor_name?: string;
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
${input.activityHistory}` : ''}${input.offerings?.trim() ? `
- 提供できる商品・サービス／できること（起案者の申告・箇条書き。🔴**リターンはこの内容を必ず起点にして作る**こと。ここに無い商品・サービスを捏造して並べない。書かれた項目が13件に足りない場合は、書かれたものを組み合わせる・数量や規模を変える・関連する範囲で広げる形で埋め、まったく別の事業内容を持ち込まないこと）:
${input.offerings.trim()}` : ''}

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
      "closing": "最後に（読み終えた人の背中を押す締めの呼びかけ。2〜3文の要約でよい）",
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
      "description": "・特典1\\n・特典2\\n・特典3\\n\\nどんな人におすすめかの一文。",
      "image_url": "",
      "price": 0,
      "shipping_included": true,
      "estimated_delivery": "2026-XX-XX",
      "stock_limit": null,
      "is_designated": false,
      "designated_name": ""
    }
    // ... 下記の要件で**合計10〜13件**（一般7〜10件＋スポンサー3件=応援/パートナー/メイン）
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
4-2. closing: 「最後に」。掲載ページの締めの呼びかけ。**2〜3文の要約でよい**。
   訴求メッセージ（appeal）とは役割が違う。appeal は「支援が何に変わるか」の説明、
   closing は**読み終えた人の背中を押す**一節にすること。

5. announcement_event: 支援者向け発表会の企画。format（開催形式：会場/オンライン/ハイブリッド等）、timing（開催時期）、program（当日の進行を4項目以上）、supporter_perks（支援者への特典を3項目以上）
6. activity_history: 活動歴。**古い順**に4件以上。date は「2023年4月」形式、event は40〜80文字程度の具体的な出来事
7. cost_breakdown: 費用内訳を4〜6項目。item（費目）、amount（円・整数）、ratio（目標金額に対する割合%）。
   🔴 **amount の合計は必ず ${input.goalAmount}（goal_amount）と完全一致**させること。クラファン手数料・リターン原価・事務費も費目に含めて構わない

【リターンの構成（必須）】
🔴 **リターンは合計10〜13件**。内訳は「一般（商品・サービス・体験）7〜10件」＋「スポンサー3件」です。
   **件数を埋めるために内容を水増ししないこと。** 事業内容から自然に出せる件数で構いません。
- "product"（商品）: 物としてお届けするリターン。¥1,000〜¥30,000程度
- "service"（サービス）: 役務・相談・セミナー参加権などのリターン。¥3,000〜¥50,000程度
- "experience"（体験）: 現地・オンラインでの体験型リターン。¥10,000〜¥100,000程度
- "sponsor"（スポンサー）: 企業・団体向けの協賛枠（ロゴ掲載・PRタイムなど）**3件**。
  🔴 3件は sponsor_name に **「応援」「パートナー」「メイン」**をそのまま入れてください
  （松竹梅やブロンズ/ゴールド等は使わない）。金額は **応援 ¥50,000 / パートナー ¥100,000 /
  メイン ¥200,000** を目安に、段階が上がるほど特典（ロゴの大きさ・掲載場所・PR時間・
  招待人数・個別相談の有無）が明確に厚くなるようにしてください。

🔴 **いちばん安い枠として「純粋応援コース」（¥3,000前後・category は "service"）を必ず1件入れてください。**
   見返りを求めず応援したい人の受け皿です。内容は「お礼メッセージ・活動報告・支援者限定動画」など。

🔴 **description は箇条書きで特典を並べてください。** 1行1項目、行頭に「・」を付け、
   改行は \\n（バックスラッシュ＋n。JSON文字列のエスケープ改行）で区切ります。**3〜6項目**が目安です。
   さらに、箇条書きの後に**どんな人におすすめか**を1文添えてください。
   例:
   "・クラファン成功ガイドPDF\\n・公開前チェックリスト\\n・リターン設計シート\\n・支援者限定動画\\n\\nこれからクラウドファンディングを考えている方におすすめです。"
   🔴 1行の説明文だけで済ませないこと。支援者は箇条書きを見て選びます。

🔴 **title は「金額の意味が一目で分かる名前」**にしてください。
   例:「純粋応援コース」「実践セミナー参加権」「企画相談60分」「1DAY集中作戦会議」。
   「特製ステッカー」のような**汎用品でお茶を濁さない**こと。事業内容に紐づく名前にします。

🔴 **内容はすべて別物**にしてください。金額を少し変えただけの同じ内容を並べないこと。
🔴 **"tier" を偏らせない**こと。entry / standard / premium / vip / sponsor が
   **それぞれ最低1件以上**含まれるようにしてください。
- entry: ¥1,000-3,000 / standard: ¥5,000-8,000 / premium: ¥10,000-30,000 / vip: ¥50,000-100,000 / sponsor: ¥50,000以上

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
 *   1回のリクエストでページ全体（リターン13件・23文字の名称案3案・費用内訳の
 *   合計一致・法務情報…）と一緒に長文7項目を書かせると、**本番で170〜277字**
 *   しか返らない。プロンプトを3通り強化しても、入力材料を厚くしても伸びなかった。
 *   一方、同じモデルに**見出し1つだけを渡して400字以上を要求すると658字**返る。
 *   つまり字数指示が他の制約に埋もれて薄まっている。
 *   → **要求を「長文を書くこと」だけに絞った専用の呼び出しに分ける。**
 *
 * 出力は7キーだけの小さなJSON。構造が単純なので途中で切れるリスクも下がる。
 */
/** 項目ごとのラベル（外部から本文の見出し名を引くのに使う） */
export function longTextLabel(key: string): string {
  return LONG_TEXT_OUTLINES[key]?.label ?? key;
}

/** 項目ごとの「①〜⑬の骨組み」。1スロット1文で書かせる（スロット数＝文数がこのモデルで最も効く）。 */
const LONG_TEXT_OUTLINES: Record<string, { label: string; slots: string[] }> = {
  background: {
    label: '背景・現状（事業の背景と現状の課題）',
    slots: [
      '事業の現状', '現状を示す数字や事実', 'その数字が意味すること', '課題が起きている具体的な場面',
      'その場面で困っている人', '課題を放置した場合のリスク', 'これまで試した対策', 'その対策の結果',
      'それでも足りなかった理由', '自己資金だけでは届かない事情', '周囲から寄せられている声',
      '今動かなければ間に合わない理由', 'だから今回挑戦する',
    ],
  },
  vision: {
    label: 'ビジョン（実現したい未来）',
    slots: [
      '実現したい状態', 'その状態を一言で表すと何か', '支援者にとっての変化', '地域にとっての変化',
      '事業者自身にとっての変化', '半年後の姿', '1年後の姿', '3年後の姿',
      'そこで生まれる新しい関係', 'その関係が支えになる場面', 'それが続いた先にあるもの',
      '次の世代に残したいもの', 'その未来に向けた決意',
    ],
  },
  appeal: {
    label: '訴求メッセージ（支援者へのメッセージ）',
    slots: [
      '読んでくれたお礼', '起案者の実体験のエピソード', 'そのときの具体的な場面', 'そこで感じたこと',
      'それが今につながっている点', 'このプロジェクトへの想い', '支援者が受け取るもの',
      '支援が何に変わるか', '支援者に届く具体的な報告', '一緒に実現したい未来',
      'その未来に支援者が関わる形', '少額でも力になる理由', '支援のお願い',
    ],
  },
  overview: {
    label: 'プロジェクト概要',
    slots: [
      '誰が', 'どんな事業をしているか', '何をするプロジェクトか', '誰に向けてか', 'なぜ必要か（課題）',
      'その課題の具体例', 'どうやって解決するか', '解決までの進め方', '目標金額',
      '募集期間と資金の使い道の要点', 'リターンの方針', '支援が生む効果',
      '進捗の報告方針',
    ],
  },
  why_started: {
    label: 'なぜこの企画を始めたのか',
    slots: [
      'きっかけの出来事', 'そのときの状況', 'その場で交わした言葉や見た光景', '感じた危機感',
      '気づいたこと', '現状の課題', 'これまでの取り組み', 'その取り組みで分かったこと',
      'それでは足りない理由', '自分ひとりでは無理だと考えた点', '相談して分かったこと',
      'この挑戦に込めた覚悟', 'クラウドファンディングを選んだ理由',
    ],
  },
  what_creates: {
    label: 'この企画で何を創出するのか',
    slots: [
      '創出する価値の総論', '支援者にとっての価値', 'その価値が届く具体的な場面', '地域にとっての価値',
      '地域の誰がどう変わるか', '業界にとっての価値', '新しく生まれる仕組み', 'その仕組みの回り方',
      '続けることで積み上がるもの', 'それが数字に表れる形', '他の事業者に広がる可能性',
      '地域に残る仕組みとしての意味', 'その先の展望',
    ],
  },
  /**
   * 🔴 2026-09-22 追加（t iku提示の見本に「最後に」の章があり、生成対象に無かった）。
   *   掲載ページの締めの呼びかけ。appeal（訴求メッセージ）とは役割が違う:
   *   appeal は「支援者が受け取るもの」の説明、closing は**読み終えた人の背中を押す**一節。
   */
  closing: {
    label: '最後に（締めの呼びかけ）',
    slots: [
      'このプロジェクトの根っこにある一言', 'なぜそう言えるのか', '応援してくれる人がいることの意味',
      '一人で抱えていたときの状態', 'その状態が変わる瞬間', '起案者が本当に届けたい相手',
      'その人がいま感じている不安', 'この挑戦が用意する居場所', 'ここから生まれてほしいもの',
      '支援者・挑戦者・紹介者それぞれの関わり方', '全員が仲間であるという宣言',
      '一緒につくりたい文化', '結びのお願い',
    ],
  },
};

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬'];

/**
 * 400文字級の本文を**1項目ずつ**書かせるプロンプト。
 *
 * 🔴 1回のリクエストで6項目まとめて書かせると、モデルが**回答全体で長さを配分**して
 *   しまい、1項目あたり230〜290字で止まる（2026-09-15 本番実測）。
 *   項目ごとに呼び出しを分けると「長さを配分する相手」が無くなるので、
 *   1項目に集中して約400字を書く。
 *
 * 出力は1キーだけのJSON（`{"text": "…"}`）。構造が最小なので途中で切れるリスクも最小。
 */
export function buildLongTextPrompt(
  key: string,
  input: HearingInput,
  context: {
    title: string;
    subtitle: string;
    /** 1回目で得た要約。書き直しの材料として渡す */
    summaries: Record<string, string>;
    /** 費用内訳（本文が金額に触れるときの根拠に使わせる） */
    costBreakdown: Array<{ item: string; amount: number; ratio: number }>;
  }
): string {
  const cost = context.costBreakdown.length
    ? context.costBreakdown.map(c => `- ${c.item}: ${c.amount.toLocaleString()}円（${c.ratio}%）`).join('\n')
    : '（内訳は未定。目標金額の配分を妥当に設定して書いてよい）';

  const outline = LONG_TEXT_OUTLINES[key];
  const slots = (outline?.slots ?? []).map((sl, n) => `${CIRCLED[n] ?? `(${n + 1})`}${sl}`).join(' ');

  return `クラウドファンディングページの本文のうち、**「${outline?.label ?? key}」の1項目だけ**を書いてください。
他の項目は別途書くので、**この1項目に全力を注いでください**。

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
- 今回プロジェクトをおこなうきっかけ（起案者の申告。**「なぜこの企画を始めたのか」はこれを必ず起点にする**。ここに無い動機を捏造しない）:
${input.projectTrigger.trim()}` : ''}${input.creatorProfile?.trim() ? `
- 起案者プロフィール（起案者の申告。ここに無い経歴を捏造しない）:
${input.creatorProfile.trim()}` : ''}${input.supporterMessage?.trim() ? `
- 達成したい想い・支援者へのメッセージ（起案者の申告。**「訴求メッセージ」はこれを必ず起点にする**。ここに無い想いを捏造しない）:
${input.supporterMessage.trim()}` : ''}${input.activityHistory?.trim() ? `
- これまでの活動履歴（起案者の申告）:
${input.activityHistory.trim()}` : ''}${input.offerings?.trim() ? `
- 提供できる商品・サービス／できること（起案者の申告）:
${input.offerings.trim()}` : ''}

【資金の使途（確定済み。金額に触れるときはこの費目と金額をそのまま使い、矛盾させないこと）】
${cost}

【この項目のすでに作成済みの要約（これを膨らませてください。内容を矛盾させないこと）】
${context.summaries[key] ?? ''}

【他の項目の要約（重複を避けるために参考として渡します。ここを書く必要はありません）】
${Object.entries(context.summaries)
  .filter(([k]) => k !== key)
  .map(([k, v]) => `- ${LONG_TEXT_OUTLINES[k]?.label ?? k}: ${v}`)
  .join('\n')}

【書き方（最重要）】
🔴 **クラウドファンディングの掲載ページに、そのまま貼れる読み物として書いてください。**
   報告書ではありません。読み手（支援者）に語りかける文章です。

🔴 **段落に分けてください。** 1段落は1〜3文。**段落と段落のあいだは空行**（改行2つ）で区切ります。
   全体で**5〜8段落**が目安です。1本の長い塊にしないでください。

🔴 **1文は短く。** 40文字を超えたら2文に割ってください。
   1文に主張を1つだけ入れます。「〜であり、〜のため、〜という状況です」と繋げないこと。

🔴 **語りかけの調子を混ぜてください。** 独立した短い1行（15文字以下）を**2〜4か所**入れると、
   読み手の呼吸が整います。
   例:「一人で挑戦することです。」「だからこそ、仲間が必要でした。」

🔴 **人の声・その場の情景を最低1つ入れてください。** 「〜と言われました」「〜という声を聞きました」
   のような具体的な発話や場面があると、読み手に届きます。

🔴 **同じ語尾を3回以上続けないこと。** 「〜します。〜します。〜します。」は棒読みになります。
   「〜ます／〜でした／〜です／体言止め」を混ぜてください。

🔴 **箇条書きを使ってよい**のは、項目を並べる場面だけです。使うときは行頭に「・」を付け、
   1行1項目で改行してください。文章の代わりに箇条書きで埋めるのは禁止です。

🔴 全体で**450〜700文字**。数字・固有名詞・具体的な場面を必ず入れ、抽象論だけで埋めないこと。
🔴 **必ず句点（。）で言い切る**こと。「三つあります」と数を宣言したら、その数だけ列挙し切ること。
🔴 番号（①②…）は**本文に書かないこと**。下の一覧は「触れる内容」を示すだけです。

【この項目で触れる内容（順序は入れ替えて構いません。全部に触れてください）】
${slots}

【出力形式】
次の1キーだけを持つJSONを出力してください。値は文字列です。
🔴 **段落の区切りは \\n\\n、箇条書きの改行は \\n として文字列に含めてください**
   （JSON文字列内のエスケープされた改行です。生の改行を入れるとJSONが壊れます）。

{ "text": "…" }

JSONのみ出力してください。markdownのコードブロックは不要です。`;
}

/**
 * 短すぎた本文を**書き直させる**プロンプト。
 *
 * 🔴 このモデルは「文数」は正確に守るが、**1回の回答の総量をだいたい一定に保つ**ため、
 *   文数を増やすと1文を短くして同じ長さに収めてしまう（本番実測: 11文→13文でも
 *   合計は約350字のまま）。そこで**一度書かせた本文を渡して「この文章を長くする」**
 *   という差分タスクに変える。総量を決める基準が「元の文章」になるので伸びる。
 */
export function buildLongTextExpandPrompt(args: {
  label: string;
  /** 1回目で書けた本文 */
  current: string;
  /** 目標下限・上限 */
  min: number;
  max: number;
}): string {
  const shortfall = Math.max(0, args.min - Array.from(args.current).length);
  return `次の文章は**${Array.from(args.current).length}文字**で、必要な長さに足りていません。
**${args.min}〜${args.max}文字**に書き直してください（あと約${shortfall}文字必要です）。

【項目】${args.label}

【今の文章】
${args.current}

【書き直しのルール】
🔴 **今の文の順番と内容は変えないでください。** 情報を足して厚くするだけです。
🔴 **1文は40文字以内のまま**にしてください。長さは「1文を伸ばす」のではなく
   **説明の文・場面の文を足す**ことで稼ぎます（棒読みを避けるため）。
🔴 **段落に分けてください。** 1段落1〜3文、段落のあいだは空行（改行2つ）。全体で5〜8段落。
🔴 **新しい事実を作らないこと。** 上の文章に書かれている内容と、そこから当然言えることの
   範囲で膨らませてください。書かれていない数字や出来事を追加してはいけません。
🔴 同じ内容を言い換えて繰り返す**水増しは禁止**です。情報が増える形で長くしてください。
🔴 同じ語尾を3回以上続けないこと。「〜します。〜します。」の棒読みを避けてください。
🔴 **${args.max}文字を超えないこと。** 超えるとシステム側で末尾が切られます。
🔴 必ず句点（。）で言い切ってください。

【出力形式】
次の1キーだけを持つJSONを出力してください。値は文字列です。
🔴 **段落の区切りは \\n\\n（バックスラッシュ＋n を2つ）として文字列に含めてください**（生の改行はJSONを壊します）。

{ "text": "…" }

JSONのみ出力してください。markdownのコードブロックは不要です。`;
}

/**
 * 2回目の呼び出しで書かせる本文のキー（= 400文字級の項目）。
 *
 * 🔴 t iku 指定の6項目（2026-09-15）:
 *   プロジェクト概要 / なぜこの企画を始めたのか / この企画で何を創出するのか /
 *   背景・現状 / ビジョン / 訴求メッセージ
 *
 * 意図的に外しているもの:
 *   - lead      … 読者を引き込む一文。400字だと掲載ページの冒頭として機能しない
 *   - schedule  … 日程の列挙。字数を稼ぐと日付が読み取りにくくなる
 *   - use_of_funds … 費目と金額の説明。**費用内訳の表が別にある**ので、
 *                    同じ数字を400字で言い直すと重複して読みにくい（t iku 指定外）
 */
export const LONG_TEXT_KEYS = [
  'background', 'vision', 'appeal',
  'overview', 'why_started', 'what_creates',
  // 🔴 2026-09-22 追加。見本にある「最後に」の締めの章（extended.closing）。
  'closing',
] as const;
export type LongTextKey = (typeof LONG_TEXT_KEYS)[number];
