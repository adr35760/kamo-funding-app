/**
 * 開催済みイベントの表示制御（サーバー側・日本時間基準）
 *
 * ブラウザの時計に依存せず、サーバーの現在時刻（UTC）と
 * イベントの event_date（タイムゾーン付き）を比較して判定する。
 * event_date は TIMESTAMPTZ なので、比較は絶対時刻同士＝JST基準の判定と等価。
 *
 * 「終了した」の基準は **開催終了時刻**（開始 + duration_minutes）。
 * 開催中のイベントは表示され続ける。
 */

export interface EventTimeLike {
  event_date: string;
  duration_minutes?: number | null;
}

/** duration が未設定のイベントに使う既定の所要時間（分） */
const DEFAULT_DURATION_MINUTES = 90;

/**
 * 表示モード
 * - 'hide'      … 過去日程を一覧から除外する（既定・t iku確認までの方針）
 * - 'mark_done' … 過去日程も表示し「終了」バッジを出す
 *
 * 環境変数 PAST_EVENT_DISPLAY で切り替えられる（再デプロイのみで変更可）。
 */
export type PastEventDisplayMode = 'hide' | 'mark_done';

export function getPastEventDisplayMode(): PastEventDisplayMode {
  return process.env.PAST_EVENT_DISPLAY === 'mark_done' ? 'mark_done' : 'hide';
}

/** イベントの終了時刻を返す */
export function getEventEndTime(ev: EventTimeLike): Date {
  const start = new Date(ev.event_date);
  const minutes = ev.duration_minutes ?? DEFAULT_DURATION_MINUTES;
  return new Date(start.getTime() + minutes * 60 * 1000);
}

/** 開催終了済みか（終了時刻を過ぎたか） */
export function isEventFinished(ev: EventTimeLike, now: Date = new Date()): boolean {
  return getEventEndTime(ev).getTime() <= now.getTime();
}

/**
 * 申込を受け付けてよいイベントか。
 * 終了した回への申込を防ぐため、表示モードに関わらず終了回は常に false。
 */
export function isEventOpenForApplication(ev: EventTimeLike, now: Date = new Date()): boolean {
  return !isEventFinished(ev, now);
}

/**
 * 一覧表示用にイベントを絞り込む。
 * 'hide' なら終了回を除外、'mark_done' なら全件返す（バッジ側で区別する）。
 */
export function filterVisibleEvents<T extends EventTimeLike>(
  events: T[],
  now: Date = new Date(),
  mode: PastEventDisplayMode = getPastEventDisplayMode()
): T[] {
  if (mode === 'mark_done') return events;
  return events.filter(e => !isEventFinished(e, now));
}

/** 申込フォームの選択肢用（終了回は常に除外） */
export function filterApplicableEvents<T extends EventTimeLike>(
  events: T[],
  now: Date = new Date()
): T[] {
  return events.filter(e => isEventOpenForApplication(e, now));
}
