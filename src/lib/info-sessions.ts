/**
 * 掲載説明会（info_session）の直近日程。
 *
 * 🔴 ヘッダーのバナーに「次回の日付」を出すために使う。
 *   DB（events）を毎回引くと全ページでリクエストが増えるため、
 *   ここに **JSTの開始時刻** を列挙しておく（日程を追加したら1行足す）。
 *   先頭から見て「いまより後」の最初の1件を表示する。
 */
const UPCOMING: readonly string[] = [
  // 第7回 / 第8回 / 第9回（2026-10-12 に t iku 指示で登録した日程）
  '2026-11-07T10:00:00+09:00',
  '2026-11-24T19:30:00+09:00',
  '2026-12-22T19:30:00+09:00',
];

const WD = ['日', '月', '火', '水', '木', '金', '土'];

/** 「11/7(土) 10:00」形式。該当が無ければ null */
export function nextInfoSessionLabel(now: number = Date.now()): string | null {
  const next = UPCOMING.map(s => new Date(s)).find(d => d.getTime() > now);
  if (!next) return null;
  // JSTに固定して表示する（端末のタイムゾーンに依存させない）
  const jst = new Date(next.getTime() + 9 * 60 * 60 * 1000);
  const m = jst.getUTCMonth() + 1;
  const d = jst.getUTCDate();
  const w = WD[jst.getUTCDay()];
  const hh = String(jst.getUTCHours()).padStart(2, '0');
  const mm = String(jst.getUTCMinutes()).padStart(2, '0');
  return `${m}/${d}(${w}) ${hh}:${mm}`;
}
