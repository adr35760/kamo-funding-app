import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { notifyGroup } from '@/lib/work-notify';
import { formatJaDate, jstDateIso, shiftDateIso } from '@/lib/work-date';
import { meetingLines } from '@/lib/work-schedule';

/**
 * GET /api/work/cron/evening — 終業 21:00 JST（= 12:00 UTC）
 *
 * 🔴 タイムゾーン: Vercel Cron は **UTC**。
 *   21:00 JST = 12:00 UTC → `"0 12 * * *"`
 *
 * やること: **翌日の会議の予告**。金曜 8:30 の BNI は朝9時の通知では間に合わないため、
 *   前日 21:00 に翌日分を出す。休日判定より前に置く（日曜夜→月曜分も出せるように）。
 *
 * 🔴 2026-10-09 t iku 指示「日報の指示出しはいったんすべて中止。…夜の日報送信はおこなわない」。
 *   この cron が送っていた **日報未提出リマインド（平日21:00）は撤去した**。
 *   再開するときは git の履歴からこのブロックを戻す。
 *   ※ 日報の提出通知（report_submitted）は管理者宛の記録通知であり「指示出し」ではないため残している。
 *   ※ 会議リマインドは対象外（残す）。
 */
export async function GET(request: NextRequest) {
  const authError = checkCronAuth(request);
  if (authError) return authError;

  const today = jstDateIso();
  const tomorrow = shiftDateIso(today, 1);

  let tomorrowMeetings: { sent: boolean; count: number } = { sent: false, count: 0 };
  try {
    const lines = meetingLines(tomorrow);
    if (lines.length > 0) {
      const sb = getSupabaseAdmin();
      const n = await notifyGroup(sb, {
        kind: 'meeting_reminder',
        dedupeKey: `meeting_tomorrow:${tomorrow}`,
        toName: null,
        lines: [`明日（${formatJaDate(tomorrow)}）の会議`, ...lines],
      });
      tomorrowMeetings = { sent: n.sent, count: lines.length };
    }
  } catch (e) {
    console.error('work/cron/evening: 翌日会議の予告に失敗:', e);
  }

  return NextResponse.json(
    {
      ok: true,
      date: today,
      daily_report_reminder: '停止中（t iku 指示 2026-10-09）',
      tomorrow_meetings: tomorrowMeetings,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

function checkCronAuth(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && !cronSecret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET が設定されていません' }, { status: 401 });
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
