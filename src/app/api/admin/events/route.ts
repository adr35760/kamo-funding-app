import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { isEventFinished } from '@/lib/event-visibility';

/**
 * GET /api/admin/events — 管理画面用のイベント一覧
 *
 * 公開側の /api/events は「開催終了済み」を除外するが、
 * 管理画面は**当日の運営・フォロー連絡・実績集計**のため
 * **過去日程も含めて全件**返す必要がある。
 * そのため公開APIとは分離している。
 *
 * 認証: middleware の Basic 認証で /api/admin/* 全体を保護済み。
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: false });

    if (error) {
      return NextResponse.json({ events: [], error: error.message });
    }

    const events = (data || []).map((e: Record<string, unknown>) => ({
      ...e,
      finished: isEventFinished({
        event_date: e.event_date as string,
        duration_minutes: (e.duration_minutes as number | null) ?? null,
      }),
    }));

    return NextResponse.json({ events });
  } catch {
    return NextResponse.json({ events: [] });
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
