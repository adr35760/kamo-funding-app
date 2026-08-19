import { getSupabaseAdmin } from '@/lib/supabase-admin';

export interface SeminarEventRow {
  id: string;
  title: string;
  event_date: string;
  pillar?: number;
  duration_minutes?: number | null;
  location?: string | null;
  capacity?: number | null;
}

/**
 * 指定 pillar の開催予定イベントをサーバー側で取得する。
 * LPの初期HTMLに日程を含めるために使う（クライアント取得待ちの
 * 「読み込み中」表示をユーザーに見せないため）。
 * 失敗時は空配列を返し、クライアント側の /api/events フォールバックに委ねる。
 */
export async function fetchSeminarEvents(pillar: number): Promise<SeminarEventRow[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('events')
      .select('id, title, event_date, pillar, duration_minutes, location, capacity')
      .eq('status', 'upcoming')
      .eq('pillar', pillar)
      .order('event_date', { ascending: true });
    if (error || !data) return [];
    return data as SeminarEventRow[];
  } catch {
    return [];
  }
}
