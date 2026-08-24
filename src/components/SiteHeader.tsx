import '@/styles/site-header.css';

const NAV_ITEMS = [
  { href: '/seminar-info', label: '掲載説明会' },
  { href: '/partner-session-announce', label: 'パートナーシップ' },
  { href: '/partners', label: 'パートナー登録' },
  { href: '/supporters', label: 'サポーター登録' },
  { href: '/ai-tool', label: 'AIツール' },
];

interface SiteHeaderProps {
  /** 現在のページのパス。該当ナビ項目を強調する（任意） */
  current?: string;
}

/**
 * 全ページ共通のヘッダー。
 * 各ページで個別実装せず、このコンポーネントを使う。
 * 直後に <div className="site-header-spacer" /> を置くと固定ヘッダー分の余白が入る。
 */
export default function SiteHeader({ current }: SiteHeaderProps) {
  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <a href="/">
            <img src="/kamo-logo-main.jpg" alt="KAMOファンディング" className="site-header-logo" />
          </a>
          <nav className="site-header-nav">
            {NAV_ITEMS.map(item => (
              <a
                key={item.href}
                href={item.href}
                className={current === item.href ? 'is-current' : undefined}
              >
                {item.label}
              </a>
            ))}
            <a href="/lp" className="site-header-cta">日程を確認する</a>
          </nav>
        </div>
      </header>
      <div className="site-header-spacer" />
    </>
  );
}
