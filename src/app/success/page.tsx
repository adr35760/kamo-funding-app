import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import StatsBanner from '@/components/StatsBanner';
import { TOTAL_RAISED_LABEL } from '@/lib/site-stats';
import {
  SUCCESS_CATEGORIES,
  CaseStory,
  projectUrl,
  caseImage,
  CASE_IMAGE_WIDTH,
  CASE_IMAGE_HEIGHT,
  publishedCaseCount,
  CONSULT_ANCHOR,
  formatYen,
} from '@/lib/success-cases';
import '@/styles/kamo-icons.css';
import '@/styles/success.css';
import LegalFooter from '@/components/LegalFooter';

/**
 * /success = 「金額の大きい事例を並べるページ」ではなく
 * 「自分の企画を実現するイメージが湧くページ」。
 * 事例は t iku 指定の3分類（初挑戦／新サービス／店舗・出版・地域活動）。
 * ①〜⑤は各プロジェクトページに書かれている事実のみで構成する。
 */
const CASE_COUNT = publishedCaseCount();

const META_DESCRIPTION =
  `KAMOファンディングで実現した挑戦の記録。初めてのクラウドファンディング、新サービスの立ち上げ、` +
  `店舗・出版・地域活動。${CASE_COUNT}件の事例を、挑戦前の状況・始めた理由・実施したこと・結果・感想で紹介します。` +
  `累計支援総額は${TOTAL_RAISED_LABEL}（両サービス合計）。`;

export const metadata: Metadata = {
  title: '成功事例 | KAMOファンディング',
  description: META_DESCRIPTION,
  openGraph: {
    title: '成功事例 | KAMOファンディング',
    description: META_DESCRIPTION,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '成功事例 | KAMOファンディング',
    description: META_DESCRIPTION,
  },
};

/** 事例1件（テンプレート6項目） */
function StoryCard({ item, index }: { item: CaseStory; index: number }) {
  return (
    <article className="sc-story" id={item.slug}>
      <div className="sc-story-head">
        <div className="sc-story-media">
          <img
            src={caseImage(item.slug)}
            alt={`${item.title}（プロジェクトのメイン画像）`}
            width={CASE_IMAGE_WIDTH}
            height={CASE_IMAGE_HEIGHT}
            loading={index === 0 ? 'eager' : 'lazy'}
            className="sc-story-image"
          />
        </div>

        <div className="sc-story-headtext">
          <p className="sc-story-index">
            CASE {String(index + 1).padStart(2, '0')}
            {item.subLabel && <span className="sc-story-index-sub">{item.subLabel}</span>}
          </p>
          <h3 className="sc-story-heading">
            {item.heading}
            <span className="sc-story-heading-sub">そんな想いから始まった挑戦。</span>
          </h3>
          <dl className="sc-story-meta">
            <dt>プロジェクト名</dt>
            <dd>{item.title}</dd>
            <dt>実行者</dt>
            <dd>
              {item.owner}
              {item.ownerNote && <span className="sc-story-owner-note">（{item.ownerNote}）</span>}
            </dd>
          </dl>
          <a
            className="sc-story-projectlink"
            href={projectUrl(item.slug)}
            target="_blank"
            rel="noopener noreferrer"
          >
            プロジェクトページを見る →
          </a>
        </div>
      </div>

      <div className="sc-story-detail">
        <div className="sc-story-col">
          <section className="sc-story-block">
            <h4 className="sc-story-label">
              <span className="sc-story-num">①</span>挑戦前の状況
            </h4>
            <p>{item.situation}</p>
          </section>

          <section className="sc-story-block">
            <h4 className="sc-story-label">
              <span className="sc-story-num">②</span>クラファンを始めた理由
            </h4>
            <p>{item.reason}</p>
          </section>

          <section className="sc-story-block">
            <h4 className="sc-story-label">
              <span className="sc-story-num">③</span>実施したこと
            </h4>
            <ul className="sc-story-list">
              {item.actions.map(action => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </section>
        </div>

        <div className="sc-story-col">
          <section className="sc-story-block">
            <h4 className="sc-story-label">
              <span className="sc-story-num">④</span>結果
            </h4>
            <dl className="sc-story-results">
              <div className="sc-story-result">
                <dt>目標金額</dt>
                <dd>{formatYen(item.goal)}</dd>
              </div>
              <div className="sc-story-result">
                <dt>支援総額</dt>
                <dd className="is-main">{formatYen(item.raised)}</dd>
              </div>
              <div className="sc-story-result">
                <dt>支援者数</dt>
                <dd>
                  {item.supporters.toLocaleString('ja-JP')}
                  <span className="sc-story-unit">人</span>
                </dd>
              </div>
              <div className="sc-story-result">
                <dt>達成率</dt>
                <dd className="is-rate">
                  {item.achievementRate.toLocaleString('ja-JP')}
                  <span className="sc-story-unit">%</span>
                </dd>
              </div>
            </dl>
          </section>

          <section className="sc-story-block">
            <h4 className="sc-story-label">
              <span className="sc-story-num">⑤</span>実行者の感想
            </h4>
            <p className="sc-story-voice">{item.voice}</p>
            <p className="sc-story-source">（{item.voiceSource}）</p>
          </section>

          <div className="sc-story-cta">
            <p className="sc-story-cta-title">
              <span className="sc-story-num">⑥</span>あなたの企画も相談してみませんか？
            </p>
            <a href={CONSULT_ANCHOR}>無料で企画を相談する →</a>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function SuccessPage() {
  let caseIndex = 0;

  return (
    <>
      <SiteHeader current="/success" />

      {/* ===== HERO ===== */}
      <section className="sc-hero">
        <div className="sc-container">
          <p className="sc-hero-label">SUCCESS STORIES</p>
          <h1 className="sc-hero-title">
            成功<span className="sc-gold">事例</span>
          </h1>
          <p className="sc-hero-lead">
            金額の大きさより、どう準備して、どう届けたか。
            <br className="sc-br-pc" />
            <span className="sc-nowrap">3つのタイプの事例</span>
            から、自分の企画を進める手順が見えてきます。
          </p>

          {/* 2026-11-21 t iku指示: 実績は3ページ共通のコンポーネントに統一（旧: sc-stats） */}
          <div className="sc-stats-banner">
            <StatsBanner />
          </div>

          <nav className="sc-nav" aria-label="事例のカテゴリ">
            {SUCCESS_CATEGORIES.map((category, i) => (
              <a className="sc-nav-item" href={`#${category.id}`} key={category.id}>
                <span className="sc-nav-num">{String(i + 1).padStart(2, '0')}</span>
                {category.label}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* ===== CATEGORIES ===== */}
      {SUCCESS_CATEGORIES.map(category => (
        <section className="sc-category" key={category.id} id={category.id}>
          <div className="sc-container">
            <div className="sc-category-head">
              <h2 className="sc-category-title">{category.label}</h2>
              <span className="sc-category-count">{category.cases.length}件</span>
            </div>
            <p className="sc-category-lead">{category.lead}</p>

            <div className="sc-stories">
              {category.cases.map(item => {
                const index = caseIndex++;
                return <StoryCard item={item} index={index} key={item.slug} />;
              })}
            </div>
          </div>
        </section>
      ))}

      {/* ===== CTA ===== */}
      <section className="sc-cta">
        <div className="sc-container">
          <h2 className="sc-cta-title">
            あなたの企画も、
            <span className="sc-cta-tail">
              <span className="sc-gold">実現できる可能性</span>があります。
            </span>
          </h2>
          <p className="sc-cta-lead">
            目標金額やリターン、公開までの準備について、
            <br className="sc-br-pc" />
            まずは無料で相談してみませんか？
          </p>
          <div className="sc-cta-actions">
            <a href={CONSULT_ANCHOR} className="sc-cta-main">
              あなたの企画を無料で相談する →
            </a>
          </div>
        </div>
      </section>

      <div className="sc-footer">
        <p className="sc-source">
          掲載している金額・達成率・支援者数は、各プロジェクトページ（
          <a href="https://www.kamofunding.com/" target="_blank" rel="noopener noreferrer">
            KAMOファンディング公式サイト
          </a>
          ）の記載のままです。支援者数は各ページの「支援数」の値です。
        </p>
        <p>&copy; 2026 KAMO FUNDING. All rights reserved.</p>
        <LegalFooter />
      </div>
    </>
  );
}
