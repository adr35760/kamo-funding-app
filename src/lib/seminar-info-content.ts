/**
 * /seminar-info の文言・数値のうち、差し替えが発生しうるものを1箇所に集約する。
 *
 * 🔴 実績数値（NUM_JISSEKI / NUM_TASSEI_RATE）は t iku さんの確認待ち。
 *    変更はこのファイルの1行だけを直せば、ヒーロー・実績セクション・
 *    SEO（title/description）すべてに反映される。
 *    （本文側に数値を直接書かないこと）
 */

/** 累計の支援実績（現在の本番表記に合わせた値） */
export const NUM_JISSEKI = '16億円';

/** 達成率 */
export const NUM_TASSEI_RATE = '95%';

/**
 * 個別相談（生島との60分）の予約ページ。
 * t iku さん指定のURLをそのまま使う（パラメータを付けない・短縮しない）。
 */
export const CONSULT_URL = 'https://calendar.app.google/ejvtBroV4bRErCPM7';

/** 個別相談の所要時間（ヒーロー・ステップ・FAQで共用） */
export const CONSULT_MINUTES = 60;
