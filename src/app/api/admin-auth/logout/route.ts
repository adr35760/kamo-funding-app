import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from '@/lib/admin-auth';

/**
 * GET /api/admin-auth/logout — ログアウト
 *
 * 共用PCで開いたままにしないための出口。Cookieを消して案内ページへ戻す。
 * 誰がログアウトしたかも記録に残す。
 */
export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (session) console.info(`admin-auth: ログアウト email=${session.email}`);

  const res = NextResponse.redirect(new URL('/admin/login', request.nextUrl.origin));
  res.cookies.set(ADMIN_SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}

export const dynamic = 'force-dynamic';
