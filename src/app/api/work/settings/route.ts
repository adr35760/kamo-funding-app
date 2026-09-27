import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkAdminOrSiteAdmin } from '@/lib/work-session';
import { isChatworkConfigured } from '@/lib/chatwork';

/**
 * GET   /api/work/settings — 設定と4名のroom_id登録状況
 * PATCH /api/work/settings — 通知グループのroom_idを保存
 *
 * 初回設定のため、業務管理adminだけでなく既存サイト管理者でも通す
 * （room_id が無いと誰も /work にログインできないため。work-session.ts 参照）。
 *
 * 🔴 CHATWORK_API_TOKEN の**値は絶対に返さない**。設定済みかどうかだけ返す。
 */
export async function GET(request: NextRequest) {
  const auth = await requireWorkAdminOrSiteAdmin(request);
  if ('response' in auth) return auth.response;

  const empty = {
    success: true,
    chatwork_configured: isChatworkConfigured(),
    group_room_id: null as string | null,
    users: [] as unknown[],
  };

  try {
    const supabase = getSupabaseAdmin();

    const [settingsRes, usersRes] = await Promise.all([
      supabase.from('work_settings').select('key, value'),
      supabase.from('work_users').select('id, name, role, chatwork_room_id, is_active').order('role').order('name'),
    ]);

    const groupRoomId =
      settingsRes.data?.find(s => s.key === 'chatwork_group_room_id')?.value ?? null;

    return NextResponse.json(
      {
        success: true,
        chatwork_configured: isChatworkConfigured(),
        group_room_id: groupRoomId,
        users: usersRes.data ?? [],
        // マイグレーション未実行などで読めなかった場合も画面を壊さない
        settings_error: settingsRes.error?.code ?? null,
        users_error: usersRes.error?.code ?? null,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    // 🔴 クライアント生成の例外もここで受ける（第1段で踏んだ穴と同じ形）
    console.error('work/settings GET failed:', err);
    return NextResponse.json(empty, { headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireWorkAdminOrSiteAdmin(request);
  if ('response' in auth) return auth.response;

  try {
    const body = await request.json();
    const raw = body?.group_room_id;
    const value = raw === null || raw === undefined ? null : String(raw).trim() || null;

    // room_id は数字のみ（Chatworkの仕様）。誤入力を弾く
    if (value !== null && !/^\d+$/.test(value)) {
      return NextResponse.json(
        { success: false, error: 'ルームIDは数字で入力してください（URL末尾 #!rid●●●● の数字部分）' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('work_settings')
      .upsert({ key: 'chatwork_group_room_id', value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (error) {
      console.error('work/settings PATCH error:', error.code, error.message);
      return NextResponse.json({ success: false, error: '保存に失敗しました' }, { status: 500 });
    }
    return NextResponse.json({ success: true, group_room_id: value }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('work/settings PATCH failed:', err);
    return NextResponse.json({ success: false, error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
