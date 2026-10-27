/**
 * /partners（2種類のパートナー募集ページ）で使う金額・率の定数。
 *
 * 🔴 金額・率はこのファイルの1箇所だけに書く。
 *    紹介料2%／サポートはKAMO手数料の20%＋コンサル料¥30,000〜100,000／
 *    サポーター研修¥128,000 を変えるときは、ここの数字を1行直せば
 *    ヒーロー・カード・メリット・流れ・フォーム注記まで全部に反映される。
 *
 * 計算ロジック側（src/lib/reward-calc.ts）と同じ値を使うため、
 * 数値そのものは REWARD_CONFIG から取る（二重管理しない）。
 */
import { REWARD_CONFIG } from './reward-calc';
import { CONSULT_URL } from './seminar-info-content';

export const PARTNER_PROGRAM = {
  /** 紹介料：対象額の2% */
  REFERRAL_RATE: REWARD_CONFIG.REFERRAL_REWARD_RATE,
  /** サポート：KAMO手数料の20% */
  SUPPORT_FEE_RATE: REWARD_CONFIG.ADVISOR_REWARD_RATE,
  /** サポート：コンサル料の下限・上限 */
  CONSULT_FEE_MIN: REWARD_CONFIG.CONSULTANT_FEE_MIN,
  CONSULT_FEE_MAX: REWARD_CONFIG.CONSULTANT_FEE_MAX,
  /** サポーター研修の受講料 */
  TRAINING_FEE: REWARD_CONFIG.ADVISOR_COURSE_FEE,
} as const;

const yen = (value: number) => `¥${value.toLocaleString('ja-JP')}`;

/** 「2%」 */
export const REFERRAL_RATE_LABEL = `${Math.round(PARTNER_PROGRAM.REFERRAL_RATE * 100)}%`;
/** 「20%」 */
export const SUPPORT_FEE_RATE_LABEL = `${Math.round(PARTNER_PROGRAM.SUPPORT_FEE_RATE * 100)}%`;
/** 「¥30,000〜100,000」（上側は通貨記号を繰り返さない表記） */
export const CONSULT_FEE_LABEL = `${yen(PARTNER_PROGRAM.CONSULT_FEE_MIN)}〜${PARTNER_PROGRAM.CONSULT_FEE_MAX.toLocaleString('ja-JP')}`;
/** 「¥128,000」 */
export const TRAINING_FEE_LABEL = yen(PARTNER_PROGRAM.TRAINING_FEE);

/**
 * サポートパートナーの相談先（個別相談と同じカレンダー）。
 * URLは seminar-info-content.ts の1箇所で管理する（直書きしない）。
 */
export const SUPPORT_CONSULT_URL = CONSULT_URL;
