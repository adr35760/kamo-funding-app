'use client';

import '@/styles/kamo-icons.css';
import '@/styles/homepage.css';
import SiteHeader from '@/components/SiteHeader';
import LegalFooter from '@/components/LegalFooter';

/**
 * 商品・サービスの全体像（2026-09-29 t iku指示）。
 * 価格は「イメージ」。①は現行価格（説明会 無料／オンライン9,800円／リアル25,000円）に合わせる
 * — t iku原案の「5,500円」は現行商品に無いため、t ikuの確認を得て現行基準にした。
 * 専用ページが無い④〜⑧はリンクを張らず、下の「無料の掲載説明会へ」に相談を集める。
 */
const SERVICES: { name: string; price: string; role: string; href?: string }[] = [
  { name: '掲載説明会・セミナー', price: '無料〜25,000円', role: '見込み客を集める入口', href: '/lp' },
  { name: 'AIクラファン設計', price: '無料〜低価格', role: '企画・リターン・ページ下書きを作る', href: '/ai-tool' },
  { name: 'クラファン掲載', price: '成功報酬型', role: 'プラットフォーム収益', href: '/apply-listing' },
  { name: '個別コンサル', price: '28.8万〜35万円', role: '企画・リターン・集客導線を伴走' },
  { name: '事務局代行', price: '18万円〜', role: 'ページ制作・運営実務' },
  { name: '継続伴走', price: '月3〜10万円', role: '終了後の集客・販売・事業化' },
  { name: 'コミュニティ', price: '月3,000〜1万円', role: '挑戦者同士をつなぐ' },
  { name: 'アドバイザー養成', price: '高単価', role: 'ノウハウを提供できる人を育成' },
];
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];

export default function HomePage() {
  return (
    <>
      <SiteHeader current="/" />

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
            <div className="hero-cta-group hero-cta-seminars">
              <a href="/ai-seminar" className="btn-seminar btn-seminar-online">
                オンラインセミナーに申し込む
              </a>
              <a href="/real-seminar" className="btn-seminar btn-seminar-real">
                リアルセミナー＆繋がる交流会に申し込む →
              </a>
            </div>
          </div>
          <div className="hero-image-wrap">
            <img src="/kamogashira-hero.png" alt="鴨頭嘉人 — 挑戦なくして、未来は明るくならない。" className="hero-image" />
            <div className="hero-achievement">
              <div className="num">達成率<span className="pct">95%</span></div>
              <div className="label">※業界トップクラス</div>
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

      {/* ===== SERVICE LADDER（2026-09-29 t iku指示で再構築） ===== */}
      <section className="svc-ladder" id="services">
        <div className="container">
          <div className="quick-links-title">
            <h2>KAMOファンディングの<span className="accent">商品・サービス</span></h2>
            <p>入口の無料説明会から、事業化までの伴走、ノウハウを教える側まで。挑戦の段階に合わせて選べます</p>
          </div>
          <div className="svc-table-wrap">
            <table className="svc-table">
              <thead>
                <tr>
                  <th scope="col">商品・サービス</th>
                  <th scope="col" className="svc-price-h">価格イメージ</th>
                  <th scope="col">役割</th>
                </tr>
              </thead>
              <tbody>
                {SERVICES.map((s, i) => (
                  <tr key={s.name}>
                    <th scope="row">
                      <span className="svc-no">{CIRCLED[i]}</span>
                      {s.href ? <a href={s.href}>{s.name}</a> : s.name}
                    </th>
                    <td className="svc-price">{s.price}</td>
                    <td>{s.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="svc-note">
            価格は目安です。④〜⑧の内容・お見積りは、まず無料の掲載説明会でご相談ください。
          </p>
          <div className="svc-cta">
            <a href="/seminar-info" className="btn-primary">まずは無料の掲載説明会へ →</a>
          </div>
        </div>
      </section>

      {/* ===== QUICK LINKS ===== */}
      <section className="quick-links">
        <div className="container">
          <div className="quick-links-title">
            <h2>いますぐ<span className="accent">参加・登録</span>できるもの</h2>
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
              <h3>AIクラファンページ作成ツール</h3>
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
              <div className="stat-label">掲載説明会の参加費</div>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <div>&copy; 2026 KAMO FUNDING. 共犯者を集め、夢を叶える場所。</div>
          <a href="/admin" className="admin-link">管理画面</a>
          <LegalFooter />
        </div>
      </footer>
    </>
  );
}
