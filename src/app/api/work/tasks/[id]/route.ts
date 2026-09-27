import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkSession } from '@/lib/work-session';

/**
 * PATCH /api/work/tasks/:id — 状態遷移（受領・完了・確認・差し戻し）
 *
 * Body: { action: 'accept' | 'done' | 'confirm' | 'reopen', comment?: string }
 *
 * 🔴 誰が何を押せるかはサーバーで判定する:
 *   - accept / done … **そのタスクの担当者本人**のみ（admin も自分担当なら可）
 *   - confirm       … **admin のみ**（＝報告を読んだ証跡なので本人には押させない）
 *   - reopen        … **admin のみ**（差し戻し）
 *
 * 🔴 状態の順序も強制する。`unaccepted` から直接 `done` にはしない
 *   （受領の記録が飛ぶと「見たのか」が分からなくなる）。
 *   ただし現場で「受領を押さずに終わった」は起きるので、
 *   done を押したとき未受領なら **accepted_at も同時に埋める**（記録を残したうえで1タップを許す）。
 */

const TASK_COLUMNS = `
  id, title, body, assignee_id, category_id, due_date, due_time,
  priority, status, created_by, created_at, accepted_at, done_at,
  confirmed_at, done_comment
`;

type Action = 'accept' | 'done' | 'confirm' | 'reopen';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWorkSession(request);
  if ('response' in auth) return auth.response;
  const { session } = auth;

  const taskId = String(params.id ?? '').trim();
  if (!taskId) {
    return NextResponse.json({ success: false, error: 'タスクIDが必要です' }, { status: 400 });
  }

  let action: Action | '' = '';
  let comment: string | null = null;
  try {
    const body = await request.json();
    action = ['accept', 'done', 'confirm', 'reopen'].includes(body?.action) ? body.action : '';
    comment = typeof body?.comment === 'string' && body.comment.trim() ? body.comment.trim() : null;
  } catch {
    action = '';
  }
  if (!action) {
    return NextResponse.json({ success: false, error: '操作が不正です' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: task, error: fetchError } = await supabase
      .from('work_tasks')
      .select('id, assignee_id, status')
      .eq('id', taskId)
      .maybeSingle();

    if (fetchError || !task) {
      return NextResponse.json({ success: false, error: 'タスクが見つかりません' }, { status: 404 });
    }

    const isAdmin = session.role === 'admin';
    const isAssignee = task.assignee_id === session.userId;

    // 🔴 member は自分のタスク以外に触れない（存在も知らせない）
    if (!isAdmin && !isAssignee) {
      return NextResponse.json({ success: false, error: 'タスクが見つかりません' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {};

    if (action === 'accept') {
      if (!isAssignee) {
        return NextResponse.json(
          { success: false, error: '受領は担当者本人のみ行えます' },
          { status: 403 }
        );
      }
      if (task.status !== 'unaccepted') {
        return NextResponse.json({ success: false, error: 'すでに受領済みです' }, { status: 409 });
      }
      patch.status = 'in_progress';
      patch.accepted_at = now;
    } else if (action === 'done') {
      if (!isAssignee) {
        return NextResponse.json(
          { success: false, error: '完了は担当者本人のみ行えます' },
          { status: 403 }
        );
      }
      if (task.status === 'done' || task.status === 'confirmed') {
        return NextResponse.json({ success: false, error: 'すでに完了しています' }, { status: 409 });
      }
      patch.status = 'done';
      patch.done_at = now;
      // 受領を押さずに完了した場合も、受領の時刻を残す（一覧から1タップで完了できるようにするため）
      if (task.status === 'unaccepted') patch.accepted_at = now;
      // 🔴 コメントは任意。空でも完了させる（強制すると押されなくなる）
      if (comment) patch.done_comment = comment;
    } else if (action === 'confirm') {
      if (!isAdmin) {
        return NextResponse.json(
          { success: false, error: '確認済みにできるのは管理者のみです' },
          { status: 403 }
        );
      }
      if (task.status !== 'done') {
        return NextResponse.json(
          { success: false, error: '完了していないタスクは確認できません' },
          { status: 409 }
        );
      }
      patch.status = 'confirmed';
      patch.confirmed_at = now;
    } else {
      // reopen（差し戻し）
      if (!isAdmin) {
        return NextResponse.json(
          { success: false, error: '差し戻しは管理者のみ行えます' },
          { status: 403 }
        );
      }
      patch.status = 'in_progress';
      patch.done_at = null;
      patch.confirmed_at = null;
    }

    const { data: updated, error: updateError } = await supabase
      .from('work_tasks')
      .update(patch)
      .eq('id', taskId)
      .select(TASK_COLUMNS)
      .single();

    if (updateError) {
      console.error('work/tasks PATCH error:', updateError.code, updateError.message);
      return NextResponse.json({ success: false, error: '更新に失敗しました' }, { status: 500 });
    }

    // 監査ログ（誰がいつ押したか）。失敗しても操作自体は成立させる
    const eventType =
      action === 'accept' ? 'accepted' : action === 'done' ? 'done' : action === 'confirm' ? 'confirmed' : 'reopened';
    await supabase
      .from('work_task_events')
      .insert({ task_id: taskId, user_id: session.userId, event_type: eventType, note: comment })
      .then(r => {
        if (r.error) console.error('work_task_events insert failed:', r.error.code);
      });

    return NextResponse.json({ success: true, task: updated }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('API /work/tasks/:id PATCH error:', err);
    return NextResponse.json({ success: false, error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
