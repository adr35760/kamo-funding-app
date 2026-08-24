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
  /**
   * サムネイル画像を持つか。
   * 本家のプロジェクトサムネイルが取得できた案件のみ true。
   * （リターン一覧の画像しか無い案件は載せない＝意味不明・不適切になるため）
   */
  hasImage?: boolean;
  /** 補足の実績表記（本家記載の事実のみ。例「歴代女性1位」） */
  badge?: string;
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
        slug: 'nakajima01',
        title:
          '発信力で人生を変える！中島侑子の新刊『ビジネスInstagramの黄金律』を多くの人に届けたい！！',
        owner: '中島侑子さん',
        ownerNote: 'ナカジマユウコ',
        raised: 25061400,
        achievementRate: 8353,
        badge: 'カモファンディング歴代女性1位',
        description:
          '新刊『ビジネスInstagramの黄金律』を多くの人に届けるための53日間の挑戦。カモファンディング歴代女性1位の実績を記録。',
      },
      {
        slug: 'yamamoto02',
        title: '出版記念講演会を憧れの鴨さんとコラボでやりたい',
        owner: '山本隆司さん',
        ownerNote: 'ヤマモトリュウジ／JOZY',
        raised: 40380680,
        achievementRate: 8076,
        hasImage: true,
        description:
          '人生初の出版にあたり、師事する鴨頭嘉人さんとのコラボで出版記念講演会を開催する挑戦。',
      },
    ],
  },
  {
    id: 'store',
    label: '店舗開設',
    cases: [
      {
        slug: 'ooshimakeisuke01',
        title: '鮨てっぺん！大嶋啓介が世界へ挑戦！渋谷にてグランドオープン',
        owner: '大嶋啓介さん',
        ownerNote: 'おおしまけいすけ',
        raised: 135124559,
        achievementRate: 103,
        description:
          '15年ぶりの本気の挑戦。渋谷に「鮨てっぺん」をグランドオープンし、世界へ向けて打って出る挑戦。',
      },
    ],
  },
  {
    id: 'launch',
    label: '新サービスローンチ',
    cases: [
      {
        // 一覧に同名「焚き火の会」名義が2件ある。採用するのは slug=takibinokai の方
        // （もう一方の「焚火の会！〜社長選出プロジェクト！」¥5,619,939/1123% は不採用）
        slug: 'takibinokai',
        title: '全国統一 焚き火の会 〜狼煙（のろし）編〜',
        owner: '焚き火の会',
        raised: 16112162,
        achievementRate: 3222,
        description:
          '全国の仲間が集う「焚き火の会」の全国統一プロジェクト。ディナーショーなどを通じて繋がりを広げる挑戦。',
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
/**
 * KAMOファンディング全体の累計支援総額（掲載事例だけの合計ではない）。
 * 16億8751万5999円 = 1,600,000,000 + 87,510,000 + 5,999
 * 掲載事例の合計は totalRaised() を使う（この2つは別物なので混同しないこと）。
 */
export const CUMULATIVE_RAISED_ALL = 1_687_515_999;

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
