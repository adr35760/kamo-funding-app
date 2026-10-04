import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkSession } from '@/lib/work-session';
import { notifyGroup } from '@/lib/work-notify';

/**
 * GET  /api/work/tasks — タスク一覧
 * POST /api/work/tasks — タスク作成（管理者のみ）
 *
 * 🔴 見える範囲はサーバー側で決める（画面の絞り込みに頼らない）:
 *   - member … **自分が担当のタスクだけ**。他人のタスクは1件も返さない。
 *   - admin  … 全件（担当者で絞り込みたいときは ?assignee=）
 *
 *   RLS は「anon キーでは0行」に設定してあり、このAPIは service role で読む。
 *   したがって**誰が何を見られるかはここの実装が唯一の砦**になる。
 */

/** 一覧・詳細で共通して返す列 */
const TASK_COLUMNS = `
  id, title, body, assignee_id, category_id, due_date, due_time,
  priority, status, created_by, created_at, accepted_at, done_at,
  confirmed_at, done_comment, estimated_minutes
`;
/** estimated_minutes 列が未作成（マイグレーション前）のときの退避用 */
const TASK_COLUMNS_LEGACY = TASK_COLUMNS.replace(', estimated_minutes', '');
const isMissingColumn = (e: { code?: string } | null) => e?.code === '42703' || e?.code === 'PGRST204';

export async function GET(request: NextRequest) {
  const auth = await requireWorkSession(request);
  if ('response' in auth) return auth.response;
  const { session } = auth;

  const params = request.nextUrl.searchParams;
  // 既定は「未完了のみ」（やることリストの既定に合わせる）
  const scope = params.get('scope') ?? 'open';

  try {
    const supabase = getSupabaseAdmin();
    const build = (cols: string) => {
    let query = supabase.from('work_tasks').select(cols);

    // 🔴 member は自分の担当に固定する。クエリで他人を指定されても効かせない。
    if (session.role !== 'admin') {
      query = query.eq('assignee_id', session.userId);
    } else {
      const assignee = params.get('assignee');
      if (assignee) query = query.eq('assignee_id', assignee);
    }

    if (scope === 'open') {
      // 未完了 = 未受領 + 対応中
      query = query.in('status', ['unaccepted', 'in_progress']);
    } else if (scope === 'done') {
      query = query.in('status', ['done', 'confirmed']);
    } else if (scope === 'unconfirmed') {
      // 管理者が「読んでいない完了報告」を拾うため
      query = query.eq('status', 'done');
    }

    // 期限が近い順。期限なしは後ろに回す
    query = query
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('due_time', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true });
    return query;
    };

    let { data, error } = await build(TASK_COLUMNS);
    if (isMissingColumn(error)) ({ data, error } = await build(TASK_COLUMNS_LEGACY));
    if (error) {
      console.error('work/tasks GET error:', error.code, error.message);
      return NextResponse.json(
        { success: false, error: 'タスクの取得に失敗しました', tasks: [] },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      { success: true, tasks: data ?? [], role: session.role, me: session.userId },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('API /work/tasks GET error:', err);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました', tasks: [] },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

/**
 * POST — タスク作成。**管理者のみ**（指示を出すのは t iku だけ）。
 * Body: { title, body?, assignee_id, category_id?, due_date?, due_time?, priority? }
 */
export async function POST(request: NextRequest) {
  /**
   * 管理者: 誰にでも指示を出せる（従来どおり）。
   * メンバー: **自分のタスクだけ**追加できる（t iku 指示 2026-10-05）。
   *   担当は本人に固定・状態は「対応中」から開始・通知は飛ばさない。
   */
  const auth = await requireWorkSession(request);
  if ('response' in auth) return auth.response;
  const isAdmin = auth.session.role === 'admin';

  try {
    const raw = await request.json();
    const title = typeof raw?.title === 'string' ? raw.title.trim() : '';
    if (!title) {
      return NextResponse.json({ success: false, error: 'タイトルは必須です' }, { status: 400 });
    }

    const priority = ['high', 'mid', 'low'].includes(raw?.priority) ? raw.priority : 'mid';

    const insertData: Record<string, unknown> = {
      title,
      body: normalizeOrNull(raw?.body),
      assignee_id: isAdmin ? normalizeOrNull(raw?.assignee_id) : auth.session.userId,
      category_id: toIntOrNull(raw?.category_id),
      due_date: normalizeOrNull(raw?.due_date),
      due_time: normalizeOrNull(raw?.due_time),
      priority,
      status: isAdmin && normalizeOrNull(raw?.assignee_id) !== auth.session.userId ? 'unaccepted' : 'in_progress',
      created_by: auth.session.userId,
    };
    const est = toIntOrNull(raw?.estimated_minutes);
    if (est && est > 0) insertData.estimated_minutes = est;

    const supabase = getSupabaseAdmin();
    let { data, error } = await supabase
      .from('work_tasks')
      .insert(insertData)
      .select(TASK_COLUMNS)
      .single();
    if (isMissingColumn(error)) {
      delete insertData.estimated_minutes;
      ({ data, error } = await supabase
        .from('work_tasks')
        .insert(insertData)
        .select(TASK_COLUMNS_LEGACY)
        .single());
    }

    if (error || !data) {
      console.error('work/tasks POST error:', error?.code, error?.message);
      return NextResponse.json(
        { success: false, error: 'タスクの作成に失敗しました' },
        { status: 500 }
      );
    }

    // 監査ログ。失敗してもタスク作成は成功として扱う（記録漏れで業務を止めない）
    await supabase
      .from('work_task_events')
      .insert({ task_id: data.id, user_id: auth.session.userId, event_type: 'created' })
      .then(r => {
        if (r.error) console.error('work_task_events insert failed:', r.error.code);
      });

    /**
     * 🔴 新しい指示の通知。**失敗してもタスク作成は成功として返す。**
     *   notifyGroup は throw しない作りだが、ここでも結果を待つだけで分岐させない。
     *   「通知が飛ばないとタスクが作れない」は第1段で申し送った禁じ手。
     */
    // 自分で自分に追加したタスクは通知しない
    if (data.assignee_id === auth.session.userId) {
      return NextResponse.json({ success: true, task: data, notified: false }, { headers: { 'Cache-Control': 'no-store' } });
    }

    let assigneeName: string | null = null;
    if (data.assignee_id) {
      const { data: u } = await supabase
        .from('work_users')
        .select('name')
        .eq('id', data.assignee_id)
        .maybeSingle();
      assigneeName = u?.name ?? null;
    }
    const notice = await notifyGroup(supabase, {
      kind: 'task_assigned',
      dedupeKey: `task_assigned:${data.id}`,
      toName: assigneeName,
      lines: [
        `新しい指示: ${data.title}`,
        data.due_date ? `期限 ${data.due_date}${data.due_time ? ' ' + String(data.due_time).slice(0, 5) : ''}` : '期限なし',
        '業務管理システムのやることリストから受領してください。',
      ],
    });

    return NextResponse.json(
      { success: true, task: data, notified: notice.sent, notify_reason: notice.reason ?? null },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('API /work/tasks POST error:', err);
    return NextResponse.json({ success: false, error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}

function normalizeOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function toIntOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export const dynamic = 'force-dynamic';
