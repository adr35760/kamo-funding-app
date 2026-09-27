import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkAdminOrSiteAdmin } from '@/lib/work-session';
import { isChatworkConfigured, parseChatworkRoomId } from '@/lib/chatwork';

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
    const isEmpty = raw === null || raw === undefined || String(raw).trim() === '';
    // 🔴 URLごと貼られても受け取る（users PATCH と同じ方針）
    const value = isEmpty ? null : parseChatworkRoomId(raw);
    if (!isEmpty && value === null) {
      return NextResponse.json(
        {
          success: false,
          error:
            'ルームIDを読み取れませんでした。グループを開いたときのURL（https://www.chatwork.com/#!rid123456789）をそのまま貼るか、末尾の数字だけを入力してください。',
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('work_settings')
      .upsert({ key: 'chatwork_group_room_id', value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (error) {
      console.error('work/settings PATCH error:', error.code, error.message);
      /**
       * 🔴 原因を名指しする（2026-09-27）。
       *   第2段のマイグレーション未実行だと work_settings が無く PGRST205 になる。
       *   「保存に失敗しました」だけだと、t iku さんは何をすればよいか分からない。
       */
      const missingTable = error.code === 'PGRST205' || error.code === '42P01';
      return NextResponse.json(
        {
          success: false,
          error: missingTable
            ? '通知グループの保存先テーブルがまだありません。第2段のマイグレーションSQL（migration-work-sprint2-...）を実行してください。個人チャットの登録は先に進められます。'
            : '保存に失敗しました',
          reason: missingTable ? 'migration_required' : 'db_error',
          code: error.code ?? null,
        },
        { status: missingTable ? 409 : 500 }
      );
    }
    return NextResponse.json({ success: true, group_room_id: value }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('work/settings PATCH failed:', err);
    return NextResponse.json({ success: false, error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
