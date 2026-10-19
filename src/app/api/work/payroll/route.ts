import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkSession } from '@/lib/work-session';
import { jstDateIso, jstDayStartUtc, jstWeekday, shiftDateIso } from '@/lib/work-date';
import {
  FIXED_ITEMS,
  FIXED_MONTHLY_MINUTES,
  FIXED_MONTHLY_YEN,
  FIXED_WEEKLY_MINUTES,
  findIncentiveRate,
  incentiveYen,
  workedMinutes,
} from '@/lib/work-pay';

/**
 * GET /api/work/payroll?month=YYYY-MM[&user_id=]
 *
 * 固定給75,000円（月65時間）とインセンティブの実績を、その月ぶんまとめて返す。
 *   - member … 自分の分だけ（user_id は無視する）
 *   - admin  … 指定した人の分（未指定なら自分の分）
 *
 * 🔴 金額は保存済みの単価×数量、または売上×料率で出す（画面からは金額を送らせない）。
 * 🔴 制度の列がまだ無いときは needs_migration を返し、0円・0時間と断定しない。
 */
interface Row {
  id: string;
  title: string;
  status: string;
  work_kind?: string | null;
  fixed_item_code?: string | null;
  incentive_code?: string | null;
  unit_rate?: number | null;
  unit_count?: number | null;
  rate_percent?: number | string | null;
  sales_base?: number | null;
  actual_minutes?: number | null;
  estimated_minutes?: number | null;
  due_date?: string | null;
  done_at?: string | null;
}

const NEW_COLUMNS =
  'id, title, status, work_kind, fixed_item_code, incentive_code, unit_rate, unit_count, rate_percent, sales_base, actual_minutes, estimated_minutes, due_date, done_at';
const LEGACY_COLUMNS = 'id, title, status, estimated_minutes, due_date, done_at';

export async function GET(request: NextRequest) {
  const auth = await requireWorkSession(request);
  if ('response' in auth) return auth.response;
  const { session } = auth;

  const params = request.nextUrl.searchParams;
  const monthParam = params.get('month');
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? '') ? monthParam! : jstDateIso().slice(0, 7);
  const targetUserId =
    session.role === 'admin' && params.get('user_id') ? params.get('user_id')! : session.userId;

  const monthStart = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  const nextMonthStart = `${nextMonth}-01`;
  const startIso = jstDayStartUtc(monthStart);
  const endIso = jstDayStartUtc(nextMonthStart);

  const today = jstDateIso();
  const weekStart = shiftDateIso(today, -((jstWeekday(today) + 6) % 7));
  const weekStartIso = jstDayStartUtc(weekStart);
  const weekEndIso = jstDayStartUtc(shiftDateIso(weekStart, 7));

  try {
    const supabase = getSupabaseAdmin();

    const [{ data: user }, first] = await Promise.all([
      supabase.from('work_users').select('id, name').eq('id', targetUserId).maybeSingle(),
      supabase.from('work_tasks').select(NEW_COLUMNS).eq('assignee_id', targetUserId),
    ]);

    let rows = (first.data ?? []) as unknown as Row[];
    let needsMigration = false;
    if (first.error) {
      if (first.error.code === '42703' || first.error.code === 'PGRST204') {
        needsMigration = true;
        const legacy = await supabase
          .from('work_tasks')
          .select(LEGACY_COLUMNS)
          .eq('assignee_id', targetUserId);
        rows = (legacy.data ?? []) as unknown as Row[];
      } else {
        console.error('work/payroll tasks error:', first.error.code, first.error.message);
        return NextResponse.json(
          { success: false, error: '実績を取得できませんでした' },
          { status: 500, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }

    const inRange = (iso: string | null | undefined, from: string, to: string) =>
      !!iso && iso >= from && iso < to;
    const isDone = (r: Row) => r.status === 'done' || r.status === 'confirmed';
    const isIncentive = (r: Row) => r.work_kind === 'incentive';

    const fixedDone = rows.filter(r => !isIncentive(r) && isDone(r) && inRange(r.done_at, startIso, endIso));
    const usedMinutes = fixedDone.reduce((a, r) => a + workedMinutes(r), 0);
    const weekUsedMinutes = rows
      .filter(r => !isIncentive(r) && isDone(r) && inRange(r.done_at, weekStartIso, weekEndIso))
      .reduce((a, r) => a + workedMinutes(r), 0);
    const plannedMinutes = rows
      .filter(
        r =>
          !isIncentive(r) &&
          !isDone(r) &&
          !!r.due_date &&
          r.due_date >= monthStart &&
          r.due_date < nextMonthStart
      )
      .reduce((a, r) => a + (r.estimated_minutes ?? 0), 0);

    const byItem = FIXED_ITEMS.map(item => ({
      code: item.code,
      no: item.no,
      name: item.name,
      minutes: rows
        .filter(r => !isIncentive(r) && r.fixed_item_code === item.code && isDone(r) && inRange(r.done_at, startIso, endIso))
        .reduce((a, r) => a + workedMinutes(r), 0),
    })).filter(x => x.minutes > 0);

    const toItem = (r: Row, done: boolean) => ({
      id: r.id,
      title: r.title,
      code: r.incentive_code ?? '',
      name: findIncentiveRate(r.incentive_code)?.name ?? r.title,
      yen: incentiveYen(r),
      minutes: workedMinutes(r),
      done,
    });
    const incentiveRows = rows.filter(isIncentive);
    const confirmed = incentiveRows
      .filter(r => isDone(r) && inRange(r.done_at, startIso, endIso))
      .map(r => toItem(r, true));
    const pending = incentiveRows.filter(r => !isDone(r)).map(r => toItem(r, false));
    const confirmedYen = confirmed.reduce((a, x) => a + x.yen, 0);
    const incentiveMinutes = [...confirmed, ...pending].reduce((a, x) => a + x.minutes, 0);

    return NextResponse.json(
      {
        success: true,
        needs_migration: needsMigration,
        month,
        user: { id: targetUserId, name: user?.name ?? '' },
        fixed: {
          budgetMinutes: FIXED_MONTHLY_MINUTES,
          weeklyBudgetMinutes: FIXED_WEEKLY_MINUTES,
          monthlyYen: FIXED_MONTHLY_YEN,
          usedMinutes,
          plannedMinutes,
          remainingMinutes: FIXED_MONTHLY_MINUTES - usedMinutes,
          weekUsedMinutes,
          weekStart,
          byItem,
        },
        incentive: { confirmedYen, pendingYen: pending.reduce((a, x) => a + x.yen, 0), confirmed, pending, minutes: incentiveMinutes },
        totalMinutes: usedMinutes + incentiveMinutes,
        totalYen: FIXED_MONTHLY_YEN + confirmedYen,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('work/payroll failed:', err);
    return NextResponse.json(
      { success: false, error: '実績を取得できませんでした' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export const dynamic = 'force-dynamic';
