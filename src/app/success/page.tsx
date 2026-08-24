import type { Metadata } from 'next';
import Image from 'next/image';
import SiteHeader from '@/components/SiteHeader';
import {
  SUCCESS_CATEGORIES,
  projectUrl,
  totalRaised,
  totalCaseCount,
  maxAchievementRate,
  formatYen,
  caseImage,
  CASE_IMAGE_WIDTH,
  CASE_IMAGE_HEIGHT,
} from '@/lib/success-cases';
import '@/styles/kamo-icons.css';
import '@/styles/success.css';

export const metadata: Metadata = {
  title: '成功事例 | KAMOファンディング',
  description:
    'KAMOファンディングで実現した挑戦の記録。出版記念講演会・店舗開設・新サービスローンチなど、達成率3905%を含む実績をご紹介します。',
};

export default function SuccessPage() {
  const raised = totalRaised();
  const count = totalCaseCount();
  const maxRate = maxAchievementRate();

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
            KAMOファンディングで夢を実現した挑戦者たち。
            <br />
            諦めなかった人たちの、本気の記録です。
          </p>

          <div className="sc-stats">
            <div className="sc-stat">
              <div className="sc-stat-num">{formatYen(raised)}</div>
              <div className="sc-stat-label">集まった支援金の合計</div>
            </div>
            <div className="sc-stat">
              <div className="sc-stat-num">
                {maxRate.toLocaleString('ja-JP')}
                <span className="sc-unit">%</span>
              </div>
              <div className="sc-stat-label">最高達成率</div>
            </div>
            <div className="sc-stat">
              <div className="sc-stat-num">
                {count}
                <span className="sc-unit">件</span>
              </div>
              <div className="sc-stat-label">掲載中の挑戦</div>
            </div>
          </div>
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

            <div className="sc-grid">
              {category.cases.map(item => (
                <article
                  className={`sc-card${item.hasImage ? '' : ' is-noimage'}`}
                  key={item.slug}
                >
                  {item.hasImage && (
                    <a
                      className="sc-card-thumb"
                      href={projectUrl(item.slug)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${item.title}（プロジェクトページを開く）`}
                    >
                      <Image
                        src={caseImage(item.slug)}
                        alt={item.title}
                        width={CASE_IMAGE_WIDTH}
                        height={CASE_IMAGE_HEIGHT}
                        sizes="(max-width: 768px) 100vw, 520px"
                        className="sc-card-image"
                      />
                    </a>
                  )}
                  <div className="sc-card-rate">
                    <span className="sc-card-rate-num">
                      {item.achievementRate.toLocaleString('ja-JP')}
                    </span>
                    <span className="sc-card-rate-unit">%</span>
                    <span className="sc-card-rate-label">達成</span>
                  </div>

                  <h3 className="sc-card-title">{item.title}</h3>

                  <p className="sc-card-owner">
                    {item.owner}
                    {item.ownerNote && <span className="sc-card-owner-note">（{item.ownerNote}）</span>}
                  </p>

                  {item.badge && <p className="sc-card-badge">{item.badge}</p>}

                  <p className="sc-card-desc">{item.description}</p>

                  <div className="sc-card-foot">
                    <div className="sc-card-raised">
                      <span className="sc-card-raised-label">集まった金額</span>
                      <span className="sc-card-raised-num">{formatYen(item.raised)}</span>
                    </div>
                    <a
                      className="sc-card-link"
                      href={projectUrl(item.slug)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      プロジェクトを見る →
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* ===== CTA ===== */}
      <section className="sc-cta">
        <div className="sc-container">
          <h2 className="sc-cta-title">
            次に挑戦するのは、<span className="sc-gold">あなた</span>です。
          </h2>
          <p className="sc-cta-lead">
            掲載説明会では、クラウドファンディングの進め方から
            <br className="sc-br-pc" />
            成功のポイントまでお伝えします。参加は無料です。
          </p>
          <div className="sc-cta-actions">
            <a href="/seminar-info" className="sc-cta-main">
              掲載説明会に申し込む →
            </a>
            <a href="/lp" className="sc-cta-sub">
              開催日程を確認する
            </a>
          </div>
        </div>
      </section>

      <div className="sc-footer">
        <p className="sc-source">
          掲載している金額・達成率は
          <a href="https://www.kamofunding.com/" target="_blank" rel="noopener noreferrer">
            KAMOファンディング公式サイト
          </a>
          の実績です。
        </p>
        <p>&copy; 2026 KAMO FUNDING. All rights reserved.</p>
      </div>
    </>
  );
}
