import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  createWorkSession,
  hashLoginToken,
  isWorkAuthConfigured,
  WORK_SESSION_COOKIE,
  WORK_SESSION_TTL_SECONDS,
  type WorkRole,
} from '@/lib/work-auth';

/**
 * POST /api/work/login-verify — ワンタイムトークンを検証してセッションを発行
 *
 * Body: { token: string }
 *
 * 🔴 ここも認証を通さない（ログインの入口）。守るべき点:
 *   - トークンは**ハッシュで照合**する（DBに平文が無い）
 *   - **期限切れ**（expires_at < now）は拒否
 *   - **使用済み**（used_at が入っている）は拒否 = 1回限り
 *   - 成功したら即 used_at を埋める（同じリンクの二度目を通さない）
 *   - 失敗理由は細かく返さない（トークンの当たり判定を外から探れないようにする）
 */
export async function POST(request: NextRequest) {
  if (!isWorkAuthConfigured()) {
    return NextResponse.json(
      { success: false, error: 'ログインは現在利用できません（サーバー設定が未完了です）' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  let token = '';
  try {
    const body = await request.json();
    token = typeof body?.token === 'string' ? body.token.trim() : '';
  } catch {
    token = '';
  }

  const reject = () =>
    NextResponse.json(
      {
        success: false,
        error: 'このログインリンクは使えません。期限切れか、すでに使用済みです。もう一度ログインしてください。',
      },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );

  if (!token) return reject();

  try {
    const supabase = getSupabaseAdmin();
    const tokenHash = await hashLoginToken(token);

    const { data: row, error } = await supabase
      .from('work_login_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (error || !row) return reject();
    if (row.used_at) return reject();                       // 1回使用で失効
    if (new Date(row.expires_at).getTime() < Date.now()) return reject(); // 10分で失効

    const { data: user, error: userError } = await supabase
      .from('work_users')
      .select('id, name, role, is_active')
      .eq('id', row.user_id)
      .maybeSingle();

    if (userError || !user || !user.is_active) return reject();

    // 🔴 使用済みにする。ここを先に行い、同じリンクの再利用を確実に止める。
    //   used_at が NULL の行だけを更新するので、同時に2回来ても1回しか通らない。
    const { data: consumed, error: consumeError } = await supabase
      .from('work_login_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', row.id)
      .is('used_at', null)
      .select('id');

    if (consumeError || !consumed || consumed.length === 0) return reject();

    const role: WorkRole = user.role === 'admin' ? 'admin' : 'member';
    const sessionValue = await createWorkSession(user.id, role);

    const res = NextResponse.json(
      { success: true, user: { id: user.id, name: user.name, role } },
      { headers: { 'Cache-Control': 'no-store' } }
    );
    res.cookies.set(WORK_SESSION_COOKIE, sessionValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: WORK_SESSION_TTL_SECONDS,
    });
    return res;
  } catch (err) {
    console.error('API /work/login-verify error:', err);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export const dynamic = 'force-dynamic';
