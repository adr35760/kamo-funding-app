import type { Metadata } from 'next';
import ContactForm from './ContactForm';

export const metadata: Metadata = {
  title: '質問・問い合わせ・取材依頼｜KAMOファンディング',
  description:
    'KAMOファンディングへのご質問、掲載・支援についてのお問い合わせ、取材・メディア掲載のご依頼はこちらのフォームからお送りください。原則として2営業日以内にご返信します。',
};

/**
 * 質問・問い合わせ・取材依頼のページ（公開・認証なし）。
 *
 * 2026-11-25 t iku指示:「質問・問い合わせ・取材依頼はこちら」の導線が
 * サイトに無かったため新設。全ページのフッターからリンクする
 * （components/LegalFooter.tsx）。
 */
export default function ContactPage() {
  return <ContactForm />;
}
