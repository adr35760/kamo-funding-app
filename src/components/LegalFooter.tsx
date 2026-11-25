import { isLegalPublished, LEGAL_LINKS } from '@/lib/legal-docs';

/**
 * 全ページ共通のフッターリンク行。
 *
 * 1) 質問・問い合わせ・取材依頼（/contact）— 2026-11-25 t iku指示で新設。
 *    サイトに問い合わせの受け口が無く、どこからも辿れなかったため、
 *    **法令の公開フラグに関係なく常に出す**（問い合わせ導線は法務ページとは別の要件）。
 * 2) 法務ページ4点へのリンク（利用規約・プライバシーポリシー・特商法・返品）。
 *    法令上、お客様が規約類へたどり着けることが必要なため、全ページのフッターに差し込む。
 *
 * 🔴 未公開のあいだ（isLegalPublished() が false）は法務リンクを描画しない。
 *   ページ側が404を返すので、リンクだけ出すとリンク切れになる。
 *   公開フラグを立てれば全ページに一斉に出る。
 */
export default function LegalFooter({ className }: { className?: string }) {
  const published = isLegalPublished();
  return (
    <nav className={`legal-footer-links${className ? ` ${className}` : ''}`} aria-label="フッターリンク">
      <a href="/contact" className="footer-contact-link">
        質問・問い合わせ・取材依頼はこちら
      </a>
      <a href="/company">運営会社</a>
      {published
        ? LEGAL_LINKS.map(l => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))
        : null}
    </nav>
  );
}
