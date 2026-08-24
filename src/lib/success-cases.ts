/**
 * 成功事例データ（kamofunding.com の実データ・2026-08-24取得）
 * 出典: https://www.kamofunding.com/
 *
 * ⚠️ 金額・達成率は本家サイトの実数値。改変禁止。
 * ⚠️ 目標金額は表示しない（明記されていたのは2件のみで、他は達成率からの逆算のため事実として出せない）。
 * ⚠️ 支援者数も表示しない（取得できたのは2件のみで5件揃わないため）。
 */

const PROJECT_BASE_URL = 'https://www.kamofunding.com/projects';

export interface SuccessCase {
  /** 本家プロジェクトページのスラッグ */
  slug: string;
  title: string;
  /** 実行者名（正確な表記。読み仮名が必要な場合は reading に入れる） */
  owner: string;
  /** 実行者の読み・肩書などの補足（任意） */
  ownerNote?: string;
  /** 集まった金額（円） */
  raised: number;
  /** 達成率（%） */
  achievementRate: number;
  /** 挑戦内容 */
  description: string;
}

/**
 * カードのサムネイル画像（本家サイトのプロジェクト画像・t iku許諾済み）。
 * 全5枚 1024×576（16:9）。画像内にプロジェクト名が焼き込まれているため
 * object-fit:cover で切ってはいけない（全体が見える形で表示する）。
 */
export const CASE_IMAGE_WIDTH = 1024;
export const CASE_IMAGE_HEIGHT = 576;

/** 画像パス（ファイル名は本家のslugと一致） */
export function caseImage(slug: string): string {
  return `/success/${slug}.jpg`;
}

export interface SuccessCategory {
  id: string;
  label: string;
  cases: SuccessCase[];
}

/** t iku指定の3カテゴリ（この順序で表示する） */
export const SUCCESS_CATEGORIES: SuccessCategory[] = [
  {
    id: 'publication',
    label: '出版記念講演会',
    cases: [
      {
        slug: 'matsukura02',
        title: '熱狂ゴリラ社長 出版前記念コラボ講演会',
        owner: '松倉裕規',
        ownerNote: '熱狂ゴリラ社長',
        raised: 11717500,
        achievementRate: 3905,
        description:
          '書籍出版前の記念コラボ講演会（スペシャルゲスト鴨頭嘉人）。「完全燃焼！大人の大運動会」などのイベント開催を通じて、完全燃焼人間500人の増加を目指す挑戦。',
      },
      {
        slug: 'hyouma01',
        title: '"4K"を広める講演会を大成功させたい！',
        owner: '多賀谷兵馬',
        ownerNote: '株式会社イオス 代表取締役社長・福岡県飯塚市',
        raised: 10509000,
        achievementRate: 2101,
        description:
          '建設業界の「きつい・汚い・危険」な現場で戦う4K crewを応援。初出版となる書籍の販売と、東京・大阪での講演会開催に挑戦。',
      },
    ],
  },
  {
    id: 'store',
    label: '店舗開設',
    cases: [
      {
        slug: 'hama01',
        title: '『いい店見ぃつけた♪』と笑顔で帰れるレストランを芝公園につくりたい！',
        owner: '濵賢治',
        ownerNote: 'はまけんじ',
        raised: 1578000,
        achievementRate: 315,
        description:
          '24年間の飲食業経験を活かし、芝公園に料理・空間・会話を楽しめるレストランをオープン。『粋』な大人が集う場所を目指す挑戦。',
      },
    ],
  },
  {
    id: 'launch',
    label: '新サービスローンチ',
    cases: [
      {
        slug: 'tonaki05',
        title: '時代の挑戦者を記録し、伝える。『月刊カモガシラランド』を継続×進化させたい！',
        owner: '渡名喜守勇',
        ownerNote: 'トナキ シュウ',
        raised: 1293000,
        achievementRate: 430,
        description:
          '2年以上発刊し続けたコミュニティ誌をバージョンアップ。公式SNS連動でリアルタイム共有を実現し、挑戦者の公式メディアとして全国へ発信。',
      },
      {
        slug: 'yuka01',
        title: '大切な人とお金を語り合える社会へ。〜親子にお金の学びを届ける挑戦を、みんなで実現したい！〜',
        owner: '駒沢友香',
        ownerNote: 'コマザワユカ',
        raised: 2185700,
        achievementRate: 728,
        description:
          '2026年8月10日開催『夏休みだよ！親子でお金の自由研究』。親子でお金を学ぶイベント、こども横丁体験、地域の親子へのチケット寄贈に挑戦。',
      },
    ],
  },
];

/** 本家プロジェクトページのURL */
export function projectUrl(slug: string): string {
  return `${PROJECT_BASE_URL}/${slug}`;
}

/** 掲載中の全案件（カテゴリ順） */
export function allSuccessCases(): SuccessCase[] {
  return SUCCESS_CATEGORIES.flatMap(c => c.cases);
}

/** 掲載案件数 */
export function totalCaseCount(): number {
  return allSuccessCases().length;
}

/** 集まった金額の合計（計算値。合計は事実として表示可） */
export function totalRaised(): number {
  return allSuccessCases().reduce((sum, c) => sum + c.raised, 0);
}

/** 最高達成率 */
export function maxAchievementRate(): number {
  return Math.max(...allSuccessCases().map(c => c.achievementRate));
}

/** 円表記（¥1,234,567） */
export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}
