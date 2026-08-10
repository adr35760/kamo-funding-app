import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendReminderEmail } from '@/lib/email';
import { formatEventDateJa } from '@/lib/event-format';

/**
 * GET /api/cron/reminders
 *
 * 開催当日リマインドメール自動配信（Vercel Cron Jobs から呼び出し）
 *
 * ロジック:
 * 1. 現在時刻から「リマインド対象ウィンドウ」内に開催開始時刻が含まれるイベントを取得
 *    （ウィンドウ: REMINDER_WINDOW_MINUTES（デフォルト60分）前〜次の実行まで）
 * 2. そのイベントに申込済み（status=registered）で、まだ reminder_sent=false の登録者に
 *    リマインドメールを送信
 * 3. 送信成功したら reminder_sent=true に更新（重複送信防止）
 *
 * 認証: Authorization: Bearer <CRON_SECRET>（Vercel Cronは自動付与）
 * ローカル実行時は CRON_SECRET 未設定なら許可（開発用）
 */
export async function GET(request: NextRequest) {
  // 認証チェック
  // 本番では CRON_SECRET 必須（Vercel Cronは自動で Authorization: Bearer <CRON_SECRET> を付与）
  // 開発環境（NODE_ENV=development）のみシークレットなしを許可
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

    // リマインド対象ウィンドウ: 開催開始時刻が [now - behindMin, now + aheadMin] のイベント
    // aheadMin: 開始の少し前（例 15分前）に届くよう前方ウィンドウ
    // behindMin: 実行間隔が空いた・遅延した場合でも漏らさないための後方ウィンドウ
    // ※dedupは reminder_sent フラグで行うため、複数回実行されても重複送信は起きない
    const aheadMin = Number(process.env.REMINDER_AHEAD_MINUTES || 15);
    const behindMin = Number(process.env.REMINDER_BEHIND_MINUTES || 60);
    const windowStart = new Date(now.getTime() - behindMin * 60_000).toISOString();
    const windowEnd = new Date(now.getTime() + aheadMin * 60_000).toISOString();

    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, title, event_date, duration_minutes')
      .eq('status', 'upcoming')
      .gte('event_date', windowStart)
      .lte('event_date', windowEnd);

    if (eventsError) {
      console.error('Reminder: events query error:', eventsError);
      return NextResponse.json({ ok: false, error: eventsError.message }, { status: 500 });
    }

    if (!events || events.length === 0) {
      return NextResponse.json({ ok: true, checkedAt: now.toISOString(), reminded: 0, skipped: 0 });
    }

    const eventIds = events.map((e: { id: string }) => e.id);
    const eventMap = new Map<string, { title: string; event_date: string; duration_minutes: number | null }>();
    events.forEach((e: { id: string; title: string; event_date: string; duration_minutes: number | null }) => {
      eventMap.set(e.id, { title: e.title, event_date: e.event_date, duration_minutes: e.duration_minutes });
    });

    // 対象イベントの申込者（未送信のみ）
    const { data: registrations, error: regsError } = await supabase
      .from('registrations')
      .select('id, name, email, event_id')
      .in('event_id', eventIds)
      .eq('status', 'registered')
      .eq('reminder_sent', false);

    if (regsError) {
      console.error('Reminder: registrations query error:', regsError);
      if (regsError.code === '42703') {
        // reminder_sent カラム未適用 — migration-reminder-sent.sql を実行する必要あり
        return NextResponse.json(
          {
            ok: false,
            needsMigration: true,
            error: 'registrations.reminder_sent カラムが存在しません。supabase/migration-reminder-sent.sql をSupabase SQL Editorで実行してください。',
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: false, error: regsError.message }, { status: 500 });
    }

    let reminded = 0;
    const failed: string[] = [];

    for (const reg of registrations || []) {
      const ev = eventMap.get(reg.event_id);
      if (!ev) continue;
      const eventDateJa = formatEventDateJa(ev.event_date, ev.duration_minutes);
      const result = await sendReminderEmail(reg.name, reg.email, ev.title, eventDateJa);
      if (!result.success) {
        console.error(`Reminder send failed for ${reg.email}:`, result.error);
        failed.push(reg.email);
        continue;
      }
      // 重複送信防止フラグを立てる
      const { error: updError } = await supabase
        .from('registrations')
        .update({ reminder_sent: true, updated_at: new Date().toISOString() })
        .eq('id', reg.id);
      if (updError) {
        console.error('Reminder flag update failed:', updError);
      }
      reminded++;
    }

    return NextResponse.json({
      ok: true,
      checkedAt: now.toISOString(),
      events: events.length,
      targetRegistrations: (registrations || []).length,
      reminded,
      failed,
    });
  } catch (err) {
    console.error('Reminder cron error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'リマインド処理に失敗しました' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
