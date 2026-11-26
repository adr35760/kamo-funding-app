/**
 * Meta（Facebook）ピクセル — 全ページ共通の土台。
 *
 * 2026-11-26 t iku指示: Meta広告のコンバージョン計測のため、
 *   1. 全ページにベースコード（init + PageView + noscript img）を置く
 *   2. /consult のアンケート送信が**成功した時だけ** Lead を1回撃つ
 *
 * 🔴 ピクセルIDはビルド時に配信JSへ埋め込まれる公開値（秘密情報ではない）。
 *    置き場所はここ1箇所だけにする（layout と /consult で二重管理しない）。
 * 🔴 計測で画面を壊さない: fbq が無い・例外が出る場合は黙って何もしない。
 */

export const META_PIXEL_ID = '1153335503882062';

declare global {
  interface Window {
    /**
     * Meta の fbq。ベースコード（layout）が読み込み前に置く関数で、
     * 本体（fbevents.js）が来るまでは内部キューに積む。
     */
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

/**
 * 標準イベントを1回撃つ。ベースコードが未実行（fbq が無い）なら何もしない。
 * Lead の二重発火を避けるため、呼び出し側で「成功時に1回だけ」を守ること。
 */
export function trackMetaEvent(event: 'PageView' | 'Lead', params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const fbq = window.fbq;
  if (typeof fbq !== 'function') return;
  try {
    if (params) fbq('track', event, params);
    else fbq('track', event);
  } catch {
    // 計測の失敗は無視する（送信・画面遷移を止めない）
  }
}
