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
6. リターンは5階層（entry/standard/premium/vip/sponsor）で設計
7. スポンサー層にはブロンズ/シルバー/ゴールド/ダイヤモンドの名称を使用`;

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
- 組織名: ${input.organization}

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
    }
  },
  "rewards": [
    {
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
    // ... 5階層すべて（entry, standard, premium, vip, sponsor）
  ]
}

リターンは5階層すべて生成してください:
- entry: ¥1,000-3,000程度
- standard: ¥5,000-8,000程度
- premium: ¥10,000-30,000程度
- vip: ¥50,000-100,000程度
- sponsor: ¥100,000以上（スポンサー名称: ブロンズ/シルバー/ゴールド/ダイヤモンド）

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
