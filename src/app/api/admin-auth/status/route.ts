import { NextResponse } from 'next/server';
import { allowedAdminEmails, isGoogleLoginConfigured, normalize } from '@/lib/admin-auth';

/**
 * GET /api/admin-auth/status — 設定の自己診断
 *
 * 🔴 なぜ作ったか（2026-09-18）:
 *   Googleログインが「準備できていません」と出たとき、**3つの環境変数のうち
 *   どれが足りないのかが分からず**、原因の切り分けができなかった。
 *   設定する人が自分で確認できるようにする。
 *
 * 🔴 値そのものは絶対に返さない。
 *   返すのは「設定されているか（true/false）」と、許可メールアドレスの**件数**、
 *   そして貼り間違いに気づける形式チェックの結果だけ。
 *   シークレットは長さすら出さない（設定の有無と先頭の形だけ）。
 */
export async function GET() {
  const clientId = normalize(process.env.GOOGLE_CLIENT_ID);
  const clientSecret = normalize(process.env.GOOGLE_CLIENT_SECRET);
  const emails = allowedAdminEmails();
  const rawEmails = normalize(process.env.ADMIN_ALLOWED_EMAILS);

  return NextResponse.json(
    {
      googleLoginReady: isGoogleLoginConfigured(),
      checks: {
        GOOGLE_CLIENT_ID: {
          set: Boolean(clientId),
          hint: clientId
            ? clientId.endsWith('.apps.googleusercontent.com')
              ? 'OK'
              : '形式が想定と違います。「.apps.googleusercontent.com」で終わる値か確認してください'
            : '未設定です',
        },
        GOOGLE_CLIENT_SECRET: {
          set: Boolean(clientSecret),
          hint: clientSecret
            ? clientSecret.startsWith('GOCSPX-')
              ? 'OK'
              : '形式が想定と違います。「GOCSPX-」で始まる値か確認してください（クライアントIDと入れ違っていませんか）'
            : '未設定です',
        },
        ADMIN_ALLOWED_EMAILS: {
          set: Boolean(rawEmails),
          count: emails.length,
          hint: !rawEmails
            ? '未設定です'
            : emails.length === 0
              ? '「@」を含むメールアドレスとして読み取れませんでした。書き方を確認してください'
              : `${emails.length}件のアドレスを認識しています`,
        },
      },
      redirectUri: 'https://kamo-funding-app.vercel.app/api/admin-auth/callback',
      note:
        'googleLoginReady が false の間は、従来のパスワード方式で管理画面が使えます。3つすべて設定して Redeploy すると切り替わります。',
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export const dynamic = 'force-dynamic';
