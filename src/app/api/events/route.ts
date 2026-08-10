import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/events
 * 
 * イベント一覧を取得する（LPの申込フォームのevent_id select用）。
 * Supabase未接続時は空配列を返す（LP側でフォールバック表示）。
 * 
 * Response: { events: [{ id, title, event_date, type, pillar, location, capacity, duration_minutes }] }
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
    }> = [];

    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'upcoming')
        .order('event_date', { ascending: true });

      if (!error && data) {
        events = data.map((e: Record<string, unknown>) => ({
          id: e.id as string,
          title: e.title as string,
          event_date: e.event_date as string,
          type: e.type as string,
          pillar: e.pillar as number,
          location: (e.location as string) || null,
          capacity: (e.capacity as number) || null,
          duration_minutes: (e.duration_minutes as number | null) || null,
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
