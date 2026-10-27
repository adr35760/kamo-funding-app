import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { filterVisibleEvents, isEventFinished, filterPublicEventTypes } from '@/lib/event-visibility';

export interface SeminarEventRow {
  id: string;
  title: string;
  event_date: string;
  /** info_session / seminar / networking（公開側は info_session を除外する） */
  type?: string | null;
  pillar?: number;
  duration_minutes?: number | null;
  location?: string | null;
  capacity?: number | null;
  /** 開催終了済みか（mark_done モード時にバッジ表示で使う） */
  finished?: boolean;
}

export interface PublicEventState {
  events: SeminarEventRow[];
  /**
   * DBからの取得に成功したか。
   * 🔴 「0件」と「読めなかった」を区別するために返す（MEMORYの定石）。
   *    true かつ 0件 → 公開日程は本当に無い（＝フォームを出さず個別相談へ差し替える）
   *    false → 取得失敗（クライアント側の /api/events フォールバックに委ねる）
   */
  resolved: boolean;
}

/**
 * 公開ページ用: 指定 pillar の開催予定イベントを取得する。
 *
 * 2026-10-27 t iku決定「B＝申込があったときだけ開催」により、
 * 公開側では info_session（掲載説明会）を**表示しない**。
 * DBの events 行・status・capacity は変更しない（管理画面では全件見える）。
 */
export async function fetchSeminarEventState(pillar: number): Promise<PublicEventState> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('events')
      .select('id, title, type, event_date, pillar, duration_minutes, location, capacity')
      .eq('status', 'upcoming')
      .eq('pillar', pillar)
      .order('event_date', { ascending: true });
    if (error || !data) return { events: [], resolved: false };

    // ① 公開しない種別を落とす（info_session）→ ② 開催終了済みを落とす
    const publicRows = filterPublicEventTypes(data as SeminarEventRow[]);
    const visible = filterVisibleEvents(publicRows).map(e => ({
      ...e,
      finished: isEventFinished(e),
    }));
    return { events: visible, resolved: true };
  } catch {
    return { events: [], resolved: false };
  }
}

/**
 * 指定 pillar の開催予定イベントをサーバー側で取得する（公開表示用の配列だけ）。
 * LPの初期HTMLに日程を含めるために使う（クライアント取得待ちの
 * 「読み込み中」表示をユーザーに見せないため）。
 * 失敗時は空配列を返し、クライアント側の /api/events フォールバックに委ねる。
 *
 * 「本当に0件」と「取得失敗」を区別したいページは fetchSeminarEventState を使う。
 */
export async function fetchSeminarEvents(pillar: number): Promise<SeminarEventRow[]> {
  return (await fetchSeminarEventState(pillar)).events;
}
