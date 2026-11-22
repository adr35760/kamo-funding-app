/**
 * サイト共通の実績数値（2026-11-21 t iku 指定の「正式な実績表記」）。
 *
 * 🔴 実績の数値・ラベル・注記は**このファイルだけ**を正とする。
 *    - トップ（/）・成功事例（/success）・掲載説明会LP（/lp）は
 *      `StatsBanner`（src/components/StatsBanner.tsx）を置き、
 *      文言はすべてここの定数から取る（JSX・各ページに数値を直書きしない）。
 *    - トップの下部実績欄（LP_TRUST）・メタdescription もここを参照する。
 *
 * 数値の根拠: t iku 送付のモック（2026-11-21）。
 *   577件／約19.5億円は「KAMOファンディング＋未来の扉（サポート案件）」の合計。
 *   93.7%だけは KAMOファンディング単独の目標達成率（誤解を招かないよう必ず明記する）。
 *
 * 🔴 旧値（16億8,752万円・95%）はこのサイトの実績表示には使わない。
 *    /seminar-info の NUM_JISSEKI / NUM_TASSEI_RATE（別ページ・別表記）は対象外。
 */

/** 億円単位の数値表記（19.5 / 16.88 / 2.6 / 19.48）。末尾の0は落とす */
export function formatOkuYen(amount: number): string {
  return parseFloat((amount / 100_000_000).toFixed(2)).toString();
}

/** 累計支援件数（両サービス合計・直近5年間） */
export const SUPPORTED_PROJECTS = 577;
/** 累計支援総額（円・両サービス合計・直近5年間） */
export const TOTAL_RAISED_ALL = 1_950_000_000;
/** 目標達成率（%・KAMOファンディング単独・直近5年間） */
export const ACHIEVEMENT_RATE = 93.7;
/** 累計支援総額の内訳（円）。合計は 19.48億円 */
export const RAISED_BREAKDOWN = [
  { label: 'KAMOファンディング', amount: 1_688_000_000 },
  { label: '未来の扉（サポート案件）', amount: 260_000_000 },
] as const;
/** 内訳の合計（16.88億＋2.6億＝19.48億） */
export const RAISED_BREAKDOWN_TOTAL = RAISED_BREAKDOWN.reduce((sum, item) => sum + item.amount, 0);

export const SUPPORTED_PROJECTS_LABEL = `${SUPPORTED_PROJECTS}件`;
/** KAMOファンディング単独の累計支援総額（内訳の1行目・/lp の紹介文で使用） */
export const KAMO_RAISED_LABEL = `${formatOkuYen(RAISED_BREAKDOWN[0].amount)}億円`;
export const TOTAL_RAISED_LABEL = `約${formatOkuYen(TOTAL_RAISED_ALL)}億円`;
export const ACHIEVEMENT_RATE_LABEL = `${ACHIEVEMENT_RATE}%`;

/** 集計期間の表記（バナー注記・下部実績欄で共有） */
export const STATS_PERIOD = '直近5年間';
export const STATS_PERIOD_NOTE = `※集計期間は${STATS_PERIOD}です。`;

/**
 * 実績の定義文（バナー注記・下部実績欄で共有）。
 *
 * 2026-11-22 t iku指示: 両サービス合算であることと内訳、93.7%の対象（KAMO単独）を
 * 1つの注記で明示する。数値はこのファイルの定数から組み立てる（直書き禁止）。
 * 🔴 バナーとトップ下部の実績欄は**まったく同じ文**を出す（片方だけ直さない）。
 */
export const STATS_DEFINITION =
  `累計支援件数${SUPPORTED_PROJECTS_LABEL}・累計支援総額${TOTAL_RAISED_LABEL}は、` +
  'KAMOファンディングおよび未来の扉のサポート案件を合算した実績です。' +
  `累計支援総額の内訳は、KAMOファンディング${formatOkuYen(RAISED_BREAKDOWN[0].amount)}億円、` +
  `未来の扉${formatOkuYen(RAISED_BREAKDOWN[1].amount)}億円です。` +
  `${ACHIEVEMENT_RATE_LABEL}はKAMOファンディング単独の目標達成実績です。`;

/**
 * 短縮版の定義文（LPヒーローなど、横幅が狭く長文を置けない場所向け）。
 *
 * 🔴 数値は上の定数から組み立てる（直書き禁止）。内訳（16.88億／2.6億）だけを省いた形で、
 *    「両サービス合算」「93.7%はKAMO単独」の2点は必ず残す。
 *    フル注記（STATS_DEFINITION）を出せる場所ではそちらを使う。
 */
export const STATS_DEFINITION_SHORT =
  `${STATS_PERIOD_NOTE}${SUPPORTED_PROJECTS_LABEL}・${TOTAL_RAISED_LABEL}は` +
  'KAMOファンディングおよび未来の扉のサポート案件を合算した実績です。' +
  `${ACHIEVEMENT_RATE_LABEL}はKAMOファンディング単独の目標達成実績です。`;

/**
 * 3ページ共通の実績バナー（トップ／success／lp）の中身。
 *
 * 🔴 構成は t iku 指定のモックに合わせる:
 *    上段＝3つの数値（数値＋ラベル＋補足）、中段＝内訳1行、下段＝注記1行。
 *    93.7% の直下は「KAMOファンディングの目標達成率」（KAMO単独であることを明記）。
 *    label が空の項目は、行の高さを揃えるため透明なプレースホルダを出す（コンポーネント側）。
 */
export const STATS_BANNER = {
  heading: '5年間のクラウドファンディング支援実績',
  items: [
    { value: SUPPORTED_PROJECTS_LABEL, label: '累計支援件数', note: '両サービス合計', emphasis: false },
    { value: TOTAL_RAISED_LABEL, label: '累計支援総額', note: '両サービス合計', emphasis: false },
    // 93.7%だけはKAMOファンディング単独。数値の直下に必ず明記する
    { value: ACHIEVEMENT_RATE_LABEL, label: '', note: 'KAMOファンディングの目標達成率', emphasis: true },
  ],
  breakdown: {
    // 内訳の合計（16.88＋2.6＝19.48億）は見出しの約19.5億と完全一致しないため「主な内訳」と明記する（t iku指示 2026-11-22）
    heading: '累計支援総額の主な内訳',
    items: RAISED_BREAKDOWN.map((item) => ({
      label: item.label,
      value: `${formatOkuYen(item.amount)}億円`,
    })),
    total: { label: '合計', value: `${formatOkuYen(RAISED_BREAKDOWN_TOTAL)}億円` },
  },
  /** バナー下端の注記（12px）。トップ下部の実績欄とまったく同じ文にする */
  source: `${STATS_PERIOD_NOTE}${STATS_DEFINITION}`,
} as const;
