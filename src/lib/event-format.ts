/**
 * イベント日程の日本語表記ユーティリティ
 * 例: 8/18（火）19:30〜21:00
 * タイムゾーンは Asia/Tokyo で固定し、サーバー/ブラウザの環境に依存しない。
 */

export interface EventLike {
  id: string;
  title: string;
  event_date: string;
  pillar?: number;
  duration_minutes?: number | null;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const MONTHS_JA_SHORT = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

/** 指定したISO時刻を Tokyo タイムゾーンで分解 */
function tokyoParts(iso: string): { month: number; day: number; weekday: number; hour: number; minute: number } {
  const d = new Date(iso);
  // Intl を使い、Asia/Tokyo での年月日時分を取得する
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(d);

  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  let hour = get('hour');
  if (hour === 24) hour = 0; // 24:xx 表記の環境対策

  // 曜日は日付文字列を Tokyo 日付で再構成して算出
  const y = get('year');
  const m = get('month');
  const dayNum = get('day');
  const wd = new Date(Date.UTC(y, m - 1, dayNum)).getUTCDay();

  return { month: m, day: dayNum, weekday: wd, hour, minute: get('minute') };
}

/**
 * 例: formatEventDateJa('2026-08-18T10:30:00+00:00', 90) → "8/18（火）19:30〜21:00"
 */
export function formatEventDateJa(eventDate: string, durationMinutes?: number | null): string {
  const s = tokyoParts(eventDate);
  const dur = durationMinutes ?? 90;
  const endMs = new Date(eventDate).getTime() + dur * 60_000;
  const e = tokyoParts(new Date(endMs).toISOString());
  const hhmm = (p: { hour: number; minute: number }) =>
    `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
  return `${s.month}/${s.day}（${WEEKDAYS[s.weekday]}）${hhmm(s)}〜${hhmm(e)}`;
}

/**
 * LP のカード表示用（月・日・曜日・時間帯 — すべて日本語表記）:
 * { month: '8月', day: 18, weekday: '火', dateJa: '8/18（火）', timeRange: '19:30〜21:00' }
 */
export function eventCardParts(eventDate: string, durationMinutes?: number | null) {
  const s = tokyoParts(eventDate);
  const dur = durationMinutes ?? 90;
  const e = tokyoParts(new Date(new Date(eventDate).getTime() + dur * 60_000).toISOString());
  const hhmm = (p: { hour: number; minute: number }) =>
    `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
  return {
    month: MONTHS_JA_SHORT[s.month - 1],
    day: s.day,
    weekday: WEEKDAYS[s.weekday],
    dateJa: `${s.month}/${s.day}（${WEEKDAYS[s.weekday]}）`,
    timeRange: `${hhmm(s)}〜${hhmm(e)}`,
  };
}

/** タイトルの末尾に付与されている "(8/18)" 等の飾りを除去して返す */
export function cleanTitle(title: string): string {
  return title.replace(/\s*\([0-9]{1,2}\/[0-9]{1,2}\)\s*$/, '').trim();
}
