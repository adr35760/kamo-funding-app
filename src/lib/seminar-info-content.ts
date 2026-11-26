/**
 * /seminar-info の文言・数値のうち、差し替えが発生しうるものを1箇所に集約する。
 *
 * 🔴 実績数値は src/lib/site-stats.ts が唯一の情報源。
 *    2026-11-22 t iku指示で旧値（17億円・95%）を廃止し、サイト共通の
 *    「577件／約19.5億円（両サービス合計）／93.7%（KAMOファンディング単独）」
 *    に統一した。このファイルでも数値を直書きせず、site-stats.ts の定数から作る。
 *    本文側に数値を直接書かないこと。
 */
import {
  TOTAL_RAISED_LABEL,
  ACHIEVEMENT_RATE_LABEL,
  KAMO_RAISED_LABEL,
} from './site-stats';

/** 累計支援総額（両サービス合計・約19.5億円） */
export const NUM_JISSEKI = TOTAL_RAISED_LABEL;

/** 目標達成率（KAMOファンディング単独・93.7%） */
export const NUM_TASSEI_RATE = ACHIEVEMENT_RATE_LABEL;

/** KAMOファンディング単独の累計支援総額（16.88億円） */
export const NUM_JISSEKI_KAMO = KAMO_RAISED_LABEL;

/**
 * 数値を出すときの注記（両サービス合計・KAMO単独の区別）。
 * 🔴 実績数値を文中に出す箇所には、必ずこの注記を添える。
 */
export const NUM_JISSEKI_NOTE =
  `※${NUM_JISSEKI}はKAMOファンディングと未来の扉のサポート案件の合算、` +
  `${NUM_TASSEI_RATE}はKAMOファンディング単独の目標達成実績です。`;

/**
 * 事業資金づくり診断（生島との45分）の予約カレンダー（Googleカレンダーの予約ページ）。
 *
 * 🔴 このURLは /consult の送信完了後にだけ出す。サイト内の相談CTAから直接
 *    開かせない（2026-11-24 t iku指示: アンケート未入力では予約できないようにする）。
 */
export const CONSULT_CALENDAR_URL = 'https://calendar.app.google/ejvtBroV4bRErCPM7';

/**
 * 事業資金づくり診断CTAの遷移先＝予約前アンケートの入力ページ。
 *
 * 2026-11-24 t iku指示: 予約スケジュールを入れる前にアンケート（氏名・性別・年齢・
 * メールアドレス・アイディア／企画・希望金額）の入力を必須にした。
 * そのためサイト内の「事業資金づくり診断」CTAはすべてこの定数を参照し、外部カレンダーへ
 * 直リンクしない（URLの差し替えはこの1箇所で済ませる）。
 */
export const CONSULT_URL = '/consult';

/**
 * 事業資金づくり診断の所要時間（分）。ヒーロー・ステップ・FAQ・SEO で共用。
 * 2026-10-26: 予約ページの実枠が 10:00–10:45 の45分だったため 60→45。
 * 変えるときはこの1行だけ（表記はすべてこの定数を参照する）。
 */
export const CONSULT_MINUTES = 45;
