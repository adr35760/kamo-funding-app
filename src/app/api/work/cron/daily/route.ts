import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { notifyGroup } from '@/lib/work-notify';
import {
  formatJaDate,
  isBusinessDay,
  isMonthEnd,
  jstDateIso,
  jstWeekday,
  shiftDateIso,
} from '@/lib/work-date';

/**
 * GET /api/work/cron/daily — 毎朝 09:00 JST（= 00:00 UTC）
 *
 * 🔴 タイムゾーン: Vercel Cron の schedule は **UTC**。
 *   09:00 JST = 00:00 UTC → `"0 0 * * *"`
 *   （JSTはUTC+9なので、JSTの時刻から9を引く。日付を跨ぐ場合に注意）
 *
 * やること:
 *   1. 繰り返しタスク（定例業務）の生成
 *   2. 期限が明日のタスクの予告（**担当者がいるものだけ**）
 *   3. 期限が今日のタスクの通知（**担当者がいるものだけ**）
 *
 * 🔴 2026-10-11 t iku 指示。
 *   ・「期限切れのリマインドを送らない」→ 期限切れ未完了のまとめ（overdue_digest）を撤去。
 *   ・「未割り当ては一旦削除で送らない」「担当者の指示が出たときのみ、毎朝リマインド」
 *     → **未割り当て（assignee_id なし）のタスクには通知しない**。
 *   ・「会議（前日21:00に翌日分／当日9:00に当日分）も中止」→ 当日会議リマインドを撤去。
 *   再開するときは git の履歴から戻す。
 *
 * 🔴 通知が飛ばなくてもタスク生成は行う（通知は補助機能）。
 */
export async function GET(request: NextRequest) {
  const authError = checkCronAuth(request);
  if (authError) return authError;

  const today = jstDateIso();
  const tomorrow = shiftDateIso(today, 1);
  const result = {
    date: today,
    generated: [] as string[],
    notified: [] as string[],
    skipped: [] as string[],
  };

  try {
    const supabase = getSupabaseAdmin();

    // ---- 1. 定例業務の生成 ----
    const { data: recurrences, error: recError } = await supabase
      .from('work_task_recurrences')
      .select('*')
      .eq('is_active', true);

    /**
     * 🔴 定例の定義が読めない（第2段SQL未実行）なら生成をあきらめる。
     *   ここは空扱いでも誤通知にはならないが、原因が分かるようログに残す。
     */
    if (recError) {
      console.error('work/cron/daily: 定例定義を読めない:', recError.code, recError.message);
      result.skipped.push(`recurrences(${recError.code})`);
    }

    for (const r of recurrences ?? []) {
      /**
       * 🔴 会議（remind_minutes_before あり＝9/27の「社員会議」「社内会議」）はタスクにしない。
       *   会議は WEEKLY_FIXED が唯一の定義で、リマインドもそちらから出す（2026-10-05）。
       *   DB行が残っていても二重・旧名称の通知にならないようコード側で除外する。
       */
      if (r.remind_minutes_before) continue;
      if (!shouldGenerate(r, today)) continue;
      // 二重生成は work_tasks(recurrence_id, due_date) のユニーク制約で防ぐ。
      // 競合時は 23505 が返るので、それは「既に生成済み」として扱う。
      const { error } = await supabase.from('work_tasks').insert({
        title: r.title,
        body: r.body,
        assignee_id: r.assignee_id,
        category_id: r.category_id,
        due_date: today,
        due_time: r.due_time,
        priority: r.priority,
        status: 'unaccepted',
        recurrence_id: r.id,
      });
      if (!error) result.generated.push(r.title);
      else if (error.code === '23505') result.skipped.push(`${r.title}(既に生成済み)`);
      else console.error('recurrence insert failed:', r.title, error.code, error.message);
    }

    // ---- 2〜4. 期限の通知 ----
    const { data: openTasks, error: taskError } = await supabase
      .from('work_tasks')
      .select('id, title, due_date, assignee_id, status')
      .in('status', ['unaccepted', 'in_progress']);

    /**
     * 🔴 タスクが読めなかったら期限の通知は出さない。
     *   空扱いにすると「期限切れ0件」と同じ見え方になり、
     *   本当は遅延があるのに通知されない（見逃しのほうが危険）ので、
     *   黙って0件通知するのではなく**読めなかった事実を返す**。
     */
    if (taskError) {
      console.error('work/cron/daily: タスクを読めないため期限通知を行わない:', taskError.code);
      return NextResponse.json(
        { ok: true, ...result, skipped: [...result.skipped, `tasks(${taskError.code})`] },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const { data: users } = await supabase.from('work_users').select('id, name');
    const nameOf = (id: string | null) =>
      (id && users?.find(u => u.id === id)?.name) || null;

    const tasks = openTasks ?? [];

    // 明日が期限（未割り当ては通知しない＝t iku 指示 2026-10-11）
    for (const t of tasks.filter(t => t.due_date === tomorrow && t.assignee_id)) {
      const r = await notifyGroup(supabase, {
        kind: 'due_tomorrow',
        dedupeKey: `due_tomorrow:${t.id}:${tomorrow}`,
        toName: nameOf(t.assignee_id),
        lines: [`明日が期限です: ${t.title}`, `期限 ${formatJaDate(tomorrow)}`],
      });
      if (r.sent) result.notified.push(`due_tomorrow:${t.title}`);
    }

    // 今日が期限（未割り当ては通知しない＝t iku 指示 2026-10-11）
    for (const t of tasks.filter(t => t.due_date === today && t.assignee_id)) {
      const r = await notifyGroup(supabase, {
        kind: 'due_today',
        dedupeKey: `due_today:${t.id}:${today}`,
        toName: nameOf(t.assignee_id),
        lines: [`本日が期限です: ${t.title}`],
      });
      if (r.sent) result.notified.push(`due_today:${t.title}`);
    }

    // ---- 当日の会議リマインドは撤去（t iku 指示 2026-10-11）----

    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('work/cron/daily failed:', err);
    return NextResponse.json(
      { ok: false, error: 'cron failed', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    );
  }
}

/** その定例を今日生成すべきか */
function shouldGenerate(
  r: { pattern: string; weekday: number | null },
  today: string
): boolean {
  if (r.pattern === 'daily') return isBusinessDay(today);
  if (r.pattern === 'weekly') return r.weekday !== null && jstWeekday(today) === r.weekday;
  if (r.pattern === 'monthly_end') return isMonthEnd(today);
  return false;
}

/**
 * Cronの認証。既存 `/api/cron/reminders` と同じ方式に合わせる
 * （`CRON_SECRET` を Vercel Cron が Authorization ヘッダで送る）。
 */
function checkCronAuth(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && !cronSecret) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET が設定されていません' },
      { status: 401 }
    );
  }
  if (cronSecret) {
    const auth = request.headers.get('authorization') || '';
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
  }
  return null;
}

export const dynamic = 'force-dynamic';
