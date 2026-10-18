import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendSurveyInviteEmail, surveyUrlFor } from '@/lib/email';
import { formatEventDateFullJa } from '@/lib/event-format';
import { getEventEndTime } from '@/lib/event-visibility';
import { logEmailResult } from '@/lib/email-log';

/**
 * GET /api/cron/survey-invites
 *
 * 掲載説明会後アンケートのご案内を **自動配信** する（Vercel Cron から呼び出し）。
 * vercel.json で毎日 UTC 0:00（= 日本時間 9:00）に実行する。
 *
 * 対象: **前日（日本時間）に終了した info_session** に申し込んだ方（status='registered'）。
 *       - 既にアンケート案内を送信済み（email_logs template_type='survey' status='sent'）の
 *         申込には送らない（二重送信防止）。
 *       - 宛先0人なら1通も送らない。
 *
 * 🔴 既存のリマインドcron（/api/cron/reminders）には一切触れない。
 *    - 別ルート・別cronとして追加する（既存cronを止めない）。
 *    - registrations.reminder_sent も更新しない。
 *
 * 認証: Authorization: Bearer <CRON_SECRET>（Vercel Cronは自動付与）
 *       開発環境（NODE_ENV=development）のみシークレットなしを許可。
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && !cronSecret) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET が設定されていません。Vercel環境変数に設定してください。' },
      { status: 401 }
    );
  }
  if (cronSecret) {
    const auth = request.headers.get('authorization') || '';
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
  } else if (isProd) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const now = new Date();

    // 日本時間の「今日 0:00」「昨日 0:00」を UTC で表す
    const tokyoFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric',
    });
    const parts = tokyoFmt.formatToParts(now);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const todayStartUtc = new Date(
      Date.UTC(get('year'), get('month') - 1, get('day')) - 9 * 60 * 60 * 1000
    );
    const yesterdayStartUtc = new Date(todayStartUtc.getTime() - 24 * 60 * 60 * 1000);

    // 前日に終了した掲載説明会を拾う（開始が前日より最大1日早いものまで取得して終了時刻で判定）
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, title, event_date, duration_minutes, type')
      .eq('type', 'info_session')
      .gte('event_date', new Date(yesterdayStartUtc.getTime() - 24 * 60 * 60 * 1000).toISOString())
      .lt('event_date', todayStartUtc.toISOString());

    if (eventsError) {
      console.error('survey-invites: events query error:', eventsError);
      return NextResponse.json({ ok: false, error: eventsError.message }, { status: 500 });
    }

    const targets = (events ?? []).filter((e) => {
      const end = getEventEndTime(e).getTime();
      return end >= yesterdayStartUtc.getTime() && end < todayStartUtc.getTime();
    });

    if (targets.length === 0) {
      return NextResponse.json({
        ok: true,
        checkedAt: now.toISOString(),
        window: { from: yesterdayStartUtc.toISOString(), to: todayStartUtc.toISOString() },
        events: 0,
        sent: 0,
        skipped: 0,
        failed: [],
      });
    }

    let sent = 0;
    let skipped = 0;
    const failed: string[] = [];
    const perEvent: Array<{ title: string; sent: number; skipped: number; failed: number }> = [];

    for (const ev of targets) {
      const { data: regs, error: regErr } = await supabase
        .from('registrations')
        .select('id, name, email, status')
        .eq('event_id', ev.id)
        .eq('status', 'registered');

      if (regErr) {
        console.error(`survey-invites: registrations query error (${ev.id}):`, regErr);
        perEvent.push({ title: ev.title, sent: 0, skipped: 0, failed: 0 });
        continue;
      }
      const active = regs ?? [];
      if (active.length === 0) {
        perEvent.push({ title: ev.title, sent: 0, skipped: 0, failed: 0 });
        continue;
      }

      // 既に送信済みの申込を除外（二重送信防止）
      const ids = active.map((r) => r.id as string);
      const alreadySent = new Set<string>();
      {
        const { data: logs, error: logErr } = await supabase
          .from('email_logs')
          .select('registration_id')
          .in('registration_id', ids)
          .eq('template_type', 'survey')
          .eq('status', 'sent');
        if (logErr) {
          console.error(`survey-invites: email_logs query error (${ev.id}):`, logErr);
          // 既送判定ができないときは送らない（二重送信のほうが害が大きい）
          skipped += active.length;
          perEvent.push({ title: ev.title, sent: 0, skipped: active.length, failed: 0 });
          continue;
        }
        for (const l of logs ?? []) alreadySent.add(l.registration_id as string);
      }

      const eventTitle = ev.title;
      const eventDateFullJa = formatEventDateFullJa(ev.event_date, ev.duration_minutes);
      const surveyUrl = surveyUrlFor(ev.id);

      const seen = new Set<string>();
      let evSent = 0;
      let evSkipped = 0;
      let evFailed = 0;

      for (const r of active) {
        if (alreadySent.has(r.id as string)) { evSkipped++; continue; }
        const key = String(r.email ?? '').trim().toLowerCase();
        if (!key.includes('@')) { evSkipped++; continue; }
        if (seen.has(key)) { evSkipped++; continue; }
        seen.add(key);

        const res = await sendSurveyInviteEmail(r.name as string, String(r.email).trim(), eventTitle, eventDateFullJa, surveyUrl);
        await logEmailResult({
          registrationId: r.id as string,
          templateType: 'survey',
          success: res.success,
          error: res.success ? undefined : res.error,
        });
        if (res.success) {
          evSent++;
          sent++;
        } else {
          evFailed++;
          failed.push(String(r.email));
          console.error(`survey-invites: send failed for ${r.email}:`, res.error);
          // 🔴 失敗時は 'sent' ログが残らないので、翌日以降の実行で自動的に再試行される
        }
      }

      skipped += evSkipped;
      perEvent.push({ title: eventTitle, sent: evSent, skipped: evSkipped, failed: evFailed });
    }

    return NextResponse.json({
      ok: true,
      checkedAt: now.toISOString(),
      window: { from: yesterdayStartUtc.toISOString(), to: todayStartUtc.toISOString() },
      events: targets.length,
      sent,
      skipped,
      failed,
      perEvent,
    });
  } catch (err) {
    console.error('survey-invites cron error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'アンケート案内の配信に失敗しました' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
