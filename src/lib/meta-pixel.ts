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

/**
 * Metaピクセルの計測対象から外す内部業務ページ（2026-11-26 t iku指示）。
 *
 * - /admin   管理画面（Basic認証）
 * - /work    社内の業務管理システム
 * - /ai-tool 自社ツール（社内利用）
 *
 * 🔴 **パスの先頭一致**で判定する（/admin/xxx のような下位パスも除外）。
 *    判定の正はこの1箇所だけ。layout のベースコードにも同じ配列を渡す。
 * 🔴 除外ページでは init も PageView も撃たない（fbq 自体を読み込まない）。
 */
export const META_PIXEL_EXCLUDED_PREFIXES = ['/admin', '/work', '/ai-tool'] as const;

/** このパスが計測除外（内部業務ページ）かどうか */
export function isMetaPixelExcludedPath(pathname: string): boolean {
  if (!pathname) return false;
  return META_PIXEL_EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

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
