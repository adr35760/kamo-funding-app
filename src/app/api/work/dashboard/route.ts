import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkAdmin } from '@/lib/work-session';
import { jstDateIso, jstDayEndUtc, jstDayStartUtc } from '@/lib/work-date';

/**
 * GET /api/work/dashboard — 管理者ダッシュボードの集計（admin のみ）
 *
 * 返すもの（PRD 3.7 の第2段ぶん）:
 *   - 今日の状況: 未受領 / 対応中 / 遅延 / 本日完了 の件数
 *   - 人別の抱え件数と遅延件数
 *   - 今日の日報（未読が上）
 *   - admin 未確認の完了報告の件数（バッジ用）
 *
 * 集計はサーバーで行う。画面に全件返して数えさせると、件数が増えたとき重くなる。
 */
export async function GET(request: NextRequest) {
  const auth = await requireWorkAdmin(request);
  if ('response' in auth) return auth.response;

  const today = request.nextUrl.searchParams.get('date') || jstDateIso();

  try {
    const supabase = getSupabaseAdmin();

    const [tasksRes, usersRes, reportsRes] = await Promise.all([
      supabase.from('work_tasks').select('id, assignee_id, status, due_date, done_at'),
      supabase.from('work_users').select('id, name, role, is_active').order('name'),
      supabase
        .from('work_reports')
        .select('id, user_id, report_date, submitted_at, read_at, comment, blockers, tomorrow, done_tasks, ongoing_tasks, overdue_tasks')
        .eq('report_date', today),
    ]);

    const tasks = tasksRes.data ?? [];
    const users = (usersRes.data ?? []).filter(u => u.is_active);
    const reports = reportsRes.data ?? [];

    const dayStart = new Date(jstDayStartUtc(today)).getTime();
    const dayEnd = new Date(jstDayEndUtc(today)).getTime();

    const isOpen = (s: string) => s === 'unaccepted' || s === 'in_progress';
    const doneToday = (t: { status: string; done_at: string | null }) => {
      if (t.status !== 'done' && t.status !== 'confirmed') return false;
      if (!t.done_at) return false;
      const at = new Date(t.done_at).getTime();
      return at >= dayStart && at < dayEnd;
    };
    const isOverdue = (t: { status: string; due_date: string | null }) =>
      isOpen(t.status) && !!t.due_date && t.due_date < today;

    const summary = {
      unaccepted: tasks.filter(t => t.status === 'unaccepted').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      overdue: tasks.filter(isOverdue).length,
      done_today: tasks.filter(doneToday).length,
      // 完了しているが admin が確認していないもの（バッジ用）
      unconfirmed: tasks.filter(t => t.status === 'done').length,
    };

    const perUser = users.map(u => {
      const mine = tasks.filter(t => t.assignee_id === u.id);
      const report = reports.find(r => r.user_id === u.id);
      return {
        id: u.id,
        name: u.name,
        role: u.role,
        open: mine.filter(t => isOpen(t.status)).length,
        overdue: mine.filter(isOverdue).length,
        done_today: mine.filter(doneToday).length,
        report_submitted: !!report?.submitted_at,
      };
    });

    // 未読が上、その次に提出が新しい順
    const todayReports = reports
      .filter(r => r.submitted_at)
      .sort((a, b) => {
        const unreadA = a.read_at ? 1 : 0;
        const unreadB = b.read_at ? 1 : 0;
        if (unreadA !== unreadB) return unreadA - unreadB;
        return String(b.submitted_at).localeCompare(String(a.submitted_at));
      })
      .map(r => ({
        ...r,
        user_name: users.find(u => u.id === r.user_id)?.name ?? '不明',
      }));

    // 日報を出していないメンバー（21:00リマインドの対象と同じ判定）
    const notSubmitted = users
      .filter(u => u.role === 'member')
      .filter(u => !reports.find(r => r.user_id === u.id && r.submitted_at))
      .map(u => ({ id: u.id, name: u.name }));

    return NextResponse.json(
      {
        success: true,
        date: today,
        summary,
        per_user: perUser,
        today_reports: todayReports,
        report_not_submitted: notSubmitted,
        // マイグレーション未実行などは画面に出して原因が分かるようにする
        errors: {
          tasks: tasksRes.error?.code ?? null,
          users: usersRes.error?.code ?? null,
          reports: reportsRes.error?.code ?? null,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('work/dashboard failed:', err);
    return NextResponse.json(
      { success: false, error: 'ダッシュボードを取得できませんでした' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

/** PATCH /api/work/dashboard — 日報を既読にする */
export async function PATCH(request: NextRequest) {
  const auth = await requireWorkAdmin(request);
  if ('response' in auth) return auth.response;

  try {
    const body = await request.json();
    const id = typeof body?.report_id === 'string' ? body.report_id.trim() : '';
    if (!id) return NextResponse.json({ success: false, error: '日報IDが必要です' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('work_reports')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .is('read_at', null);

    if (error) {
      return NextResponse.json({ success: false, error: '更新に失敗しました' }, { status: 500 });
    }
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('work/dashboard PATCH failed:', err);
    return NextResponse.json({ success: false, error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
