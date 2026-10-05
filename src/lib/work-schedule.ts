import type { SupabaseClient } from '@supabase/supabase-js';
import { jstDayEndUtc, jstDayStartUtc, jstWeekday } from '@/lib/work-date';

/**
 * 日報に出す「その日の日程」。
 *
 * 1. 毎週の定例（社内ミーティング・EXPO・BNI）… 下の WEEKLY_FIXED で固定（t iku 指定 2026-10-03）
 * 2. イベント（掲載説明会・オンラインセミナー・交流会・アワード等）… 既存の events 表から自動
 *
 * 🔴 DBに新しい表は作らない。イベントは公開サイトと同じ events 表を正とする（二重管理しない）。
 */

export interface ScheduleItem {
  time: string; // "18:00〜18:45"
  title: string;
  kind: string; // 区分ラベル
}

/**
 * 🔴 毎週の会議の**唯一の定義**（2026-10-05 一本化）。
 *   日報の「日程」とチャットワークの会議リマインドの両方がここを読む。
 *   以前はリマインドが DB の work_task_recurrences（9/27の古い「社員会議・社内会議」）を
 *   読んでいて、日報の日程と食い違っていた（t iku 指摘 2026-10-05）。
 *   会議を変えるときはここだけ直す。月曜の社員会議は t iku 指示で廃止。
 */
export const WEEKLY_FIXED: { weekday: number; start: string; end: string; title: string }[] = [
  // 0=日 … 4=木 5=金
  { weekday: 4, start: '18:00', end: '18:45', title: '社内ミーティング' },
  { weekday: 4, start: '18:45', end: '19:00', title: 'EXPO' },
  { weekday: 4, start: '19:00', end: '20:00', title: 'EXPO戦略会議' },
  { weekday: 5, start: '08:30', end: '11:00', title: 'BNI' },
];

const TYPE_LABEL: Record<string, string> = {
  info_session: '掲載説明会',
  seminar: 'オンラインセミナー',
  networking: '交流会',
};

function hhmmJst(iso: string): string {
  return new Date(iso).toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export async function collectSchedule(supabase: SupabaseClient, dateIso: string): Promise<ScheduleItem[]> {
  const wd = jstWeekday(dateIso);
  const items: (ScheduleItem & { sort: string })[] = WEEKLY_FIXED.filter(f => f.weekday === wd).map(f => ({
    time: `${f.start}〜${f.end}`,
    title: f.title,
    kind: '定例',
    sort: f.start,
  }));

  try {
    const { data, error } = await supabase
      .from('events')
      .select('title, type, event_date, duration_minutes, status')
      .gte('event_date', jstDayStartUtc(dateIso))
      .lt('event_date', jstDayEndUtc(dateIso))
      .not('status', 'in', '(draft,cancelled)');
    if (error) console.error('collectSchedule events error:', error.code, error.message);
    for (const e of data ?? []) {
      const start = hhmmJst(e.event_date);
      const endIso = new Date(new Date(e.event_date).getTime() + (e.duration_minutes ?? 90) * 60000).toISOString();
      const kind = /アワード/.test(e.title) ? 'その他イベント' : TYPE_LABEL[e.type] ?? 'その他イベント';
      items.push({ time: `${start}〜${hhmmJst(endIso)}`, title: e.title, kind, sort: start });
    }
  } catch (err) {
    // 🔴 日程が取れなくても日報は出せるようにする
    console.error('collectSchedule failed:', err);
  }

  return items.sort((a, b) => a.sort.localeCompare(b.sort)).map(({ sort: _s, ...rest }) => rest);
}

/** その日の毎週の会議（開始時刻順）。リマインド用。 */
export function weeklyMeetingsOn(dateIso: string) {
  const wd = jstWeekday(dateIso);
  return WEEKLY_FIXED.filter(f => f.weekday === wd).sort((a, b) => a.start.localeCompare(b.start));
}

/** リマインド本文の行。例: ["・18:00〜18:45 社内ミーティング", ...] */
export function meetingLines(dateIso: string): string[] {
  return weeklyMeetingsOn(dateIso).map(m => `・${m.start}〜${m.end} ${m.title}`);
}
