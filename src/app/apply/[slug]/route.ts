import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /apply/:slug — 配布用の短縮URL
 *
 * 投稿やメールに貼る短いURLを、中身のある既存の申込ページへ転送する。
 *
 *   /apply/briefing        → /seminar-info#apply（掲載説明会）
 *   /apply/online-seminar  → /ai-seminar#apply（オンラインセミナー）
 *   /apply/real-event      → /real-seminar#apply（リアルセミナー＆交流会）
 *
 * 重要な仕様:
 *  - 🔴 **クエリ文字列を丸ごと引き継ぐ**。UTM（?utm_source=...）が消えると計測の意味が無い。
 *  - **307（一時）** を使う。恒久リダイレクト(308)はブラウザに強くキャッシュされ、
 *    将来転送先を変えたときに古い転送先へ飛び続けるため使わない。
 *  - 既存ページのURL（/seminar-info 等）も従来どおり直接使える（この転送は追加であって置換ではない）。
 *  - 未知の slug は申込導線のトップ（/seminar-info）へ落とす。404を見せて離脱させない。
 */

/** 短縮URL → 転送先（フォーム位置のアンカー付き） */
const DESTINATIONS: Record<string, string> = {
  briefing: '/seminar-info#apply',
  'online-seminar': '/ai-seminar#apply',
  'real-event': '/real-seminar#apply',
};

/** 未知の slug の落とし先 */
const FALLBACK = '/seminar-info#apply';

export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const slug = String(params.slug ?? '').toLowerCase();
  const destination = DESTINATIONS[slug] ?? FALLBACK;

  // クエリを丸ごと引き継ぐ（UTMだけでなく将来の任意パラメータも保持する）
  const query = request.nextUrl.search; // 例: "?utm_source=facebook&utm_medium=organic"
  const [path, hash] = destination.split('#');
  const target = `${path}${query}${hash ? `#${hash}` : ''}`;

  const url = new URL(target, request.nextUrl.origin);
  // 307: メソッドを保持する一時リダイレクト。転送先の変更に追随できる
  return NextResponse.redirect(url, {
    status: 307,
    headers: {
      // 短縮URLの転送先は運用中に変わりうるのでキャッシュさせない
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

export const dynamic = 'force-dynamic';
