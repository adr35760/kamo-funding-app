import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkAdmin } from '@/lib/work-session';

/**
 * GET /api/work/users — 利用者一覧
 *
 * 2つの用途があり、**返す情報量を分けている**。
 *
 *  1. `?for=login`（認証不要）… ログイン画面の名前の選択肢。
 *     🔴 id と name だけ返す。役割もチャットワークのルームIDもメールも返さない。
 *        ログイン前に見える情報を最小限にするため。
 *
 *  2. 引数なし（管理者のみ）… 管理画面の利用者一覧。
 *     chatwork_room_id の設定状況まで返す（未設定だとログインリンクが送れないため）。
 */
export async function GET(request: NextRequest) {
  const forLogin = request.nextUrl.searchParams.get('for') === 'login';

  try {
    const supabase = getSupabaseAdmin();

    if (forLogin) {
      const { data, error } = await supabase
        .from('work_users')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) {
        console.error('work/users login list error:', error.code);
        return NextResponse.json({ users: [] }, { headers: { 'Cache-Control': 'no-store' } });
      }
      return NextResponse.json({ users: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
    }

    // ここから下は管理者のみ
    const auth = await requireWorkAdmin(request);
    if ('response' in auth) return auth.response;

    const { data, error } = await supabase
      .from('work_users')
      .select('id, name, role, chatwork_room_id, chatwork_account_id, email, is_active, created_at')
      .order('role')
      .order('name');
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message, users: [] },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return NextResponse.json({ success: true, users: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('API /work/users error:', err);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました', users: [] },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

/**
 * PATCH /api/work/users — 利用者のチャットワーク設定を更新（管理者のみ）
 *
 * Body: { id, chatwork_room_id?, chatwork_account_id?, email? }
 *
 * 業務Botアカウントを作ったあと、各人の個人チャットのルームIDを入れるために使う。
 * 🔴 通知用グループのIDを入れてはいけない（なりすまし防止）。画面側にも注意を出している。
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireWorkAdmin(request);
  if ('response' in auth) return auth.response;

  try {
    const body = await request.json();
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    if (!id) {
      return NextResponse.json({ success: false, error: '利用者IDが必要です' }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    if ('chatwork_room_id' in body) patch.chatwork_room_id = normalizeOrNull(body.chatwork_room_id);
    if ('chatwork_account_id' in body) patch.chatwork_account_id = normalizeOrNull(body.chatwork_account_id);
    if ('email' in body) patch.email = normalizeOrNull(body.email);
    if ('is_active' in body) patch.is_active = !!body.is_active;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ success: false, error: '更新する項目がありません' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('work_users')
      .update(patch)
      .eq('id', id)
      .select('id, name, role, chatwork_room_id, chatwork_account_id, email, is_active')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ success: false, error: '該当する利用者がいません' }, { status: 404 });
    }
    return NextResponse.json({ success: true, user: data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('API /work/users PATCH error:', err);
    return NextResponse.json({ success: false, error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}

function normalizeOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

export const dynamic = 'force-dynamic';
