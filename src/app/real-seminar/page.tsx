import type { Metadata } from 'next';
import SeminarLanding from '@/components/SeminarLanding';
import { REAL_SEMINAR } from '@/lib/seminar-config';
import { fetchSeminarEvents } from '@/lib/fetch-seminar-events';

// 日程をサーバー側で取得して初期表示に含める（「読み込み中」を見せない）
export const revalidate = 60;

/**
 * 🔴 料金・日時・会場は seminar-config.ts を正とする（このファイルに直書きしない）。
 *    ここでは「何のページか」だけを書く。
 */
export const metadata: Metadata = {
  // 2026-11-22 t iku案: イベント名より「誰から何を学べるか」を先に出す（FVの見出しと同じ）
  title: 'クラファン成功のプロに直接学び、成功者とつながる特別な1日｜リアルセミナー＆懇親会',
  description:
    '実績のあるプロから直接学び、AIで企画を形にする実践ワーク。クラファン成功者や挑戦する仲間と交流し、鴨頭嘉人さんのリアル登壇を間近で体験できる1日です。',
  openGraph: {
    title: 'クラファン成功のプロに直接学び、成功者とつながる特別な1日。',
    description:
      'クラファン実践セミナー × 成功者交流会 × 鴨頭嘉人特別参加会。実績のあるプロの直接指導、AI実践ワーク、成功者との交流を1日で。',
    images: ['/real-seminar-hero.jpg'],
  },
};

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
