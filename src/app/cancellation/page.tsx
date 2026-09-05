import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LegalDocPage from '@/components/LegalDocPage';
import { LEGAL_DOCS, isLegalPublished } from '@/lib/legal-docs';

/**
 * /cancellation — キャンセルポリシー
 *
 * 🔴 公開はフラグ制。NEXT_PUBLIC_LEGAL_PAGES_PUBLISHED='true' のときだけ表示し、
 *   未設定なら notFound()（404）。決済ページの特商法表示と原稿の食い違いが
 *   解消するまで公開しない方針のため（詳細は src/lib/legal-docs.ts）。
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
