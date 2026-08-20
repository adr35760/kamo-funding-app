import LPClient from './LPClient';
import { fetchSeminarEvents } from '@/lib/fetch-seminar-events';
import type { EventLike } from '@/lib/event-format';

// 日程をサーバー側で取得して初期HTMLに含める（申込フォームの選択肢を最初から埋める）
export const revalidate = 60;

export default async function LPPage() {
  const events = (await fetchSeminarEvents(1)) as unknown as EventLike[];
  return <LPClient initialEvents={events} />;
}
