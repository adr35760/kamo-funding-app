/**
 * サイトの公開URL（1箇所で管理）。
 *
 * - 独自ドメインへ移行するときは **このファイルの1行だけ** を書き換える。
 * - メール本文・規約ページ・紹介リンクなどはすべてここを参照する。
 * - 旧ドメイン（kamo-funding-app.vercel.app）は Vercel 側で残すので、
 *   切り替え後も古いリンクは切れない。
 */
export const SITE_URL = 'https://crowdfunding.co.jp';

/** 末尾スラッシュ無しのサイトURL（テンプレート用） */
export const SITE_ORIGIN = SITE_URL.replace(/\/+$/, '');
