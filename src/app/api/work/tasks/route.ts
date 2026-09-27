import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkAdmin, requireWorkSession } from '@/lib/work-session';

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
  confirmed_at, done_comment
`;

export async function GET(request: NextRequest) {
  const auth = await requireWorkSession(request);
  if ('response' in auth) return auth.response;
  const { session } = auth;

  const params = request.nextUrl.searchParams;
  // 既定は「未完了のみ」（やることリストの既定に合わせる）
  const scope = params.get('scope') ?? 'open';

  try {
    const supabase = getSupabaseAdmin();
    let query = supabase.from('work_tasks').select(TASK_COLUMNS);

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

    const { data, error } = await query;
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
  const auth = await requireWorkAdmin(request);
  if ('response' in auth) return auth.response;

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
      assignee_id: normalizeOrNull(raw?.assignee_id),
      category_id: toIntOrNull(raw?.category_id),
      due_date: normalizeOrNull(raw?.due_date),
      due_time: normalizeOrNull(raw?.due_time),
      priority,
      status: 'unaccepted',
      created_by: auth.session.userId,
    };

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('work_tasks')
      .insert(insertData)
      .select(TASK_COLUMNS)
      .single();

    if (error) {
      console.error('work/tasks POST error:', error.code, error.message);
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

    return NextResponse.json({ success: true, task: data }, { headers: { 'Cache-Control': 'no-store' } });
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
