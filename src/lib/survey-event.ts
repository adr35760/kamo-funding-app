import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getEventEndTime } from '@/lib/event-visibility';
import { formatEventDateFullJa } from '@/lib/event-format';

/**
 * アンケート回答ページ（/survey）が対象にする「掲載説明会」を解決する。
 *
 * 仕様（PMブリーフ 2026-10-17 / 差し替え 2026-10-18）:
 *  - `?event=<event_id>` が有効ならその回を対象にする。
 *  - 未指定・不正なID・存在しないIDは **エラーにせず直近の終了済み info_session にフォールバック**する。
 *    （配布メールのリンクが壊れていても、回答者をエラー画面で止めない）
 *
 * 🔴 終了判定は event_date + duration_minutes（絶対時刻）で行う。
 *    ブラウザ時計に依存させない。
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SurveyEventInfo {
  id: string;
  title: string;
  /** 例: 2026年10月14日（水）19:30〜21:00 */
  eventDateFullJa: string;
}

interface EventRow {
  id: string;
  title: string;
  event_date: string;
  duration_minutes: number | null;
  type: string;
}

function toInfo(row: EventRow): SurveyEventInfo {
  return {
    id: row.id,
    title: row.title,
    eventDateFullJa: formatEventDateFullJa(row.event_date, row.duration_minutes),
  };
}

/**
 * 対象イベントを解決する。解決できなければ null（ページ側で案内を出す）。
 * DB に到達できない場合も例外を投げず null を返す（公開ページを壊さない）。
 */
export async function resolveSurveyEvent(
  requestedEventId: string | null | undefined,
  now: Date = new Date()
): Promise<SurveyEventInfo | null> {
  const cols = 'id, title, event_date, duration_minutes, type';
  try {
    const supabase = getSupabaseAdmin();

    // 1) 指定IDが有効ならそれを採用（終了前でも、リンクで指定された回を尊重する）
    if (requestedEventId && UUID_RE.test(requestedEventId.trim())) {
      const { data, error } = await supabase
        .from('events')
        .select(cols)
        .eq('id', requestedEventId.trim())
        .maybeSingle();
      if (!error && data) return toInfo(data as EventRow);
      // エラー・存在しないIDはフォールバックへ（エラー画面にしない）
    }

    // 2) 直近の「終了済み」掲載説明会（info_session）
    const { data, error } = await supabase
      .from('events')
      .select(cols)
      .eq('type', 'info_session')
      .order('event_date', { ascending: false })
      .limit(50);
    if (error || !data) return null;

    const finished = (data as EventRow[]).find(
      (e) => getEventEndTime(e).getTime() <= now.getTime()
    );
    return finished ? toInfo(finished) : null;
  } catch {
    return null;
  }
}
