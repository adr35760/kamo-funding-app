import { NextRequest, NextResponse } from 'next/server';
import { buildAdminRedirectUri, isGoogleLoginConfigured, normalize } from '@/lib/admin-auth';

/**
 * GET /api/admin-auth/login — Googleのログイン画面へ送り出す
 *
 * 🔴 このルートは middleware の保護対象に入れない（ログインの入口なので）。
 *
 * CSRF対策: ランダムな `state` を発行し、短命Cookieに保存して
 *   コールバックで突き合わせる（他人に踏ませたログインを弾く）。
 */
export async function GET(request: NextRequest) {
  if (!isGoogleLoginConfigured()) {
    return NextResponse.json(
      {
        error:
          'Googleログインが未設定です。GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / ADMIN_ALLOWED_EMAILS を設定してください。',
      },
      { status: 503 }
    );
  }

  const state = crypto.randomUUID();
  const redirectUri = buildAdminRedirectUri(request.nextUrl.origin);

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', normalize(process.env.GOOGLE_CLIENT_ID));
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  // メールアドレスだけ受け取る。連絡先やカレンダー等は一切要求しない
  url.searchParams.set('scope', 'openid email');
  url.searchParams.set('state', state);
  // 毎回アカウントを選ばせる（共用PCで前の人のまま入るのを防ぐ）
  url.searchParams.set('prompt', 'select_account');

  const res = NextResponse.redirect(url.toString());
  res.cookies.set('kamo_admin_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}

export const dynamic = 'force-dynamic';
