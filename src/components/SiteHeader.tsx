'use client';

import { useState } from 'react';
import '@/styles/site-header.css';

const NAV_ITEMS = [
  { href: '/seminar-info', label: '掲載説明会' },
  { href: '/partner-session-announce', label: 'パートナーシップ' },
  { href: '/partners', label: 'パートナー登録' },
  { href: '/supporters', label: 'サポーター登録' },
  { href: '/ai-tool', label: 'AIツール' },
];

const CTA = { href: '/lp', label: '日程を確認する' };

interface SiteHeaderProps {
  /** 現在のページのパス。該当ナビ項目を強調する（任意） */
  current?: string;
}

/**
 * 全ページ共通のヘッダー。
 * 各ページで個別実装せず、このコンポーネントを使う。
 * 直後に <div className="site-header-spacer" /> を置くと固定ヘッダー分の余白が入る。
 *
 * - 769px以上: ナビを横並びで表示
 * - 768px以下: ハンバーガーメニューに格納（全項目にアクセス可能）
 */
export default function SiteHeader({ current }: SiteHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <a href="/" className="site-header-logo-link">
            <img src="/kamo-logo-main.jpg" alt="KAMOファンディング" className="site-header-logo" />
          </a>

          {/* PC: 横並びナビ */}
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
            <a href={CTA.href} className="site-header-cta">{CTA.label}</a>
          </nav>

          {/* スマホ: CTAは常時表示し、その他はハンバーガーへ */}
          <div className="site-header-mobile">
            <a href={CTA.href} className="site-header-cta">{CTA.label}</a>
            <button
              type="button"
              className="site-header-toggle"
              aria-label={open ? 'メニューを閉じる' : 'メニューを開く'}
              aria-expanded={open}
              onClick={() => setOpen(v => !v)}
            >
              <span className={`site-header-bars${open ? ' is-open' : ''}`} aria-hidden="true">
                <span /><span /><span />
              </span>
            </button>
          </div>
        </div>

        {/* スマホ用ドロワー */}
        {open && (
          <nav className="site-header-drawer">
            {NAV_ITEMS.map(item => (
              <a
                key={item.href}
                href={item.href}
                className={current === item.href ? 'is-current' : undefined}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
      </header>
      <div className="site-header-spacer" />
      {open && <div className="site-header-overlay" onClick={() => setOpen(false)} />}
    </>
  );
}
