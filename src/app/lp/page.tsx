import LPClient from './LPClient';
import { fetchSeminarEventState } from '@/lib/fetch-seminar-events';
import type { EventLike } from '@/lib/event-format';

// 日程をサーバー側で取得して初期HTMLに含める（申込フォームの選択肢を最初から埋める）
export const revalidate = 60;

export default async function LPPage() {
  // 2026-10-27 t iku決定（B＝申込があったときだけ開催）: 公開側は info_session を出さない。
  // resolved=false（取得失敗）と 0件（個別相談へ差し替え）を区別して渡す。
  const { events, resolved } = await fetchSeminarEventState(1);
  return <LPClient initialEvents={events as unknown as EventLike[]} eventsResolved={resolved} />;
}
