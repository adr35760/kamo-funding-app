import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LegalDocPage from '@/components/LegalDocPage';
import { LEGAL_DOCS, isLegalPublished } from '@/lib/legal-docs';

/**
 * /tokushoho — 特定商取引法に基づく表記
 *
 * 公開制御は isLegalPublished()。false のあいだは notFound()（404）を返す。
 *   2026-09-13 に公開済み（詳細は src/lib/legal-docs.ts）。
 */
const doc = LEGAL_DOCS.tokushoho;

export const metadata: Metadata = {
  title: '特定商取引法に基づく表記 | KAMOファンディング',
  description: '特定商取引法に基づく販売事業者・販売価格・お支払い方法・キャンセルに関する表記です。',
  // 公開前は検索エンジンにもクロールさせない（404と併せた二重の防波堤）
  robots: isLegalPublished() ? undefined : { index: false, follow: false },
};

export default function Page() {
  if (!isLegalPublished()) notFound();
  return <LegalDocPage doc={doc} />;
}
