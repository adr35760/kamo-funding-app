'use client';

import '@/styles/kamo-icons.css';
import '@/styles/homepage.css';
import SiteHeader from '@/components/SiteHeader';
import LegalFooter from '@/components/LegalFooter';
import { CONSULT_URL, CONSULT_MINUTES } from '@/lib/seminar-info-content';

/**
 * 商品・サービスの全体像（2026-09-29 t iku指示）。
 * 2026-09-29 12:05 JST t ikuの改訂版に差し替え（全角数字は半角に統一）。
 * 専用ページが無い④⑤はリンクを張らず、下の「無料の掲載説明会へ」に相談を集める。
 */
const SERVICES: { name: string; price: string; role: string; href?: string }[] = [
  { name: '掲載説明会・セミナー', price: '無料', role: '気軽にクラファンについて知りたい！・掲載希望の方は必須受講です', href: '/seminar-info' },
  { name: 'AIクラファン設計', price: '9,800円', role: '達成率95%ノウハウを4時間で伝授！AIツールであなたの企画をその場で作成！', href: '/ai-seminar' },
  { name: 'クラファン掲載申し込み', price: '無料', role: 'KAMOファンディングに掲載したい方はこちらから！', href: '/apply-listing' },
  { name: '個別コンサル', price: '5万〜35万円', role: '90分壁打ち・ページ作成、商品構成、リターンアドバイス・伴走でページ作成・リターン戦略・募集方法まで' },
  { name: '事務局代行', price: '18万円〜', role: 'ページ制作代行・運営実務・ライブ配信サポートなど' },
  { name: 'アドバイザー養成', price: '価格設定中', role: 'クラウドファンディングのコンサル業務で生計を立てていきたい方！', href: '/partner-session-announce' },
  { name: '紹介制度（登録）', price: '無料', role: '挑戦者同士をつなぐ', href: '/partners' },
  { name: 'お仕事サポーター', price: '面談で設定', role: 'ライティング・サムネイル・ライブ配信補助など', href: '/supporters' },
];
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];

export default function HomePage() {
  return (
    <>
      {/* ヘッダーの主CTAも個別相談に（トップの主導線を1本化）。日程確認はヒーロー内の三番手に残す */}
      <SiteHeader
        current="/"
        cta={{ href: CONSULT_URL, label: '個別相談を予約', external: true }}
      />

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
            {/* ===== 主導線（2026-10-26 t iku決定）=====
                ① 個別相談（主）② 掲載申込（次）③ 日程確認（三番手・小さく残す）
                カレンダーURLと所要時間は seminar-info-content.ts の定数を共有する。 */}
            <div className="hero-cta-group">
              <a href={CONSULT_URL} target="_blank" rel="noopener noreferrer" className="btn-primary">
                個別相談を予約する（無料・{CONSULT_MINUTES}分）
              </a>
              <a href="/apply-listing" className="btn-secondary">掲載を申し込む</a>
              <a href="/lp" className="hero-cta-quiet">日程を確認する</a>
            </div>
            <div className="hero-cta-group hero-cta-seminars">
              <a href="/partner-session-announce" className="btn-seminar btn-seminar-partner">
                パートナーシップ説明会
              </a>
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
            価格は目安です。④個別コンサル・⑤事務局代行の内容・お見積りは、まず無料の個別相談でご相談ください。
          </p>
          {/* 2026-10-26: ヒーローと同じ主導線に揃える（ここが説明会のままだと主CTAが食い違う） */}
          <div className="svc-cta">
            <a href={CONSULT_URL} target="_blank" rel="noopener noreferrer" className="btn-primary">
              まずは無料の個別相談へ →（{CONSULT_MINUTES}分）
            </a>
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
              <h3>個別相談</h3>
              <p>無料・{CONSULT_MINUTES}分。掲載できるか現実的に判定します</p>
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
