import type { Metadata } from 'next';
import ConsultForm from './ConsultForm';
import { CONSULT_MINUTES } from '@/lib/seminar-info-content';

export const metadata: Metadata = {
  title: `個別相談（${CONSULT_MINUTES}分・無料）のお申し込み｜KAMOファンディング`,
  description: `クラウドファンディングでの挑戦を考えている方のための無料個別相談（${CONSULT_MINUTES}分）。ご予約の前に、氏名・性別・年齢・メールアドレス・アイディア／企画・希望金額をお伺いします。`,
};

/**
 * 個別相談の予約前アンケートページ（公開・認証なし）。
 *
 * 2026-11-24 t iku指示:
 *   予約スケジュールを入れる前に6項目のアンケート入力を必須にし、
 *   未入力では予約カレンダーへ進めないようにする。
 *   → サイト内の相談CTA（CONSULT_URL）はすべてこのページを指す。
 *     カレンダーURLは送信完了後にだけ表示する（ConsultForm 側）。
 */
export default function ConsultPage() {
  return <ConsultForm />;
}
