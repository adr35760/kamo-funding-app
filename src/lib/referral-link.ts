/**
 * 紹介パートナー専用リンク（`/r/<code>`）の取り扱い。
 *
 * ねらい: 紹介パートナーが配る「専用リンク」から来た申込を、
 *        どのパートナーの紹介かを自動で紐付ける（手入力のコードに頼らない）。
 *
 * 流れ:
 *   /r/KAMO-ABC123  →  /seminar-info?ref=KAMO-ABC123  →  申込フォームの hidden
 *   →  POST /api/apply（referral_code）  →  registrations.referral_code
 *   →  管理画面の「紹介リンク」タブでパートナー別の申込数
 *
 * 設計のポイント（既存の UTM と同じ考え方）:
 *  - **正規化してから保存する**。`KAMO-abc123` と `KAMO-ABC123` が別集計になると
 *    この機能の意味が消えるため、大文字化・全角→半角・前後空白除去・長さ上限をかける。
 *  - **申込を絶対に止めない**。コードが無い・形が変・未登録のいずれでも申込は成立させ、
 *    保存だけを見送る／そのまま残す（管理画面で「未登録コード」として見える）。
 *  - リンクを踏んだ順で**最後に踏んだ紹介者を採用**する（UTM の上書きと同じ）。
 *    ただし ref 無しのページを見ただけでは消さない（紹介リンクから来た人が
 *    トップページ経由で申し込んでも紹介が消えないように）。
 */

/** 1コードあたりの保存上限（悪意ある長文を弾く） */
import { SITE_ORIGIN } from '@/lib/site-url';

export const REFERRAL_CODE_MAX_LENGTH = 32;

/** 正規化後のコードの形（パートナー登録APIが発行する KAMO-XXXXXX を含む） */
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]*$/;

/** sessionStorage のキー（UTM など既存のキーと衝突しない名前にする） */
const STORAGE_KEY = 'kamo_ref_v1';

/** 全角の英数字を半角へ（コピペで全角になったコードを拾う） */
function toHalfWidthAlnum(s: string): string {
  return s
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    // 全角ハイフン・各種ダッシュを半角ハイフンへ（文書からのコピペ対策）
    .replace(/[\uFF0D\u2010-\u2015\u30FC]/g, '-');
}

/**
 * 紹介コードの正規化。空・未設定は null。
 * 制御文字を落とし、全角英数を半角化し、大文字化し、長さを制限する。
 */
export function normalizeReferralCode(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = toHalfWidthAlnum(String(raw))
    // 制御文字・改行を落とす（CSVやログを壊さないため）
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .slice(0, REFERRAL_CODE_MAX_LENGTH);
  return s.length > 0 ? s : null;
}

/** 正規化済みコードがURL・DBに載せてよい形か */
export function isReferralCodeShape(code: string | null): code is string {
  return !!code && CODE_PATTERN.test(code);
}

/** サイトのオリジン（末尾スラッシュ無し）。メールと管理画面で同じ値を使う */
export function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || SITE_ORIGIN).replace(/\/+$/, '');
}

/** パートナーが配る共有リンク（`/r/<code>`） */
export function referralShareUrl(code: string, origin?: string): string {
  return `${(origin || siteOrigin()).replace(/\/+$/, '')}/r/${encodeURIComponent(code)}`;
}

/** 共有リンクのパス部分（管理画面で表示・コピーする用） */
export function referralSharePath(code: string): string {
  return `/r/${encodeURIComponent(code)}`;
}

/** 紹介リンクから来た人が着地するURL（ref 付き） */
export function referralLandingPath(code: string): string {
  return `/seminar-info?ref=${encodeURIComponent(code)}`;
}

/** 現在のURLから ref を読む（ブラウザのみ） */
export function readReferralCodeFromSearch(search: string | URLSearchParams): string | null {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const code = normalizeReferralCode(params.get('ref'));
  return isReferralCodeShape(code) ? code : null;
}

/**
 * 現在のURLの ref を sessionStorage に保存する。
 * ref 付きで来たときだけ上書きする（ref 無しの内部リンクで紹介元が消えないように）。
 *
 * @returns この画面で使うべきコード（URL優先・無ければ保存済み）
 */
export function captureReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const fromUrl = readReferralCodeFromSearch(window.location.search);
    if (fromUrl) {
      try {
        window.sessionStorage.setItem(STORAGE_KEY, fromUrl);
      } catch {
        // プライベートモード等で保存できない場合は、この画面の間だけ有効な値として使う
      }
      return fromUrl;
    }
    return getStoredReferralCode();
  } catch {
    return null;
  }
}

/** sessionStorage に保存済みのコードを読む */
export function getStoredReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const code = normalizeReferralCode(window.sessionStorage.getItem(STORAGE_KEY));
    return isReferralCodeShape(code) ? code : null;
  } catch {
    return null;
  }
}

/**
 * 申込送信時に付ける紹介コードのペイロード。
 * URLに今も付いている値を優先し、無ければ保存済みの値を使う。
 * 無ければ空オブジェクト（サーバ側で null 扱い＝未紹介の申込）。
 */
export function getReferralPayload(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const code = readReferralCodeFromSearch(window.location.search) ?? getStoredReferralCode();
  return code ? { referral_code: code } : {};
}
