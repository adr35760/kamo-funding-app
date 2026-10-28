/**
 * 計測の薄いヘルパー（§11）。
 *
 * 🔴 方針：**計測で画面を壊さない**。
 *   GA4 はまだ導入していない（NEXT_PUBLIC_GA_ID 未設定）。IDが無い状態でも
 *   track() は window.dataLayer に貯めるだけで、例外もネットワーク要求も出さない。
 *   IDが入れば initAnalytics() が gtag を読み込み、同じ dataLayer 経由で送られる。
 *
 * イベント（§11）:
 *   cta_click    { entrance: 1-4, position: 'fv' | 'hub' | 'footer' | 'follow' }
 *   form_start   { entrance }
 *   form_submit  { entrance }
 *   scroll_depth { percent: 25 | 50 | 75 | 100 }
 */

export type TrackParams = Record<string, string | number | boolean | undefined | null>;

/** cta_click の位置（§11 position） */
export type CtaPosition = 'fv' | 'hub' | 'footer' | 'follow';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * イベントを送る。dataLayer への push と gtag の両方を行うが、
 * どちらも無い（GA4未導入）環境では何も起きない。
 */
/** gtag.js 本体が読み込まれているか（自前の受け皿関数だけでは true にしない） */
function gaLoaded(): boolean {
  return typeof document !== 'undefined' && !!document.querySelector('script[data-ga4]');
}

export function track(event: string, params: TrackParams = {}): void {
  if (typeof window === 'undefined') return;
  try {
    const w = window;
    w.dataLayer = w.dataLayer || [];
    /**
     * 🔴 1イベントにつき dataLayer へ入れるのは**1件だけ**にする。
     *    gtag 経由（読み込み前は自前の受け皿が arguments を積む）と
     *    オブジェクトpush を両方やると、GA4導入後に同じイベントが二重計上される。
     *    GA4本体が入っていれば gtag、入っていなければオブジェクトpush。
     */
    if (gaLoaded() && typeof w.gtag === 'function') {
      w.gtag('event', event, params);
      return;
    }
    w.dataLayer.push({ event, ...params });
  } catch {
    // 計測の失敗は無視する（送信やスクロールを止めない）
  }
}

/**
 * GA4 の初期化。NEXT_PUBLIC_GA_ID がある時だけ gtag.js を読み込む。
 * 無い場合は dataLayer と gtag の受け皿だけ用意して終わる（エラーにしない）。
 */
export function initAnalytics(gaId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const w = window;
    w.dataLayer = w.dataLayer || [];
    if (typeof w.gtag !== 'function') {
      // 公式スニペットと同じく、読み込み前の呼び出しを dataLayer に積む
      w.gtag = function gtag(...args: unknown[]) {
        w.dataLayer!.push(args);
      };
    }

    const id = (gaId ?? '').trim();
    if (!id) return;
    if (document.querySelector(`script[data-ga4="${id}"]`)) return;

    const script = document.createElement('script');
    script.async = true;
    script.dataset.ga4 = id;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);

    w.gtag('js', new Date());
    w.gtag('config', id);
  } catch {
    // GA4 が読めなくてもページは動かす
  }
}
