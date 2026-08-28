import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendReminderEmail } from '@/lib/email';
import { formatEventDateJa } from '@/lib/event-format';

/**
 * GET /api/cron/reminders
 *
 * 開催当日リマインドメール自動配信（Vercel Cron Jobs から呼び出し）
 *
 * 動作モード（REMINDER_MODE 環境変数で切替、デフォルト sameday）:
 * - sameday（Hobbyプラン用・推奨）: cron を毎日 UTC 0:00（= 日本時間9:00）に実行し、
 *   日本時間「当日」開催の全イベントの申込者に朝一括でリマインドメールを送信
 * - window（Proプラン用）: 開催開始時刻の約15分前〜60分前に送信
 *
 * 共通:
 * 1. 対象イベント（status=upcoming）を抽出
 * 2. 申込済み（status=registered）で reminder_sent=false の登録者にリマインドメールを送信
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

    // 動作モード: REMINDER_MODE=sameday（デフォルト・Hobbyプラン用）| window（Proプラン用）
    const mode = (process.env.REMINDER_MODE || 'sameday').toLowerCase();

    let sinceIso: string;
    let untilIso: string;

    if (mode === 'window') {
      // window モード: 開催開始時刻が [now - behindMin, now + aheadMin] のイベント
      // 開始の15分前〜60分前に届く（Proプランで15分間隔cron実行時に使用）
      const aheadMin = Number(process.env.REMINDER_AHEAD_MINUTES || 15);
      const behindMin = Number(process.env.REMINDER_BEHIND_MINUTES || 60);
      sinceIso = new Date(now.getTime() - behindMin * 60_000).toISOString();
      untilIso = new Date(now.getTime() + aheadMin * 60_000).toISOString();
    } else {
      // sameday モード（Hobby用）: 日本時間「当日」開催の全イベントに朝一括送信
      // cron を毎日 UTC 0:00（= 日本時間 9:00）に実行する前提
      const tokyoFmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric',
      });
      const parts = tokyoFmt.formatToParts(now);
      const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
      const y = get('year');
      const m = get('month');
      const d = get('day');
      // 日本時間 0:00 = UTC 前日 15:00
      const dayStartUtc = Date.UTC(y, m - 1, d) - 9 * 60 * 60 * 1000;
      sinceIso = new Date(dayStartUtc).toISOString();
      untilIso = new Date(dayStartUtc + 24 * 60 * 60 * 1000).toISOString();
    }

    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, title, event_date, duration_minutes')
      .eq('status', 'upcoming')
      .gte('event_date', sinceIso)
      .lte('event_date', untilIso);

    if (eventsError) {
      console.error('Reminder: events query error:', eventsError);
      return NextResponse.json({ ok: false, error: eventsError.message }, { status: 500 });
    }

    if (!events || events.length === 0) {
      return NextResponse.json({ ok: true, mode, checkedAt: now.toISOString(), reminded: 0, skipped: 0 });
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

    // ---- 開催済みイベントを completed に落とす（リマインド送信の「後」に実行） ----
    // 順序が重要: 先にステータスを更新すると当日のイベントが送信対象から消える。
    // 対象は「日本時間の当日0:00より前に開始したイベント」= 当日分は絶対に含めない。
    const completed = await markPastEventsCompleted(supabase, now);

    return NextResponse.json({
      ok: true,
      mode,
      checkedAt: now.toISOString(),
      events: events.length,
      targetRegistrations: (registrations || []).length,
      reminded,
      failed,
      completedEvents: completed,
    });
  } catch (err) {
    console.error('Reminder cron error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'リマインド処理に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * 開催が終わったイベントの status を 'upcoming' → 'completed' にする。
 *
 * - 判定境界は「日本時間の当日 0:00」。当日開催のイベントは対象外なので、
 *   リマインド送信対象を消してしまう事故が起きない。
 * - status の値は events テーブルの CHECK 制約
 *   ('draft','upcoming','live','completed','cancelled') に合わせている。
 * - 必ずリマインド送信処理の「後」に呼ぶこと。
 */
async function markPastEventsCompleted(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  now: Date
): Promise<{ count: number; ids: string[] }> {
  try {
    const tokyoFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric',
    });
    const parts = tokyoFmt.formatToParts(now);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    // 日本時間の当日 0:00 を UTC で表した時刻（= UTC 前日 15:00）
    const todayStartUtc = new Date(
      Date.UTC(get('year'), get('month') - 1, get('day')) - 9 * 60 * 60 * 1000
    ).toISOString();

    const { data, error } = await supabase
      .from('events')
      .update({ status: 'completed' })
      .eq('status', 'upcoming')
      .lt('event_date', todayStartUtc)
      .select('id');

    if (error) {
      console.error('markPastEventsCompleted failed:', error);
      return { count: 0, ids: [] };
    }
    const ids = (data || []).map((e: { id: string }) => e.id);
    return { count: ids.length, ids };
  } catch (err) {
    console.error('markPastEventsCompleted error:', err);
    return { count: 0, ids: [] };
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
