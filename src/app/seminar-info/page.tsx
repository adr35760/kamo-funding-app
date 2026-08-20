import SeminarInfoClient from './SeminarInfoClient';
import { fetchSeminarEvents } from '@/lib/fetch-seminar-events';
import type { EventLike } from '@/lib/event-format';

// 日程をサーバー側で取得して初期HTMLに含める。
// これにより、申込フォームの選択肢が最初から埋まっている状態になる
// （クライアント取得待ちの間に「日程確定後にご案内」が見えて
//   申込できない、という事故を防ぐ）。
export const revalidate = 60;

export default async function SeminarInfoPage() {
  // 掲載説明会は pillar=1
  const events = (await fetchSeminarEvents(1)) as unknown as EventLike[];
  return <SeminarInfoClient initialEvents={events} />;
}
