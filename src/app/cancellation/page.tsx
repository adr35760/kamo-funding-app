import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LegalDocPage from '@/components/LegalDocPage';
import { LEGAL_DOCS, isLegalPublished } from '@/lib/legal-docs';

/**
 * /cancellation — キャンセルポリシー
 *
 * 公開制御は isLegalPublished()。false のあいだは notFound()（404）を返す。
 *   2026-09-13 に公開済み（詳細は src/lib/legal-docs.ts）。
 */
const doc = LEGAL_DOCS.cancellation;

export const metadata: Metadata = {
  title: 'キャンセルポリシー | KAMOファンディング',
  description: 'セミナー・交流会のキャンセルおよび返金についてのポリシーです。',
  // 公開前は検索エンジンにもクロールさせない（404と併せた二重の防波堤）
  robots: isLegalPublished() ? undefined : { index: false, follow: false },
};

export default function Page() {
  if (!isLegalPublished()) notFound();
  return <LegalDocPage doc={doc} />;
}
