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
 * { month: '8月', day: 18, weekday: '火', weekdayKakko: '（火）', dateJa: '8/18（火）', timeRange: '19:30〜21:00' }
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
    weekdayKakko: `（${WEEKDAYS[s.weekday]}）`,
    dateJa: `${s.month}/${s.day}（${WEEKDAYS[s.weekday]}）`,
    timeRange: `${hhmm(s)}〜${hhmm(e)}`,
  };
}

/** タイトルの末尾に付与されている "(8/18)" 等の飾りを除去して返す */
export function cleanTitle(title: string): string {
  return title.replace(/\s*\([0-9]{1,2}\/[0-9]{1,2}\)\s*$/, '').trim();
}

/**
 * 個別説明会の希望日時ピッカー用の範囲（Asia/Tokyo基準）
 * min: 翌日の00:00 / max: 約3ヶ月先
 * datetime-local 用の "YYYY-MM-DDTHH:mm" 形式で返す
 */
export function preferredSlotRange(now: Date = new Date()): { min: string; max: string } {
  // Asia/Tokyo の「今日」を取得し、翌日00:00 〜 約3ヶ月先 を返す
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now); // YYYY-MM-DD
  const [ty, tm, td] = today.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  const tomorrow = new Date(Date.UTC(ty, tm - 1, td + 1));
  const threeMonths = new Date(Date.UTC(ty, tm - 1 + 3, td));
  const fmt = (d: Date, time: string) =>
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${time}`;
  return { min: fmt(tomorrow, '00:00'), max: fmt(threeMonths, '23:30') };
}

/**
 * datetime-local の値（"2026-09-10T20:00"）を日本語表記に整形
 * → "2026/9/10（木）20:00"
 */
export function formatSlotJa(value: string): string {
  if (!value) return '';
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return value; // 想定外の形式はそのまま返す
  const [, y, mo, d, hh, mm] = m;
  const wd = ['日', '月', '火', '水', '木', '金', '土'][
    new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))).getUTCDay()
  ];
  return `${Number(y)}/${Number(mo)}/${Number(d)}（${wd}）${hh}:${mm}`;
}
