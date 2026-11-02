'use client';

import { useEffect, useState } from 'react';
import { nextInfoSessionLabel } from '@/lib/info-sessions';
import '@/styles/site-header.css';

interface NavItem { href: string; label: string; banner?: boolean }

const NAV_ITEMS: NavItem[] = [
  // 2026-10-26: 主導線を個別相談へ切り替え（ラベルのみ変更・リンク先は /seminar-info のまま＝
  // そのページは既に個別相談メインの構成）
  { href: '/seminar-info', label: '個別相談' },
  // 2026-11-02 t iku 指示: 「個別相談」と「パートナーシップ」の間に掲載説明会のバナーを置く
  { href: '/seminar-info#schedule', label: '掲載説明会', banner: true },
  { href: '/partner-session-announce', label: 'パートナーシップ' },
  { href: '/partners', label: 'パートナー登録' },
  { href: '/supporters', label: 'サポーター登録' },
  { href: '/ai-tool', label: 'AIツール' },
];

const DEFAULT_CTA: SiteHeaderLink = { href: '/lp', label: '日程を確認する' };

/**
 * 主CTA（日程を確認する）の**右横**に置くボタン（t iku 指定 2026-09-17）。
 * 掲載申込フォームへの導線。全ページのヘッダーに出る。
 */
const APPLY_CTA: SiteHeaderLink = { href: '/apply-listing', label: '掲載申し込みをする' };

/**
 * 主CTA（日程を確認する）の左横に置く副ボタン。
 * 位置や文言の変更はこの定数と SECONDARY_IN_DRAWER_ONLY だけで完結する。
 */
const SECONDARY_CTA: SiteHeaderLink = { href: '/success', label: '成功事例を見る →' };
/**
 * true にすると、狭い画面（768px以下）では副ボタンをヘッダーに出さず
 * ドロワーの先頭に入れる。390pxで主CTAと並べると窮屈なため既定で有効。
 */
const SECONDARY_IN_DRAWER_ONLY = true;

export interface SiteHeaderLink {
  href: string;
  label: string;
  /** 外部サイト（カレンダー予約ページ等）へ飛ばす場合に true。新しいタブで開く */
  external?: boolean;
}

interface SiteHeaderProps {
  /** 現在のページのパス。該当ナビ項目を強調する（任意） */
  current?: string;
  /**
   * ページ固有のCTA。指定すると既定の「日程を確認する」を差し替える。
   * 例: { href: '#apply', label: '今すぐ申し込む' }
   */
  cta?: SiteHeaderLink;
  /**
   * ページ内アンカー等の追加リンク（LPの「説明会とは」「4本柱」など）。
   * PCではサイトナビの前に、スマホではドロワー上部に表示する。
   */
  pageLinks?: SiteHeaderLink[];
}

/**
 * 全ページ共通のヘッダー。
 * 各ページで個別実装せず、このコンポーネントを使う。
 *
 * - 769px以上: リンクを横並びで表示
 * - 768px以下: ハンバーガーメニューに格納（全項目にアクセス可能）／CTAは常時表示
 */
export default function SiteHeader({ current, cta, pageLinks }: SiteHeaderProps) {
  const [open, setOpen] = useState(false);
  // SSRとクライアントで日付がズレないよう、マウント後に計算する
  const [nextSession, setNextSession] = useState<string | null>(null);
  useEffect(() => { setNextSession(nextInfoSessionLabel()); }, []);
  const actionCta = cta ?? DEFAULT_CTA;
  const extras = pageLinks ?? [];

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <a href="/" className="site-header-logo-link">
            <img src="/kamo-logo-main.jpg" alt="KAMOファンディング" className="site-header-logo" />
          </a>

          {/* PC: 横並びナビ */}
          <nav className="site-header-nav">
            {extras.map(item => (
              <a key={item.href} href={item.href} className="is-page-link">{item.label}</a>
            ))}
            {NAV_ITEMS.map(item => (
              <a
                key={item.href}
                href={item.href}
                className={[current === item.href ? 'is-current' : '', item.banner ? 'is-banner' : ''].filter(Boolean).join(' ') || undefined}
              >
                {item.banner ? (
                  <>
                    <span className="is-banner-label">{item.label}</span>
                    {nextSession && <span className="is-banner-date">次回 {nextSession}</span>}
                  </>
                ) : (
                  item.label
                )}
              </a>
            ))}
            <a href={SECONDARY_CTA.href} className="site-header-cta-secondary">{SECONDARY_CTA.label}</a>
            <a
              href={actionCta.href}
              className="site-header-cta"
              {...(actionCta.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >{actionCta.label}</a>
            <a href={APPLY_CTA.href} className="site-header-cta-apply">{APPLY_CTA.label}</a>
          </nav>

          {/* スマホ: CTAは常時表示し、その他はハンバーガーへ */}
          <div className="site-header-mobile">
            <a
              href={actionCta.href}
              className="site-header-cta"
              {...(actionCta.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >{actionCta.label}</a>
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
            {/* 🔴 スマホではヘッダーに3つ並べられないため、掲載申込はドロワー最上段に置く */}
            <a
              href={APPLY_CTA.href}
              className="site-header-drawer-apply"
              onClick={() => setOpen(false)}
            >
              {APPLY_CTA.label}
            </a>
            {SECONDARY_IN_DRAWER_ONLY && (
              <a
                href={SECONDARY_CTA.href}
                className="site-header-drawer-secondary"
                onClick={() => setOpen(false)}
              >
                {SECONDARY_CTA.label}
              </a>
            )}
            {extras.map(item => (
              <a key={item.href} href={item.href} className="is-page-link" onClick={() => setOpen(false)}>
                {item.label}
              </a>
            ))}
            {NAV_ITEMS.map(item => (
              <a
                key={item.href}
                href={item.href}
                className={[current === item.href ? 'is-current' : '', item.banner ? 'is-banner' : ''].filter(Boolean).join(' ') || undefined}
                onClick={() => setOpen(false)}
              >
                {item.banner ? (
                  <>
                    <span className="is-banner-label">{item.label}</span>
                    {nextSession && <span className="is-banner-date">次回 {nextSession}</span>}
                  </>
                ) : (
                  item.label
                )}
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
