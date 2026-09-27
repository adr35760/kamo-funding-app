/**
 * 業務管理システムの日付・時刻。**すべて JST（Asia/Tokyo）で考える。**
 *
 * 🔴 Vercel のサーバーは UTC で動くので、`new Date().toISOString().slice(0,10)` は
 *   日本時間の 09:00 より前だと**前日の日付**になる。
 *   日報は「その日」の単位が全てなので、ここを間違えると
 *   朝に開いた日報が前日分になる・21:00のリマインドが翌日分を見る、といった事故になる。
 */

/** JSTの今日（YYYY-MM-DD） */
export function jstDateIso(now: Date = new Date()): string {
  // en-CA は YYYY-MM-DD 形式を返す
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** JSTの日付を n 日ずらす（YYYY-MM-DD） */
export function shiftDateIso(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  // 正午UTCを基準にして日付の繰り上げ・繰り下げを安全に行う
  const base = Date.UTC(y, m - 1, d, 12, 0, 0);
  const shifted = new Date(base + days * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(shifted);
}

/** JSTの曜日（0=日 ... 6=土） */
export function jstWeekday(dateIso: string): number {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** 営業日か（土日を除く。祝日は考慮しない — 3名の運用では過剰なので入れない） */
export function isBusinessDay(dateIso: string): boolean {
  const w = jstWeekday(dateIso);
  return w !== 0 && w !== 6;
}

/** その月の末日か */
export function isMonthEnd(dateIso: string): boolean {
  return shiftDateIso(dateIso, 1).slice(5, 7) !== dateIso.slice(5, 7);
}

/** JSTの「日の始まり」をUTCのISO文字列で返す（DBの timestamptz 比較用） */
export function jstDayStartUtc(dateIso: string): string {
  // JST 00:00 = 前日 15:00 UTC
  return `${dateIso}T00:00:00+09:00`;
}

/** JSTの「日の終わり」をUTCのISO文字列で返す（排他的上限として使う） */
export function jstDayEndUtc(dateIso: string): string {
  return `${shiftDateIso(dateIso, 1)}T00:00:00+09:00`;
}

/** 日本語の日付表記（9/28（月）） */
export function formatJaDate(dateIso: string): string {
  const [, m, d] = dateIso.split('-');
  const wd = ['日', '月', '火', '水', '木', '金', '土'][jstWeekday(dateIso)];
  return `${Number(m)}/${Number(d)}（${wd}）`;
}
