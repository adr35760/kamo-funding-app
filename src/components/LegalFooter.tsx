import { isLegalPublished, LEGAL_LINKS } from '@/lib/legal-docs';

/**
 * 法務ページ4点へのリンク行。
 *
 * 法令上、お客様が規約類へたどり着けることが必要なため、
 * 全ページのフッターにこのコンポーネントを差し込む。
 *
 * 🔴 未公開のあいだ（isLegalPublished() が false）は何も描画しない。
 *   ページ側が404を返すので、リンクだけ出すとリンク切れになる。
 *   公開フラグを立てれば全ページに一斉に出る。
 */
export default function LegalFooter({ className }: { className?: string }) {
  if (!isLegalPublished()) return null;
  return (
    <nav className={`legal-footer-links${className ? ` ${className}` : ''}`} aria-label="規約・ポリシー">
      {LEGAL_LINKS.map(l => (
        <a key={l.href} href={l.href}>{l.label}</a>
      ))}
    </nav>
  );
}
