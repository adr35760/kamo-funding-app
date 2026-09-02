/**
 * 流入元（UTMパラメータ）の取得・保持・正規化。
 *
 * 目的: 「どの投稿から何人申し込んだか」を campaign 単位で集計できるようにする。
 *
 * 設計のポイント:
 *  - URLのクエリから読み取り、**sessionStorage に保存**する。
 *    ページ内スクロールや再描画、ページ遷移（/apply/* → 既存ページのリダイレクト後も含む）で
 *    値が消えないようにするため。
 *  - **正規化（小文字化＋前後空白除去＋長さ上限）してから保存**する。
 *    `Facebook` と `facebook` が別集計になるとこの機能の価値が消えるため。
 *  - 値が無ければ空（null）。必須にしない — 申込フローを絶対に止めない。
 */

/** 1値あたりの保存上限。長大な値（悪意ある文字列を含む）を弾く */
export const UTM_MAX_LENGTH = 100;

/** sessionStorage のキー（既存の他機能と衝突しない名前にする） */
const STORAGE_KEY = 'kamo_utm_v1';

export interface UtmValues {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  /** 流入元が「不明」の内訳を読むための参考情報（任意） */
  referrer: string | null;
}

export const EMPTY_UTM: UtmValues = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  referrer: null,
};

/**
 * UTM値の正規化。
 * 小文字化・前後空白除去・制御文字除去・長さ上限。空文字は null にする。
 */
export function normalizeUtmValue(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw)
    // 制御文字・改行を落とす（CSVやログを壊さないため）
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .toLowerCase()
    .slice(0, UTM_MAX_LENGTH);
  return s.length > 0 ? s : null;
}

/** referrer は大文字小文字を変えるとURLとして意味が変わるため、trim と長さ上限のみ */
function normalizeReferrer(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200);
  return s.length > 0 ? s : null;
}

/** クエリ文字列（URLSearchParams）から UTM を読み取る */
export function readUtmFromSearch(search: string | URLSearchParams, referrer?: string): UtmValues {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  return {
    utm_source: normalizeUtmValue(params.get('utm_source')),
    utm_medium: normalizeUtmValue(params.get('utm_medium')),
    utm_campaign: normalizeUtmValue(params.get('utm_campaign')),
    referrer: normalizeReferrer(referrer),
  };
}

function hasAnyUtm(v: UtmValues): boolean {
  return !!(v.utm_source || v.utm_medium || v.utm_campaign);
}

/**
 * 現在のURLから UTM を読み取り、あれば sessionStorage に保存する。
 * 既に保存済みの値がある場合、**新しいUTMが来たときだけ上書き**する
 * （UTM無しの内部リンクを踏んで元の流入元が消えるのを防ぐ）。
 *
 * ブラウザ以外（SSR）や sessionStorage が使えない環境でも例外を投げない。
 */
export function captureUtm(): UtmValues {
  if (typeof window === 'undefined') return EMPTY_UTM;
  try {
    const fromUrl = readUtmFromSearch(window.location.search, document.referrer);
    if (hasAnyUtm(fromUrl)) {
      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fromUrl));
      } catch {
        // プライベートモード等で保存できない場合は、この画面の間だけ有効な値として使う
      }
      return fromUrl;
    }
    const stored = getStoredUtm();
    if (hasAnyUtm(stored)) return stored;
    // UTMが全く無い場合も referrer だけは記録する（「不明」の内訳用）
    return { ...EMPTY_UTM, referrer: normalizeReferrer(document.referrer) };
  } catch {
    return EMPTY_UTM;
  }
}

/** sessionStorage に保存済みの UTM を読む */
export function getStoredUtm(): UtmValues {
  if (typeof window === 'undefined') return EMPTY_UTM;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_UTM;
    const parsed = JSON.parse(raw) as Partial<UtmValues>;
    return {
      utm_source: normalizeUtmValue(parsed.utm_source),
      utm_medium: normalizeUtmValue(parsed.utm_medium),
      utm_campaign: normalizeUtmValue(parsed.utm_campaign),
      referrer: normalizeReferrer(parsed.referrer),
    };
  } catch {
    return EMPTY_UTM;
  }
}

/**
 * 申込送信時に付ける UTM ペイロード。
 * URLに今も付いている値を優先し、無ければ保存済みの値を使う。
 * 空の項目はキーごと省く（サーバ側で null 扱いになる）。
 */
export function getUtmPayload(): Record<string, string> {
  const v = typeof window === 'undefined' ? EMPTY_UTM : (() => {
    const fromUrl = readUtmFromSearch(window.location.search, document.referrer);
    const stored = getStoredUtm();
    return {
      utm_source: fromUrl.utm_source ?? stored.utm_source,
      utm_medium: fromUrl.utm_medium ?? stored.utm_medium,
      utm_campaign: fromUrl.utm_campaign ?? stored.utm_campaign,
      referrer: fromUrl.referrer ?? stored.referrer,
    } as UtmValues;
  })();

  const payload: Record<string, string> = {};
  if (v.utm_source) payload.utm_source = v.utm_source;
  if (v.utm_medium) payload.utm_medium = v.utm_medium;
  if (v.utm_campaign) payload.utm_campaign = v.utm_campaign;
  if (v.referrer) payload.referrer = v.referrer;
  return payload;
}
