import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import StatsBanner from '@/components/StatsBanner';
import { TOTAL_RAISED_LABEL } from '@/lib/site-stats';
import { CONSULT_URL, CONSULT_MINUTES } from '@/lib/seminar-info-content';
import {
  SUCCESS_CATEGORIES,
  CaseStory,
  projectUrl,
  caseImage,
  CASE_IMAGE_WIDTH,
  CASE_IMAGE_HEIGHT,
  publishedCaseCount,
  formatYen,
  formatManYen,
} from '@/lib/success-cases';
import { FIELD_SECTION } from '@/lib/success-fields';
import '@/styles/kamo-icons.css';
import '@/styles/success.css';
import LegalFooter from '@/components/LegalFooter';
import TrackedLink from '@/components/TrackedLink';

/**
 * /success = 「金額の大きい事例を並べるページ」ではなく
 * 「自分の企画を実現するイメージが湧くページ」。
 * 事例は t iku 指定の3分類（初挑戦／新サービス／店舗・出版・地域活動）。
 * 1件ずつ「挑戦の背景／企画内容／支援の工夫／結果／成功のポイント／次の行動」の6項目で読ませる。
 * 文章は各プロジェクトページに書かれている事実のみで構成する。
 */
const CASE_COUNT = publishedCaseCount();

/**
 * 冒頭の事例一覧に並べる全事例（カテゴリ順）。
 * 一覧は「自分に近い挑戦を探す」ためのものなので、
 * 金額で序列をつけず、掲載順のまま同じ扱いで並べる。
 */
const CASE_INDEX = SUCCESS_CATEGORIES.flatMap(category =>
  category.cases.map(item => ({
    item,
    label: item.subLabel ?? category.shortLabel,
  })),
);

const META_DESCRIPTION =
  `KAMOファンディングで実現した挑戦の記録。初めてのクラウドファンディング、新サービスの立ち上げ、` +
  `店舗・出版・地域活動。${CASE_COUNT}件の事例を、挑戦の背景・企画内容・支援の工夫・結果・成功のポイントで紹介します。` +
  `累計支援総額は${TOTAL_RAISED_LABEL}（両サービス合計）。`;

export const metadata: Metadata = {
  title: '成功事例 | KAMOファンディング',
  description: META_DESCRIPTION,
  openGraph: {
    title: '成功事例 | KAMOファンディング',
    description: META_DESCRIPTION,
    type: 'website',
    url: '/success',
    siteName: 'KAMOファンディング',
    locale: 'ja_JP',
    // 🔴 2026-11-26 t iku指示: リンクを貼ったときの画像がぼやけていた（画像指定が無く、
    //    ページ内の透過ロゴが拡大されていた）。成功事例と分かる専用カードを指定する。
    images: [
      {
        url: '/og-success.jpg',
        width: 1200,
        height: 630,
        alt: '成功事例｜KAMOファンディング',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '成功事例 | KAMOファンディング',
    description: META_DESCRIPTION,
    images: ['/og-success.jpg'],
  },
};

/** 事例1件（テンプレート6項目） */
function StoryCard({ item, index }: { item: CaseStory; index: number }) {
  return (
    <article className={`sc-story${item.hasImage ? '' : ' is-noimage'}`} id={item.slug}>
      <div className="sc-story-head">
        {item.hasImage && (
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
        )}

        <div className="sc-story-headtext">
          <p className="sc-story-index">
            CASE {String(index + 1).padStart(2, '0')}
            {item.subLabel && <span className="sc-story-index-sub">{item.subLabel}</span>}
          </p>
          <h3 className="sc-story-heading">
            {item.heading}
            <span className="sc-story-heading-sub">そんな想いから始まった挑戦。</span>
          </h3>
          <p className="sc-story-summary">{item.summary}</p>
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
              <span className="sc-story-num">01</span>挑戦の背景
            </h4>
            <p>{item.background}</p>
          </section>

          <section className="sc-story-block">
            <h4 className="sc-story-label">
              <span className="sc-story-num">02</span>企画内容
            </h4>
            <p>{item.plan}</p>
            {item.planPoints && item.planPoints.length > 0 && (
              <ul className="sc-story-list sc-story-list--tight">
                {item.planPoints.map(point => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="sc-story-block">
            <h4 className="sc-story-label">
              <span className="sc-story-num">03</span>支援の工夫
            </h4>
            <ul className="sc-story-list">
              {item.effort.map(effort => (
                <li key={effort}>{effort}</li>
              ))}
            </ul>
          </section>
        </div>

        <div className="sc-story-col">
          <section className="sc-story-block">
            <h4 className="sc-story-label">
              <span className="sc-story-num">04</span>結果
            </h4>
            <dl className="sc-story-results">
              <div className="sc-story-result is-main">
                <dt>支援総額</dt>
                <dd>{formatYen(item.raised)}</dd>
              </div>
              <div className="sc-story-result">
                <dt>支援数</dt>
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
              <div className="sc-story-result is-goal">
                <dt>目標金額</dt>
                <dd>{formatYen(item.goal)}</dd>
              </div>
            </dl>
            <p className="sc-story-terms">
              <span className="sc-story-terms-label">
                {item.period ? '募集期間' : '募集終了'}
              </span>
              {item.period ?? item.endDate}
            </p>
          </section>

          <section className="sc-story-block">
            <h4 className="sc-story-label">
              <span className="sc-story-num">05</span>成功のポイント
            </h4>
            <ol className="sc-story-points">
              {item.successPoints.map(point => (
                <li key={point}>{point}</li>
              ))}
            </ol>
            {item.voice && (
              <blockquote className="sc-story-voice">
                <p className="sc-story-voice-label">{item.voiceLabel ?? '実行者の言葉'}</p>
                <p>{item.voice}</p>
                <cite className="sc-story-source">（{item.voiceSource}）</cite>
              </blockquote>
            )}
          </section>

          <div className="sc-story-cta">
            <p className="sc-story-cta-title">
              <span className="sc-story-num">06</span>あなたの企画も診断してみませんか？
            </p>
            <TrackedLink
              href={CONSULT_URL}
              target="_blank"
              rel="noopener noreferrer"
              event="cta_click"
              params={{ position: 'case' }}
            >
              無料で企画を診断する →
            </TrackedLink>
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
            金額の大きさより、どう考えて、どう届けたか。
            <br />
            <span className="sc-nowrap">ひとつずつ、</span>挑戦の中身から読み解けます。
          </p>

          {/* 2026-11-21 t iku指示: 実績は3ページ共通のコンポーネントに統一（旧: sc-stats） */}
          <div className="sc-stats-banner">
            <StatsBanner />
          </div>

          {/* 2026-11-22 t iku指示: 実績バナーの直下に掲載件数を小さく出す */}
          <p className="sc-hero-count">
            掲載している成功事例：<strong>{CASE_COUNT}</strong>件
          </p>

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

      {/* ===== 事例一覧（2026-11-22 t iku指示: 冒頭で事例を選べる一覧） ===== */}
      <section className="sc-index">
        <div className="sc-container">
          <h2 className="sc-index-title">あなたに近い挑戦を探してみてください</h2>
          <p className="sc-index-lead">
            興味のある事例を選ぶと、詳しい取り組みと結果をご覧いただけます。
          </p>

          <ul className="sc-index-list">
            {CASE_INDEX.map(({ item, label }) => (
              <li key={item.slug}>
                <TrackedLink
                  className="sc-index-card"
                  href={`#${item.slug}`}
                  event="case_select"
                  params={{ slug: item.slug }}
                >
                  {item.hasImage && (
                    <span className="sc-index-media">
                      <img
                        src={caseImage(item.slug)}
                        alt=""
                        width={CASE_IMAGE_WIDTH}
                        height={CASE_IMAGE_HEIGHT}
                        loading="lazy"
                        className="sc-index-image"
                      />
                    </span>
                  )}
                  <span className="sc-index-body">
                    <span className="sc-index-label">{label}</span>
                    <span className="sc-index-heading">{item.heading}</span>
                    <span className="sc-index-raised">
                      <span className="sc-index-raised-label">支援総額</span>
                      {formatManYen(item.raised)}
                    </span>
                  </span>
                </TrackedLink>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ===== 分野別支援実績（2026-11-22 t iku指示: 一覧の直後・詳細の前に置く） ===== */}
      <section className="sc-fields" id="fields">
        <div className="sc-container">
          <h2 className="sc-fields-title">{FIELD_SECTION.heading}</h2>
          <div className="sc-fields-lead">
            {FIELD_SECTION.lead.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>

          <h3 className="sc-fields-subtitle">{FIELD_SECTION.tableHeading}</h3>
          <table className="sc-fields-table">
            <caption className="sc-visually-hidden">{FIELD_SECTION.tableHeading}</caption>
            <thead>
              <tr>
                <th scope="col">{FIELD_SECTION.columns.field}</th>
                <th scope="col">{FIELD_SECTION.columns.projects}</th>
                <th scope="col">{FIELD_SECTION.columns.amount}</th>
              </tr>
            </thead>
            <tbody>
              {FIELD_SECTION.rows.map((row) => (
                <tr key={row.field}>
                  <th scope="row">{row.field}</th>
                  <td>{row.projects}件</td>
                  <td>{row.amount}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">合計</th>
                <td>{FIELD_SECTION.total.projects}件</td>
                <td>{FIELD_SECTION.total.amount}</td>
              </tr>
            </tfoot>
          </table>
          <p className="sc-fields-note">{FIELD_SECTION.source}</p>
          <p className="sc-fields-note">{FIELD_SECTION.scopeNote}</p>

          <div className="sc-fields-cta">
            <p className="sc-fields-cta-title">{FIELD_SECTION.cta.heading}</p>
            <ul className="sc-fields-cta-questions">
              {FIELD_SECTION.cta.questions.map((q) => (
                <li key={q}>「{q}」</li>
              ))}
            </ul>
            <p className="sc-fields-cta-lead">{FIELD_SECTION.cta.lead}</p>
            <TrackedLink
              href={CONSULT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="sc-fields-cta-button"
              event="cta_click"
              params={{ position: 'middle' }}
            >
              事業資金づくり診断を予約する
            </TrackedLink>
            <p className="sc-fields-cta-note">{FIELD_SECTION.cta.note}</p>
          </div>
        </div>
      </section>

      {/* ===== 読むときの6項目 ===== */}
      <section className="sc-guide">
        <div className="sc-container">
          <p className="sc-guide-title">各事例は6つの項目で紹介しています</p>
          <ol className="sc-guide-list">
            <li>
              <span>01</span>挑戦の背景
            </li>
            <li>
              <span>02</span>企画内容
            </li>
            <li>
              <span>03</span>支援の工夫
            </li>
            <li>
              <span>04</span>結果（支援総額・支援数・達成率）
            </li>
            <li>
              <span>05</span>成功のポイント
            </li>
            <li>
              <span>06</span>次の行動（無料診断）
            </li>
          </ol>
        </div>
      </section>

      {/* ===== CATEGORIES ===== */}
      {SUCCESS_CATEGORIES.map((category, i) => (
        <section
          className={`sc-category${i % 2 === 1 ? ' is-alt' : ''}`}
          key={category.id}
          id={category.id}
        >
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

      {/* ===== CTA（2026-11-21 t iku指示: 事業資金づくり診断をメイン・掲載説明会をサブに） ===== */}
      <section className="sc-cta" id="consult">
        <div className="sc-container">
          <h2 className="sc-cta-title">次に挑戦するのは、あなたです。</h2>
          <p className="sc-cta-sub">
            あなたの企画も、クラファンで実現できるかもしれません。
          </p>
          <ul className="sc-cta-questions">
            <li>「自分の企画でもクラファンができるのか？」</li>
            <li>「どんなリターンを用意すればいいのか？」</li>
            <li>「目標金額はいくらに設定すればいいのか？」</li>
          </ul>
          <p className="sc-cta-lead">
            まずはクラファン事業資金づくり診断（無料{CONSULT_MINUTES}分）で、あなたの企画についてお聞かせください。
            企画内容や目標金額、公開までの準備について一緒に整理します。
          </p>
          <div className="sc-cta-actions">
            <TrackedLink
              href={CONSULT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="sc-cta-main"
              event="cta_click"
              params={{ position: 'footer' }}
            >
              事業資金づくり診断を予約する
            </TrackedLink>
          </div>
          <p className="sc-cta-note">
            ※診断は無料です。掲載手数料や有償サポート費用については別途ご案内します。
          </p>

          <p className="sc-cta-flow">
            なお、正式な掲載に進む際は、無料掲載説明会への参加が必要です。
            説明会では、掲載条件や手数料、公開までの流れをご案内します。
          </p>

          <div className="sc-cta-sub-block">
            <p className="sc-cta-sub-label">
              まず全体像を知りたい方は、無料掲載説明会からご参加いただくこともできます。
            </p>
            <a href="/seminar-info#schedule" className="sc-cta-sub-link">
              無料掲載説明会の日程を確認する →
            </a>
          </div>
        </div>
      </section>

      <div className="sc-footer">
        <p className="sc-source">
          掲載している金額・達成率・支援数・募集期間は、各プロジェクトページ（
          <a href="https://www.kamofunding.com/" target="_blank" rel="noopener noreferrer">
            KAMOファンディング公式サイト
          </a>
          ）の「支援数」の記載のままです。開始日がページに記載されていない事例は、募集終了日のみを表示しています。
        </p>
        <p className="sc-source">
          挑戦の背景・企画内容・支援の工夫・成功のポイントは、各プロジェクトページに記載の内容を整理したものです。成果を保証するものではありません。
        </p>
        <p>&copy; 2026 KAMO FUNDING. All rights reserved.</p>
        <LegalFooter />
      </div>
    </>
  );
}
