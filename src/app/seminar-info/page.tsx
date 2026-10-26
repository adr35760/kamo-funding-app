import type { Metadata } from 'next';
import SeminarInfoClient from './SeminarInfoClient';
import { fetchSeminarEvents } from '@/lib/fetch-seminar-events';
import type { EventLike } from '@/lib/event-format';
import { NUM_JISSEKI, NUM_TASSEI_RATE } from '@/lib/seminar-info-content';
import { isReferralCodeShape, normalizeReferralCode } from '@/lib/referral-link';

// 日程をサーバー側で取得して初期HTMLに含める。
// これにより、申込フォームの選択肢が最初から埋まっている状態になる
// （クライアント取得待ちの間に「日程確定後にご案内」が見えて
//   申込できない、という事故を防ぐ）。
export const revalidate = 60;

/**
 * 構成変更（2026-10-25・t iku指示）に合わせて title/description を更新。
 * 数値は seminar-info-content.ts の定数を参照する（本文と二重管理にしない）。
 */
const TITLE = '個別相談（無料・60分）｜KAMOファンディングの掲載相談';
const DESCRIPTION =
  `クラウドファンディングで、挑戦をかたちにする最初の60分。実績${NUM_JISSEKI}・達成率${NUM_TASSEI_RATE}の担当者が、` +
  'アイデア・目標金額・スケジュールを直接伺います。掲載説明会の日程・お申し込みもご案内しています。';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default async function SeminarInfoPage({
  searchParams,
}: {
  searchParams?: { ref?: string | string[] };
}) {
  // 掲載説明会は pillar=1
  const events = (await fetchSeminarEvents(1)) as unknown as EventLike[];

  /**
   * 紹介パートナー専用リンク（/r/<code>）から来たときの紹介コード。
   * 🔴 サーバ側で読んで初期値として渡す。クライアントのJSだけで拾うと、
   *    水和前の送信やJS無効時にコードが落ち、紹介が記録されない。
   */
  const rawRef = Array.isArray(searchParams?.ref) ? searchParams?.ref[0] : searchParams?.ref;
  const normalizedRef = normalizeReferralCode(rawRef);
  const referralCode = isReferralCodeShape(normalizedRef) ? normalizedRef : '';

  return <SeminarInfoClient initialEvents={events} initialReferralCode={referralCode} />;
}
