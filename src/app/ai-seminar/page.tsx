import SeminarLanding from '@/components/SeminarLanding';
import { AI_SEMINAR } from '@/lib/seminar-config';
import { fetchSeminarEvents } from '@/lib/fetch-seminar-events';

// 日程をサーバー側で取得して初期表示に含める（「読み込み中」を見せない）
export const revalidate = 60;

export default async function AiSeminarPage() {
  const events = await fetchSeminarEvents(AI_SEMINAR.pillar);
  return (
    <SeminarLanding
      config={AI_SEMINAR}
      initialEvents={events}
      heroImage="/ai-seminar-hero.jpg"
      heroImageAlt="AI時代のクラウドファンディング活用セミナーの様子"
    />
  );
}
