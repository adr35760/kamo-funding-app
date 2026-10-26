import { NextRequest, NextResponse } from 'next/server';
import { isReferralCodeShape, normalizeReferralCode } from '@/lib/referral-link';

/**
 * GET /r/:code — 紹介パートナーの専用リンク
 *
 *   /r/KAMO-ABC123  →  /seminar-info?ref=KAMO-ABC123
 *
 * このURLをパートナーが配ると、そこから申し込んだ人が
 * registrations.referral_code に自動で紐付く（管理画面でパートナー別に集計）。
 *
 * 重要な仕様（既存の /apply/:slug と同じ扱いに揃える）:
 *  - 🔴 **クエリ文字列を丸ごと引き継ぐ**。UTM が消えると流入元の計測が壊れる。
 *    ref だけは URL の値を正規化したもので上書きする。
 *  - **307（一時）**。308 はブラウザに強くキャッシュされ、転送先を変えても追随しない。
 *  - **コードが不正・未登録でも 404 を見せない**。申込導線のトップ（/seminar-info）へ
 *    そのまま送る（離脱させない）。コードの正否は申込時にサーバ側で扱う。
 *  - 存在するリンクを配るので、キャッシュさせない（no-store）。
 */

export async function GET(request: NextRequest, { params }: { params: { code: string } }) {
  // パスは URL デコード済みで渡る。%20 や全角が混じっても正規化で拾う
  const code = normalizeReferralCode(params.code);

  const search = new URLSearchParams(request.nextUrl.search);
  if (isReferralCodeShape(code)) {
    search.set('ref', code);
  } else {
    // 形が不正なコードは計測対象にしない（ref を付けずに落とす）
    search.delete('ref');
  }

  const target = new URL('/seminar-info', request.nextUrl.origin);
  target.search = search.toString();

  return NextResponse.redirect(target, {
    status: 307,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

export const dynamic = 'force-dynamic';
