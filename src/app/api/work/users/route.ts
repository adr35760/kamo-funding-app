import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkAdmin, requireWorkAdminOrSiteAdmin } from '@/lib/work-session';

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

  /**
   * 🔴 ログイン画面の選択肢は**何があっても500を返さない**（2026-09-27 修正）。
   *
   *   `getSupabaseAdmin()` は環境変数が無いと**クエリを投げる前に例外を投げる**ため、
   *   下の `if (error)` の空配列フォールバックには到達せず、外側の catch で500になっていた。
   *   ログイン画面が500で真っ白になると**誰も業務を始められない**ので、
   *   取得できない理由（設定漏れ・SQL未実行・DB障害）を問わず空配列を返し、
   *   画面には「利用者が登録されていません」と出す。原因はログに残す。
   */
  if (forLogin) {
    const emptyList = () =>
      NextResponse.json({ users: [] }, { headers: { 'Cache-Control': 'no-store' } });
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('work_users')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) {
        console.error('work/users login list error:', error.code, error.message);
        return emptyList();
      }
      return NextResponse.json(
        { users: data ?? [] },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    } catch (err) {
      // 環境変数未設定など、クエリ以前の失敗もここで受ける
      console.error('work/users login list failed before query:', err);
      return emptyList();
    }
  }

  // ここから下は管理者のみ（管理画面の利用者一覧）
  try {
    const auth = await requireWorkAdmin(request);
    if ('response' in auth) return auth.response;

    const supabase = getSupabaseAdmin();
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
  /**
   * 🔴 初回設定のため、既存サイト管理者でも通す（work-session.ts の鶏と卵の説明）。
   *   room_id が未登録だと誰も /work にログインできず、この画面にも入れない。
   */
  const auth = await requireWorkAdminOrSiteAdmin(request);
  if ('response' in auth) return auth.response;

  try {
    const body = await request.json();
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    if (!id) {
      return NextResponse.json({ success: false, error: '利用者IDが必要です' }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    if ('chatwork_room_id' in body) {
      const room = normalizeOrNull(body.chatwork_room_id);
      // Chatwork の room_id は数字のみ。誤入力（URLごと貼る等）を弾く
      if (room !== null && !/^\d+$/.test(room)) {
        return NextResponse.json(
          { success: false, error: 'ルームIDは数字で入力してください（URL末尾 #!rid●●●● の数字部分）' },
          { status: 400 }
        );
      }
      patch.chatwork_room_id = room;
    }
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
