/**
 * 掲載の費用・支援期間の表示（2026-11-22 t iku承認）。
 *
 * 🔴 掲載手数料は利用規約 第4条（掲載に関する手数料）と一致させる。
 *    規約: 「総支援金額の20％、および当該手数料20％にかかる消費税を差し引いたうえで
 *    お振り込みいたします。…前各項のほか、その他の費用は無料です。」
 *    → サイト表記は「支援総額の20%（税別）」「その他の費用は無料」。
 *
 * 🔴 決済手数料は規約に記載が無いため、サイトには書かない（t iku確認中）。
 * 🔴 金額・条件をこのファイル以外に直書きしない（変えるときはここだけ）。
 */

/** 掲載手数料率（総支援金額に対する割合） */
export const PLATFORM_FEE_RATE = 0.2;
/** 「20%」 */
export const PLATFORM_FEE_LABEL = `${Math.round(PLATFORM_FEE_RATE * 100)}%`;
/** 税の扱い（規約どおり「税別」＝手数料に対する消費税が別途かかる） */
export const PLATFORM_FEE_TAX_LABEL = '税別';

/**
 * 決済手数料（2026-11-22 t iku回答）。
 * 🔴 掲載手数料20%の中に含まれる。別途5%を上乗せする書き方にしない。
 *    利用規約の「その他の費用は無料」とも整合する。
 */
export const PAYMENT_FEE_RATE = 0.05;
export const PAYMENT_FEE_LABEL = `${Math.round(PAYMENT_FEE_RATE * 100)}%`;
/** 「決済手数料5%を含みます」 */
export const PAYMENT_FEE_INCLUDED_NOTE = `決済手数料${PAYMENT_FEE_LABEL}を含みます`;
/** 掲載手数料の短い表記（サイト内の注記・ヒーローで共用） */
export const PLATFORM_FEE_SHORT = `支援総額の${PLATFORM_FEE_LABEL}（${PLATFORM_FEE_TAX_LABEL}・${PAYMENT_FEE_INCLUDED_NOTE}）`;

/** 掲載までの伴走期間（既存の公開表記「約4か月」を1箇所に） */
export const SUPPORT_PERIOD_LABEL = '約4か月';
