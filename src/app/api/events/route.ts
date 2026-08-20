import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { filterVisibleEvents, isEventFinished } from '@/lib/event-visibility';

/**
 * GET /api/events
 * 
 * イベント一覧を取得する（LPの申込フォームのevent_id select用）。
 * Supabase未接続時は空配列を返す（LP側でフォールバック表示）。
 * 
 * Response: { events: [{ id, title, event_date, type, pillar, location, capacity, duration_minutes, finished }] }
 *
 * 開催終了済み（開始+所要時間を過ぎた）イベントはサーバー側で除外する。
 * PAST_EVENT_DISPLAY=mark_done の場合は除外せず finished:true で返す。
 */
export async function GET() {
  try {
    let events: Array<{
      id: string;
      title: string;
      event_date: string;
      type: string;
      pillar: number;
      location: string | null;
      capacity: number | null;
      duration_minutes: number | null;
      finished: boolean;
    }> = [];

    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'upcoming')
        .order('event_date', { ascending: true });

      if (!error && data) {
        // サーバー時刻（JST基準の絶対時刻比較）で開催終了済みを除外する。
        // 'mark_done' モードでは除外せず finished フラグで区別する。
        const visible = filterVisibleEvents(
          data as unknown as Array<{ event_date: string; duration_minutes?: number | null }>
        ) as unknown as Array<Record<string, unknown>>;
        events = visible.map((e: Record<string, unknown>) => ({
          id: e.id as string,
          title: e.title as string,
          event_date: e.event_date as string,
          type: e.type as string,
          pillar: e.pillar as number,
          location: (e.location as string) || null,
          capacity: (e.capacity as number) || null,
          duration_minutes: (e.duration_minutes as number | null) || null,
          finished: isEventFinished({
            event_date: e.event_date as string,
            duration_minutes: (e.duration_minutes as number | null) ?? null,
          }),
        }));
      }
    } catch {
      // Supabase未接続 — 空配列を返す
    }

    return NextResponse.json({ events });
  } catch {
    return NextResponse.json({ events: [] }, { status: 200 });
  }
}

// Always fetch fresh data — events change frequently
export const dynamic = 'force-dynamic';
export const revalidate = 0;
