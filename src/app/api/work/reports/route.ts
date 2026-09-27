import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkSession } from '@/lib/work-session';
import { jstDateIso, jstDayEndUtc, jstDayStartUtc } from '@/lib/work-date';
import { notifyGroup } from '@/lib/work-notify';

/**
 * GET  /api/work/reports — 日報の取得（下書き＋自動集計）
 * POST /api/work/reports — 日報の提出
 *
 * 🔴 設計の要: **自動で埋まる欄は手で書かせない。**
 *   「本日完了した項目／対応中の項目／期限を過ぎた項目」はタスクから毎回集計する。
 *   ここが崩れると日報は続かない（PRDの設計思想）。
 *
 * 🔴 未提出のまま日付が変わった場合は**未提出として残す**（PM判断を委ねられた点）。
 *   理由: 成功基準に「日報の提出率100%」があるので、後から埋めさせるより
 *   「出ていない」という事実を残すほうが運用上正しい。翌日以降も日付を指定して提出できる。
 */

interface TaskSnapshot {
  id: string;
  title: string;
  due_date: string | null;
  done_comment?: string | null;
}

export async function GET(request: NextRequest) {
  const auth = await requireWorkSession(request);
  if ('response' in auth) return auth.response;
  const { session } = auth;

  const params = request.nextUrl.searchParams;
  const dateIso = params.get('date') || jstDateIso();
  // admin は他人の日報も読める（一覧用）。member は自分だけ
  const targetUserId =
    session.role === 'admin' && params.get('user_id') ? params.get('user_id')! : session.userId;
  const listMode = params.get('list') === '1';

  try {
    const supabase = getSupabaseAdmin();

    if (listMode) {
      // 過去分の一覧。admin は全員、member は自分のみ
      let q = supabase
        .from('work_reports')
        .select('id, user_id, report_date, submitted_at, read_at, comment')
        .order('report_date', { ascending: false })
        .limit(60);
      if (session.role !== 'admin') q = q.eq('user_id', session.userId);
      const { data, error } = await q;
      if (error) {
        console.error('work/reports list error:', error.code, error.message);
        return NextResponse.json({ success: true, reports: [] }, { headers: { 'Cache-Control': 'no-store' } });
      }
      return NextResponse.json({ success: true, reports: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
    }

    // 既存の日報（あれば）
    const { data: existing } = await supabase
      .from('work_reports')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('report_date', dateIso)
      .maybeSingle();

    // 提出済みなら保存済みスナップショットをそのまま返す（当時の内容を変えない）
    if (existing?.submitted_at) {
      return NextResponse.json(
        { success: true, date: dateIso, report: existing, auto: null, submitted: true },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 未提出なら、いまのタスクから自動集計して返す
    const auto = await collectAuto(supabase, targetUserId, dateIso);

    return NextResponse.json(
      { success: true, date: dateIso, report: existing ?? null, auto, submitted: false },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('work/reports GET failed:', err);
    return NextResponse.json(
      { success: false, error: '日報を取得できませんでした', report: null, auto: null },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireWorkSession(request);
  if ('response' in auth) return auth.response;
  const { session } = auth;

  try {
    const body = await request.json();
    const dateIso = typeof body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? body.date
      : jstDateIso();

    const supabase = getSupabaseAdmin();

    // 提出時点のスナップショットを作る
    const auto = await collectAuto(supabase, session.userId, dateIso);

    const row = {
      user_id: session.userId,
      report_date: dateIso,
      comment: trimOrNull(body?.comment),
      blockers: trimOrNull(body?.blockers),
      tomorrow: trimOrNull(body?.tomorrow),
      done_tasks: auto.done,
      ongoing_tasks: auto.ongoing,
      overdue_tasks: auto.overdue,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('work_reports')
      .upsert(row, { onConflict: 'user_id,report_date' })
      .select('*')
      .single();

    if (error) {
      console.error('work/reports POST error:', error.code, error.message);
      return NextResponse.json({ success: false, error: '日報の提出に失敗しました' }, { status: 500 });
    }

    /**
     * 🔴 管理者への通知は**失敗しても日報提出を成功として返す**。
     *   notifyGroup は throw しない作りだが、ここでも結果を無視して先へ進む。
     *   通知が飛ばないだけで提出が失敗するのは、第1段で申し送った禁じ手。
     */
    const notice = await notifyGroup(supabase, {
      kind: 'report_submitted',
      dedupeKey: `report_submitted:${session.userId}:${dateIso}`,
      toName: null,
      lines: [
        `日報が提出されました（${dateIso}）`,
        `提出者: ${await userName(supabase, session.userId)}`,
        `完了 ${auto.done.length}件 / 対応中 ${auto.ongoing.length}件 / 期限超過 ${auto.overdue.length}件`,
      ],
    });

    return NextResponse.json(
      { success: true, report: data, notified: notice.sent, notify_reason: notice.reason ?? null },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('work/reports POST failed:', err);
    return NextResponse.json({ success: false, error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}

/**
 * 日報の自動欄を集計する。
 *   done    … その日（JST）に完了したもの
 *   ongoing … 対応中のもの
 *   overdue … 期限がその日より前で未完了のもの
 */
async function collectAuto(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  dateIso: string
): Promise<{ done: TaskSnapshot[]; ongoing: TaskSnapshot[]; overdue: TaskSnapshot[] }> {
  const empty = { done: [], ongoing: [], overdue: [] };
  try {
    const { data, error } = await supabase
      .from('work_tasks')
      .select('id, title, due_date, status, done_at, done_comment')
      .eq('assignee_id', userId);

    if (error || !data) {
      console.error('collectAuto error:', error?.code, error?.message);
      return empty;
    }

    const dayStart = new Date(jstDayStartUtc(dateIso)).getTime();
    const dayEnd = new Date(jstDayEndUtc(dateIso)).getTime();

    const done: TaskSnapshot[] = [];
    const ongoing: TaskSnapshot[] = [];
    const overdue: TaskSnapshot[] = [];

    for (const t of data) {
      const snap: TaskSnapshot = {
        id: t.id,
        title: t.title,
        due_date: t.due_date,
        done_comment: t.done_comment ?? null,
      };
      const isDone = t.status === 'done' || t.status === 'confirmed';
      if (isDone && t.done_at) {
        const at = new Date(t.done_at).getTime();
        if (at >= dayStart && at < dayEnd) done.push(snap);
        continue;
      }
      if (isDone) continue;
      if (t.status === 'in_progress') ongoing.push(snap);
      // 期限切れ（未完了で、期限がその日より前）
      if (t.due_date && t.due_date < dateIso) overdue.push(snap);
    }

    return { done, ongoing, overdue };
  } catch (e) {
    console.error('collectAuto failed:', e);
    return empty;
  }
}

async function userName(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string
): Promise<string> {
  try {
    const { data } = await supabase.from('work_users').select('name').eq('id', userId).maybeSingle();
    return data?.name ?? '不明';
  } catch {
    return '不明';
  }
}

function trimOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

export const dynamic = 'force-dynamic';
