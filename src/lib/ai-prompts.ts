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
9. 文字数指定は厳守する。特に extended.overview / why_started / what_creates は各400文字（±40文字）で書く
10. extended.title_proposals は各20文字ちょうど。記号や空白で字数を稼がず、日本語として自然な名称にする
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
  crowdfundingGoal: string;  // クラファンで実現したいこと
  creatorName: string;       // 起案者名
  organization: string;      // 組織名
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
export interface BankAccountInput {
  bankName: string;
  branchName: string;
  accountType: string;
  accountNumber: string;
  accountHolder: string;
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
export function buildPageGenerationPrompt(input: HearingInput): string {
  return `以下のヒアリング情報をもとに、KAMOファンディングのクラウドファンディングページの内容を生成してください。

【ヒアリング情報】
- 業種: ${input.industry}
- 事業概要: ${input.businessDescription}
- 目標金額: ¥${input.goalAmount.toLocaleString()}
- 募集期間: ${input.deadlineDays}日
- ターゲット層: ${input.targetAudience}
- 本業の現状課題: ${input.currentChallenge}
- クラファンで実現したいこと: ${input.crowdfundingGoal}
- 起案者名: ${input.creatorName}
- 組織名: ${input.organization}${input.activityHistory ? `
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
      "background": "事業の背景と現状の課題",
      "vision": "このプロジェクトが実現したい未来",
      "use_of_funds": "資金の使途（具体的に）",
      "schedule": "実施スケジュール",
      "appeal": "支援者へのメッセージ・訴求"
    },
    "creator": {
      "name": "${input.creatorName}",
      "avatar": "",
      "bio": "起案者の簡単な紹介",
      "organization": "${input.organization}"
    },
    "legal_info": {
      "business_name": "${input.organization}",
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
      "title_proposals": ["20文字ちょうどの名称案1", "20文字ちょうどの名称案2", "20文字ちょうどの名称案3"],
      "overview": "プロジェクト概要（400文字）",
      "why_started": "なぜこの企画を始めたのか（400文字）",
      "what_creates": "この企画で何を創出するのか（400文字）",
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
    // ... 下記の4カテゴリすべてを含めること
  ]
}

【extended（追加7項目）の要件（必須）】
1. title_proposals: プロジェクト名称の提案を**3案**。**各案は必ず20文字ちょうど**（日本語の文字数。半角空白・記号での字数稼ぎは禁止）。3案はそれぞれ切り口を変える（例: 価値訴求型／課題解決型／共感喚起型）
2. overview: プロジェクト概要。**400文字**（360〜440文字の範囲）。何を、誰に、なぜ、どうやるのかが単体で分かる文章
3. why_started: なぜこの企画を始めたのか。**400文字**（360〜440文字）。起案者の実体験・現状の課題・危機感を具体的に
4. what_creates: この企画で何を創出するのか。**400文字**（360〜440文字）。支援者・地域・業界にとっての価値を具体的に
5. announcement_event: 支援者向け発表会の企画。format（開催形式：会場/オンライン/ハイブリッド等）、timing（開催時期）、program（当日の進行を4項目以上）、supporter_perks（支援者への特典を3項目以上）
6. activity_history: 活動歴。**古い順**に4件以上。date は「2023年4月」形式、event は40〜80文字程度の具体的な出来事
7. cost_breakdown: 費用内訳を4〜6項目。item（費目）、amount（円・整数）、ratio（目標金額に対する割合%）。
   🔴 **amount の合計は必ず ${input.goalAmount}（goal_amount）と完全一致**させること。クラファン手数料・リターン原価・事務費も費目に含めて構わない

【リターンの構成（必須）】
"category" は必ず次の4つのいずれかを指定し、**4カテゴリすべてを最低1件ずつ**生成してください:
- "product"（商品）: 物としてお届けするリターン。¥1,000〜¥30,000程度で2件以上
- "experience"（体験）: 現地・オンラインでの体験型リターン。¥10,000〜¥100,000程度
- "service"（サービス）: 役務・相談・利用権などのリターン。¥5,000〜¥50,000程度
- "sponsor"（スポンサー）: 企業・団体向けの協賛枠（ロゴ掲載・広告掲載など）。**¥100,000以上**でスポンサー名称（ブロンズ/シルバー/ゴールド/ダイヤモンド）を sponsor_name に入れる

"tier" は金額帯の目安として併記してください:
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
