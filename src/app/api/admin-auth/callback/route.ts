import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  createAdminSession,
  isAllowedAdminEmail,
  isGoogleLoginConfigured,
  normalize,
  timingSafeEqual,
  buildAdminRedirectUri,
} from '@/lib/admin-auth';

/**
 * GET /api/admin-auth/callback — Googleから戻ってくる先
 *
 * 流れ:
 *   1. state を突き合わせる（CSRF対策）
 *   2. 受け取ったコードをGoogleでトークンに交換する
 *   3. id_token からメールアドレスを取り出す
 *   4. **許可一覧に載っているかを確認**し、載っていれば署名付きCookieを発行
 *
 * 🔴 誰が入ったかをサーバーのログに残す（漏洩時に経路を追えるようにする）。
 *   拒否した試行も残す（許可していない人が入ろうとした事実が分かる）。
 */
export async function GET(request: NextRequest) {
  if (!isGoogleLoginConfigured()) {
    return errorPage('Googleログインが未設定です。管理者にお問い合わせください。', 503);
  }

  const { searchParams } = request.nextUrl;

  const googleError = searchParams.get('error');
  if (googleError) {
    // ユーザーがログインをキャンセルした場合もここに来る
    return errorPage('ログインが完了しませんでした。もう一度お試しください。', 400);
  }

  const state = searchParams.get('state') || '';
  const savedState = request.cookies.get('kamo_admin_oauth_state')?.value || '';
  if (!state || !savedState || !timingSafeEqual(state, savedState)) {
    console.warn('admin-auth: state mismatch（不正なログイン試行の可能性）');
    return errorPage('ログインの確認に失敗しました。お手数ですが最初からやり直してください。', 400);
  }

  const code = searchParams.get('code');
  if (!code) return errorPage('ログイン情報を受け取れませんでした。', 400);

  // コードをトークンに交換する
  let email = '';
  let emailVerified = false;
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: normalize(process.env.GOOGLE_CLIENT_ID),
        client_secret: normalize(process.env.GOOGLE_CLIENT_SECRET),
        redirect_uri: buildAdminRedirectUri(request.nextUrl.origin),
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      console.error('admin-auth: token exchange failed', tokenRes.status, await tokenRes.text());
      return errorPage('Googleとの通信に失敗しました。もう一度お試しください。', 502);
    }
    const token = (await tokenRes.json()) as { id_token?: string };
    const claims = decodeIdToken(token.id_token);
    email = String(claims?.email ?? '');
    emailVerified = claims?.email_verified === true || claims?.email_verified === 'true';
  } catch (err) {
    console.error('admin-auth: token exchange exception', err);
    return errorPage('Googleとの通信に失敗しました。もう一度お試しください。', 502);
  }

  if (!email || !emailVerified) {
    return errorPage('メールアドレスを確認できませんでした。', 400);
  }

  if (!isAllowedAdminEmail(email)) {
    // 🔴 許可していない人の試行は記録に残す
    console.warn(`admin-auth: 拒否 email=${email}`);
    return errorPage(
      `このアカウント（${escapeHtml(email)}）には管理画面の利用権限がありません。運営にお問い合わせください。`,
      403
    );
  }

  console.info(`admin-auth: ログイン成功 email=${email}`);

  const res = NextResponse.redirect(new URL('/admin', request.nextUrl.origin));
  res.cookies.set(ADMIN_SESSION_COOKIE, await createAdminSession(email), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });
  // 使い終わった state は消す
  res.cookies.set('kamo_admin_oauth_state', '', { path: '/', maxAge: 0 });
  return res;
}

/**
 * id_token（JWT）のペイロードを読む。
 *
 * 🔴 署名検証をここで省略できる理由: この id_token は**Googleのトークン
 *   エンドポイントからHTTPSで直接受け取ったもの**で、第三者を経由していない
 *   （クライアントシークレットで認証したうえでの応答）。ブラウザから
 *   渡されたトークンであれば署名検証が必須だが、この経路では不要。
 */
function decodeIdToken(idToken: string | undefined): Record<string, unknown> | null {
  if (!idToken) return null;
  const parts = idToken.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='));
    // メールアドレスに非ASCIIは通常入らないが、念のためUTF-8として読む
    const bytes = Uint8Array.from(json, c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/** 失敗理由を日本語で見せる小さなページ（JSONを生で見せない） */
function errorPage(message: string, status: number): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>管理画面ログイン</title></head>
<body style="font-family:'Noto Sans JP',sans-serif;background:#FAFAFA;margin:0;
 display:flex;align-items:center;justify-content:center;min-height:100vh;">
 <div style="background:#fff;border-radius:16px;padding:40px;max-width:420px;
  box-shadow:0 8px 40px rgba(0,0,0,.08);text-align:center;">
  <h1 style="font-size:18px;color:#1B2A4A;margin:0 0 12px;">ログインできませんでした</h1>
  <p style="font-size:14px;color:#555;line-height:1.8;margin:0 0 24px;">${message}</p>
  <a href="/api/admin-auth/login" style="display:inline-block;padding:12px 24px;
   border-radius:8px;background:#1B2A4A;color:#fff;text-decoration:none;
   font-size:14px;font-weight:700;">もう一度ログインする</a>
 </div>
</body></html>`;
  return new NextResponse(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );
}

export const dynamic = 'force-dynamic';
