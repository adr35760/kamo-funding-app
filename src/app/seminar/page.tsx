import type { Metadata } from 'next';
import SeminarHubClient from './SeminarHubClient';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { filterVisibleEvents, isEventFinished } from '@/lib/event-visibility';
import type { HubEvent } from './SeminarHubClient';

/**
 * /seminar — オンラインセミナーとリアルセミナーの日程を1ページに並べ、
 * その場で申し込めるハブページ。SNS告知のCTAの着地点。
 *
 * 日程は DB から動的に取得する（ハードコードしない）。
 * 中止・追加のたびに手直しが必要になるのを避けるため、
 * status='upcoming' かつ開催終了前のものだけを日付昇順で出す。
 * 掲載説明会（info_session）はこのページの対象外。
 */
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'セミナー日程・お申し込み | KAMOファンディング',
  description:
    'オンラインセミナー（9,800円）とリアルセミナー＆懇親会（19,800円）の日程を比較して、そのままお申し込みいただけます。参加者はAIクラファンページ作成ツールをその場で体験できます。',
};

/** このページに載せるイベント種別（有料セミナー2種のみ） */
const HUB_TYPES = ['seminar', 'networking'] as const;

async function fetchHubEvents(): Promise<HubEvent[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('events')
      .select('id, title, type, pillar, event_date, duration_minutes, location, capacity')
      .eq('status', 'upcoming')
      .in('type', HUB_TYPES as unknown as string[])
      .order('event_date', { ascending: true });
    if (error || !data) return [];

    // 開催終了済みはサーバー側（JST基準の絶対時刻比較）で除外する
    const visible = filterVisibleEvents(
      data as unknown as Array<{ event_date: string; duration_minutes?: number | null }>
    ) as unknown as Array<Record<string, unknown>>;

    return visible.map(e => ({
      id: e.id as string,
      title: e.title as string,
      type: e.type as string,
      pillar: e.pillar as number,
      event_date: e.event_date as string,
      duration_minutes: (e.duration_minutes as number | null) ?? null,
      location: (e.location as string | null) ?? null,
      capacity: (e.capacity as number | null) ?? null,
      finished: isEventFinished({
        event_date: e.event_date as string,
        duration_minutes: (e.duration_minutes as number | null) ?? null,
      }),
    }));
  } catch {
    // Supabase未接続時は空配列。クライアント側が /api/events にフォールバックする
    return [];
  }
}

export default async function SeminarHubPage() {
  const events = await fetchHubEvents();
  return <SeminarHubClient initialEvents={events} />;
}
