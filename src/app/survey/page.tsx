import type { Metadata } from 'next';
import SurveyForm from './SurveyForm';
import { resolveSurveyEvent } from '@/lib/survey-event';

export const metadata: Metadata = {
  title: '掲載説明会アンケート｜KAMOファンディング',
  robots: { index: false, follow: false },
};

// 対象イベントはDBから都度解決する（キャッシュで古い回を出さない）
export const dynamic = 'force-dynamic';

/**
 * 掲載説明会後アンケートの回答ページ（公開・認証なし）。
 *
 * `?event=<event_id>` で回を指定する。未指定・不正・存在しないIDは
 * 直近の終了済み掲載説明会（info_session）にフォールバックする。
 */
export default async function SurveyPage({
  searchParams,
}: {
  searchParams?: { event?: string | string[] };
}) {
  const raw = searchParams?.event;
  const eventId = Array.isArray(raw) ? raw[0] : raw ?? null;
  const event = await resolveSurveyEvent(eventId);
  return <SurveyForm event={event} />;
}
