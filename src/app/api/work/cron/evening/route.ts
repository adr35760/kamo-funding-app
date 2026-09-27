import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { notifyGroup } from '@/lib/work-notify';
import { isBusinessDay, jstDateIso } from '@/lib/work-date';

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

  if (!isBusinessDay(today)) {
    return NextResponse.json(
      { ok: true, date: today, skipped: '休日のため送信しない' },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    const [usersRes, reportsRes] = await Promise.all([
      supabase.from('work_users').select('id, name, role, is_active'),
      supabase.from('work_reports').select('user_id, submitted_at').eq('report_date', today),
    ]);

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
