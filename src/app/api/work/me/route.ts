import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkSession } from '@/lib/work-session';
import { WORK_SESSION_COOKIE } from '@/lib/work-auth';

/**
 * GET /api/work/me — ログイン中の本人情報
 * 画面が「誰としてログインしているか」を出すために使う。
 */
export async function GET(request: NextRequest) {
  const auth = await requireWorkSession(request);
  if ('response' in auth) return auth.response;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('work_users')
      .select('id, name, role, is_active')
      .eq('id', auth.session.userId)
      .maybeSingle();

    // 無効化された利用者のCookieを生かしておかない
    if (error || !data || !data.is_active) {
      const res = NextResponse.json(
        { success: false, error: 'ログインが必要です', login: '/work/login' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
      res.cookies.set(WORK_SESSION_COOKIE, '', { path: '/', maxAge: 0 });
      return res;
    }

    return NextResponse.json(
      { success: true, user: { id: data.id, name: data.name, role: data.role } },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('API /work/me error:', err);
    return NextResponse.json({ success: false, error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}

/** DELETE /api/work/me — ログアウト（Cookieを消すだけ） */
export async function DELETE() {
  const res = NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  res.cookies.set(WORK_SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}

export const dynamic = 'force-dynamic';
