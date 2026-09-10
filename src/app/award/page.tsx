import AwardLanding from '@/components/AwardLanding';
import { AWARD_EVENT } from '@/lib/seminar-config';
import { fetchSeminarEvents } from '@/lib/fetch-seminar-events';

export const revalidate = 60;

export const metadata = {
  title: 'KAMOファンディングアワード | KAMOファンディング',
  description:
    'KAMOファンディングで挑戦した方々を表彰する年に一度の式典。2026年11月9日（月）池袋 harevutai。表彰式のあとは懇親会で挑戦者・支援者と直接つながれます。',
};

export default async function AwardPage() {
  const events = await fetchSeminarEvents(AWARD_EVENT.pillar);
  return <AwardLanding initialEvents={events} />;
}
