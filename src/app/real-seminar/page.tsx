import SeminarLanding from '@/components/SeminarLanding';
import { REAL_SEMINAR } from '@/lib/seminar-config';
import { fetchSeminarEvents } from '@/lib/fetch-seminar-events';

// 日程をサーバー側で取得して初期表示に含める（「読み込み中」を見せない）
export const revalidate = 60;

export default async function RealSeminarPage() {
  const events = await fetchSeminarEvents(REAL_SEMINAR.pillar);
  return (
    <SeminarLanding
      config={REAL_SEMINAR}
      initialEvents={events}
      heroImage="/real-seminar-hero.jpg"
      heroImageAlt="リアルセミナー＆懇親会の様子"
      heroImageWidth={1632}
      heroImageHeight={1224}
    />
  );
}
