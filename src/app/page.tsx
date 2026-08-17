'use client';

import '@/styles/kamo-icons.css';
import '@/styles/homepage.css';

export default function HomePage() {
  return (
    <>
      <header className="header">
        <div className="header-inner">
          <a href="/"><img src="/kamo-logo-main.jpg" alt="KAMOファンディング" className="header-logo" /></a>
          <nav className="header-nav">
            <a href="/seminar-info">掲載説明会</a>
            <a href="/partner-session-announce">パートナーシップ</a>
            <a href="/partners">パートナー登録</a>
            <a href="/supporters">サポーター登録</a>
            <a href="/ai-tool">AIツール</a>
            <a href="/lp" className="header-cta">詳細を見る</a>
          </nav>
        </div>
      </header>

      {/* ===== HERO with Kamogashira Image ===== */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-text">
            <div className="hero-badge">
              <span className="hero-badge-dot"></span>
              KAMOファンディング — 共犯者を集め、夢を叶える場所
            </div>
            <h1 className="hero-quote">
              <span className="red">挑戦</span>なくして、<br />
              <span className="red">未来</span>は明るくならない。
            </h1>
            <div className="hero-divider"></div>
            <ul className="hero-bullets">
              <li>あなたの<span className="red">アイデア</span>を聞かせてください</li>
              <li>KAMOファンディングが<span className="red">伴走支援</span>します</li>
              <li>積極的に経営者と繋ぐ「交流会」も実施！</li>
            </ul>
            <div className="hero-cta-group">
              <a href="/seminar-info" className="btn-primary">掲載説明会に申し込む →</a>
              <a href="/partner-session-announce" className="btn-secondary">パートナーシップ説明会</a>
            </div>
          </div>
          <div className="hero-image-wrap">
            <img src="/kamogashira-hero.png" alt="鴨頭嘉人 — 挑戦なくして、未来は明るくならない。" className="hero-image" />
            <div className="hero-achievement">
              <div className="num">95%</div>
              <div className="label">初日達成率</div>
            </div>
          </div>
        </div>
        <div className="hero-seminar-bar">
          <div className="seminar-title">
            <span className="gold">達成率95%のノウハウをお伝えします！</span>
          </div>
          <a href="/seminar-info" className="seminar-cta">セミナーに申し込む →</a>
        </div>
      </section>

      {/* ===== CHALLENGE BANNER ===== */}
      <section className="challenge">
        <img src="/kamo-challenge.png" alt="鴨頭嘉人 — Challenge like a baby." />
        <div className="challenge-overlay">
          <a href="/seminar-info" className="challenge-cta">挑戦を始める →</a>
          <a href="https://www.kamofunding.com/" target="_blank" rel="noopener noreferrer" className="challenge-cta" style={{ background: 'transparent', border: '2px solid white', color: 'white', marginTop: '24px', fontWeight: '900' }}>KAMOファンディング サイトを見る →</a>
        </div>
      </section>

      {/* ===== QUICK LINKS ===== */}
      <section className="quick-links">
        <div className="container">
          <div className="quick-links-title">
            <h2>KAMOファンディングの<span className="accent">サービス</span></h2>
            <p>あなたの目的に合わせて選べます</p>
          </div>
          <div className="links-grid">
            <a href="/seminar-info" className="link-card red">
              <div className="kamo-icon kamo-icon-flame lg"></div>
              <h3>掲載説明会</h3>
              <p>月2回・オンライン・無料。クラファンの使い方が学べる</p>
            </a>
            <a href="/partners" className="link-card green">
              <div className="kamo-icon kamo-icon-handshake lg"></div>
              <h3>紹介パートナー</h3>
              <p>紹介するだけ。対象額（総支援金額ー手数料ー消費税）の2%が報酬。登録無料</p>
            </a>
            <a href="/supporters" className="link-card gold">
              <div className="kamo-icon kamo-icon-star lg"></div>
              <h3>プロジェクトサポーター</h3>
              <p>プロジェクトを伴走支援。コミュニティ参加型</p>
            </a>
            <a href="/ai-tool" className="link-card red">
              <div className="kamo-icon kamo-icon-robot lg"></div>
              <h3>AIクラファン支援ツール</h3>
              <p>AIがクラファンページのひな形を自動生成（LIVE動作中）</p>
            </a>
            <a href="/partner-session-announce" className="link-card red">
              <div className="kamo-icon kamo-icon-megaphone lg"></div>
              <h3>パートナーシッププログラム説明会に参加する！</h3>
              <p>あなたのスキルで挑戦者のサポートお願いします！<br />（説明会カテゴリー）アドバイザー・PJサポーター・紹介パートナー</p>
            </a>
            <a href="/lp" className="link-card gold">
              <div className="kamo-icon kamo-icon-clipboard lg"></div>
              <h3>オンライン・リアルセミナー＆経営者交流会</h3>
              <p>鴨頭嘉人参加のセミナー及び、リアルで会える交流会の開催情報はこちらからチェック！<br />※人数制限があるのでお早めに！</p>
            </a>
          </div>
        </div>
      </section>

      {/* ===== STATS ===== */}
      <section className="stats">
        <div className="container">
          <div className="stats-inner">
            <div className="stat-item">
              <div className="stat-number">95<span className="unit">%</span></div>
              <div className="stat-label">初日達成率</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">1,159<span className="unit">%</span></div>
              <div className="stat-label">平均目標達成率</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">¥10M<span className="unit">+</span></div>
              <div className="stat-label">最高支援額</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">¥0</div>
              <div className="stat-label">参加費・掲載費</div>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">&copy; 2026 KAMO FUNDING. 共犯者を集め、夢を叶える場所。</div>
      </footer>
    </>
  );
}
