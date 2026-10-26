/**
 * /seminar-info の文言・数値のうち、差し替えが発生しうるものを1箇所に集約する。
 *
 * 🔴 実績数値（NUM_JISSEKI / NUM_TASSEI_RATE）は t iku さんの確認待ち。
 *    変更はこのファイルの1行だけを直せば、ヒーロー・実績セクション・
 *    SEO（title/description）すべてに反映される。
 *    （本文側に数値を直接書かないこと）
 */

/** 累計の支援実績（2026-10-25 t iku 確定＝切り上げ表記。実数は16億8,751万5,999円） */
export const NUM_JISSEKI = '17億円';

/** 達成率 */
export const NUM_TASSEI_RATE = '95%';

/**
 * 個別相談（生島との45分）の予約ページ。
 * t iku さん指定のURLをそのまま使う（パラメータを付けない・短縮しない）。
 * 🔴 トップ（/）・/lp・/seminar-info はすべてこの定数を import する。
 *    URLを各ページに直書きしない（差し替えを1箇所で済ませる）。
 */
export const CONSULT_URL = 'https://calendar.app.google/ejvtBroV4bRErCPM7';

/**
 * 個別相談の所要時間（分）。ヒーロー・ステップ・FAQ・SEO で共用。
 * 2026-10-26: 予約ページの実枠が 10:00–10:45 の45分だったため 60→45。
 * 変えるときはこの1行だけ（表記はすべてこの定数を参照する）。
 */
export const CONSULT_MINUTES = 45;
