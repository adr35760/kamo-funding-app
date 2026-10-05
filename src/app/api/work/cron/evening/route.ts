import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { notifyGroup } from '@/lib/work-notify';
import { formatJaDate, isBusinessDay, jstDateIso, shiftDateIso } from '@/lib/work-date';
import { meetingLines } from '@/lib/work-schedule';

/**
 * GET /api/work/cron/evening — 終業 21:00 JST（= 12:00 UTC）
 *
 * 🔴 タイムゾーン: Vercel Cron は **UTC**。
 *   21:00 JST = 12:00 UTC → `"0 12 * * *"`
 *
 * やること: **日報を出していないメンバーへのリマインド**（1通にまとめる）。
 *   PRD の終業時刻は 21:00 JST（t iku 確定）。
 *
 * 土日は送らない（営業日のみ）。
 */
export async function GET(request: NextRequest) {
  const authError = checkCronAuth(request);
  if (authError) return authError;

  const today = jstDateIso();

  /**
   * 🔴 翌日の会議の予告（2026-10-05）。金曜 8:30 の BNI は朝9時の通知では間に合わないため、
   *   前日 21:00 に翌日分を出す。休日判定より前に置く（日曜夜→月曜分も出せるように）。
   *   失敗しても日報リマインドは続ける。
   */
  let tomorrowMeetings: { sent: boolean; count: number } = { sent: false, count: 0 };
  try {
    const tomorrow = shiftDateIso(today, 1);
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
    console.error('work/cron/evening: 翌日会議の予告に失敗（日報リマインドは継続）:', e);
  }

  if (!isBusinessDay(today)) {
    return NextResponse.json(
      { ok: true, date: today, skipped: '休日のため日報リマインドは送信しない', tomorrow_meetings: tomorrowMeetings },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    const [usersRes, reportsRes] = await Promise.all([
      supabase.from('work_users').select('id, name, role, is_active'),
      supabase.from('work_reports').select('user_id, submitted_at').eq('report_date', today),
    ]);

    /**
     * 🔴 提出状況が**読めなかったときは通知しない**（2026-09-27 追加）。
     *
     *   `work_reports` が存在しない（第2段SQL未実行）と reportsRes.error に
     *   PGRST205 が入り、data は null になる。これを `?? []` で空扱いすると
     *   「全員未提出」と判定され、**事実と違う「未提出3名」の督促がグループに飛ぶ**。
     *   セットアップ手順ではトークン設定がSQL実行より先に来ることがあり得るので、
     *   実際に起こる。督促は人に対する通知なので、誤報は信頼を落とす。
     *   → 読めなかったら黙って終わる（通知しないほうが安全側）。
     */
    if (reportsRes.error) {
      console.error(
        'work/cron/evening: 提出状況が読めないため通知しない:',
        reportsRes.error.code,
        reportsRes.error.message
      );
      return NextResponse.json(
        {
          ok: true,
          date: today,
          skipped: '日報テーブルを読めないため通知しない（マイグレーション未実行の可能性）',
          error_code: reportsRes.error.code,
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }
    if (usersRes.error) {
      console.error('work/cron/evening: 利用者が読めないため通知しない:', usersRes.error.code);
      return NextResponse.json(
        { ok: true, date: today, skipped: '利用者を読めないため通知しない', error_code: usersRes.error.code },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const members = (usersRes.data ?? []).filter(u => u.is_active && u.role === 'member');
    const submitted = new Set(
      (reportsRes.data ?? []).filter(r => r.submitted_at).map(r => r.user_id)
    );

    const pending = members.filter(u => !submitted.has(u.id));

    if (pending.length === 0) {
      return NextResponse.json(
        { ok: true, date: today, pending: 0, message: '全員提出済み' },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 🔴 1件ずつ飛ばさず1通にまとめる（通知が多いと無視される）
    const notice = await notifyGroup(supabase, {
      kind: 'report_reminder',
      dedupeKey: `report_reminder:${today}`,
      toName: null,
      lines: [
        `日報が未提出です（${today}）`,
        ...pending.map(u => `・${u.name} さん`),
        '',
        '業務管理システムの日報画面から提出してください。完了した項目は自動で入っています。',
      ],
    });

    return NextResponse.json(
      {
        ok: true,
        date: today,
        pending: pending.length,
        pending_names: pending.map(u => u.name),
        notified: notice.sent,
        notify_reason: notice.reason ?? null,
        tomorrow_meetings: tomorrowMeetings,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('work/cron/evening failed:', err);
    return NextResponse.json(
      { ok: false, error: 'cron failed', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    );
  }
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
