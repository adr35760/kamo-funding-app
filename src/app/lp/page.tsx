'use client';

import { useEffect, useState } from 'react';
import '@/styles/kamo-icons.css';
import '@/styles/kamo-lp.css';
import { formatEventDateJa, eventCardParts, cleanTitle, EventLike } from '@/lib/event-format';

interface EventOption extends EventLike {}

export default function LPPage() {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // 説明会（pillar=1）イベントのみ表示用にフィルタ
  const infoEvents = events.filter(e => !e.pillar || e.pillar === 1);

  // 動的にイベント一覧を取得（EngineerのAPIから）
  useEffect(() => {
    fetch('/api/events')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        const list: EventOption[] = (data.events || data || []).map((e: EventLike) => ({ ...e }));
        if (list.length > 0) setEvents(list);
      })
      .catch(() => {
        // フォールバック: 実際のイベント日程（API取得失敗時）
        setEvents([
          { id: '0ae42e1f-1a2b-4c3d-8e5f-6a7b8c9d0e1f', title: '第1回 KAMOファンディング無料掲載説明会', event_date: '2026-08-18T19:30:00+09:00', pillar: 1, duration_minutes: 90 },
          { id: '851bfae5-2b3c-4d5e-9f6a-7b8c9d0e1f2a', title: '第2回 KAMOファンディング無料掲載説明会', event_date: '2026-08-28T19:30:00+09:00', pillar: 1, duration_minutes: 90 },
          { id: '94f5db1d-3c4d-4e6f-a7b8-c9d0e1f2a3b4', title: '第3回 KAMOファンディング無料掲載説明会', event_date: '2026-09-15T19:30:00+09:00', pillar: 1, duration_minutes: 90 },
        ]);
      });
  }, []);

  // ヘッダースクロール効果
  useEffect(() => {
    const onScroll = () => {
      const header = document.getElementById('header');
      if (header) header.classList.toggle('scrolled', window.scrollY > 50);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // スムーススクロール
  useEffect(() => {
    const handler = (e: Event) => {
      const a = e.target as HTMLAnchorElement;
      if (a.tagName === 'A' && a.getAttribute('href')?.startsWith('#')) {
        const target = document.querySelector(a.getAttribute('href')!);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // フォーム送信 → /api/apply (Engineer実装済み)
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    formData.forEach((v, k) => { data[k] = v as string; });
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '申込に失敗しました');
      }
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '申込に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFaq = (e: React.MouseEvent) => {
    (e.currentTarget as HTMLElement).parentElement?.classList.toggle('open');
  };

  return (
    <>
      {/* ===== HEADER ===== */}
      <header className="header" id="header">
        <div className="header-inner">
          <a href="/" className="logo">
            <img src="/kamo-logo-main.jpg" alt="KAMOファンディング" style={{height:'36px',width:'auto'}} />
          </a>
          <nav className="header-nav">
            <a href="#about">説明会とは</a>
            <a href="#pillars">4本柱</a>
            <a href="#schedule">開催日程</a>
            <a href="#faq">よくある質問</a>
            <a href="#apply" className="header-cta">お申込み</a>
          </nav>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section className="hero" id="about">
        <div className="container">
          <div className="hero-inner">
            <div className="hero-content">
              <div className="hero-badge">
                <span className="hero-badge-dot"></span>
                月2回開催・参加費無料
              </div>
              <h1>
                <span className="accent">夢を叶える</span>実現装置<br />
                <span className="gold">共犯者</span>を集めよう。<br />
                KAMOファンディング<br />活用プログラム
              </h1>
              <p className="hero-sub">
                クラウドファンディングは、お金を集めるのではなく——<br />
                「あなたの夢を応援したい」と言ってくれる人を集める仕組みです。<br />
                説明会・セミナーで、掲載から成功までの全てが分かります。<br />
                リアル交流会で挑戦者とのつながりを積極的におこないます！
              </p>
              <div className="hero-cta-group">
                <a href="#apply" className="btn-primary">説明会に申し込む →</a>
                <a href="#schedule" className="btn-secondary">開催日程を見る</a>
              </div>
            </div>
            <div className="hero-visual">
              <img src="/lp-hero.png" alt="KAMOファンディング — 夢を叶える場所、共犯者を集めよう" style={{ width: '100%', height: 'auto', borderRadius: '16px', objectFit: 'contain' }} />
            </div>
          </div>
        </div>
      </section>

      {/* ===== STATS BAR ===== */}
      <section className="stats-bar">
        <div className="container">
          <div className="stats-inner">
            <div className="stat-item">
              <div className="stat-number">1,159<span className="unit">%</span></div>
              <div className="stat-label">平均目標達成率</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">¥10M<span className="unit">+</span></div>
              <div className="stat-label">最高支援額</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">2<span className="unit">回/月</span></div>
              <div className="stat-label">説明会開催頻度</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">¥0</div>
              <div className="stat-label">参加費・掲載費</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 4 PILLARS ===== */}
      <section className="section section-alt" id="pillars">
        <div className="container">
          <div className="section-title">
            <span className="label">PROJECT STRUCTURE</span>
            <h2>今の現状を突破したいと思ってる方へ！<span className="accent">４つの具体策</span>提案します！</h2>
            <p style={{ whiteSpace: 'nowrap', fontSize: '14px' }}>認知からコミット、そして伝道者へ。見込み客を段階的に引き上げるファネル構造。</p>
          </div>
          <div className="pillars-grid">
            <div className="pillar-card">
              <div className="pillar-number">01</div>
              <span className="pillar-tag">集客</span>
              <h3>掲載説明会（月2回）</h3>
              <p>KAMOファンディングの掲載方法から成功のコツまで、参加費無料で学べます。</p>
              <ul>
                <li>KAMOファンディングの特徴 — 総支援額17億円！達成率95%のノウハウの一端をご紹介</li>
                <li>クラウドファンディングの集める構造を理解する — クラファンで資金を集める仕組みと、成功するプロジェクトの共通パターン</li>
                <li>応援支援で高額支援を集めるノウハウを伝授 — スポンサー・VIP設計と、経営者からの高額支援を獲得する戦略</li>
              </ul>
              <p style={{ fontSize: '13px', color: '#E60012', fontWeight: '700', marginTop: '8px' }}>※KAMOファンディングに掲載希望者は参加必須です。</p>
            </div>
            <div className="pillar-card">
              <div className="pillar-number">02</div>
              <span className="pillar-tag">教育・熱量</span>
              <h3>【鴨頭嘉人特別参加会】AI時代のクラウドファンディング活用セミナー</h3>
              <p>本業が停滞している方向けに、クラファンで売上を上げる短期キャンペーン手法を解説。<br />※各会20名限定（有料）</p>
              <ul>
                <li>鴨頭嘉人が後半で熱量を注入！</li>
                <li>3つの設計＋3つのポイント</li>
                <li>AI活用でページ作成を簡略化</li>
              </ul>
            </div>
            <div className="pillar-card">
              <div className="pillar-number">03</div>
              <span className="pillar-tag">深掘り・コミュニティ</span>
              <h3>リアルセミナー＆懇親会</h3>
              <p>池袋で約20名規模のリアルイベントを定期開催。鴨頭嘉人参加する会もあります！即売り切れなので詳細チェックを忘れずに！</p>
              <ul>
                <li>二か月毎に池袋開催</li>
                <li>約20名の交流会的な深いつながり</li>
                <li>経営者・挑戦者しかない濃い交流会</li>
              </ul>
            </div>
            <div className="pillar-card">
              <div className="pillar-number">04</div>
              <span className="pillar-tag">エコシステム拡張</span>
              <h3>パートナーシッププログラム説明会</h3>
              <p>あなたのできることを、応援される仕事へ。<br />挑戦者の想いを、資金・仲間・顧客が集まるプロジェクトに変える専門家を育成します</p>
              <ul>
                <li>アドバイザー養成講座</li>
                <li>紹介パートナープログラム</li>
                <li>プロジェクトサポーター育成制度</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SCHEDULE ===== */}
      <section className="section" id="schedule">
        <div className="container">
          <div className="section-title">
            <span className="label">SCHEDULE</span>
            <h2>開催<span className="accent">日程</span></h2>
            <p>各回定員になり次第締切となります。お早めにお申込みください。</p>
          </div>
          <div className="schedule-list">
            {infoEvents.length > 0 ? (
              infoEvents.map(ev => {
                const p = eventCardParts(ev.event_date, ev.duration_minutes);
                return (
                  <div className="schedule-item" key={ev.id}>
                    <div className="schedule-date">
                      <div className="date-main">
                        <span className="date-month">{p.month}</span>
                        <span className="date-day">{p.day}</span>
                        <span className="date-weekday">{p.weekdayKakko}</span>
                      </div>
                      <div className="schedule-time">{p.timeRange}</div>
                    </div>
                    <div className="schedule-info">
                      <h4>{cleanTitle(ev.title)}</h4>
                      <div className="tags">
                        <span className="tag tag-online">オンライン</span>
                        <span className="tag tag-free">参加費無料</span>
                      </div>
                    </div>
                    <div className="schedule-status status-open">募集中</div>
                  </div>
                );
              })
            ) : (
              <>
                <div className="schedule-item">
                  <div className="schedule-date">
                    <div className="date-main">
                      <span className="date-month">8月</span>
                      <span className="date-day">18</span>
                      <span className="date-weekday">（火）</span>
                    </div>
                    <div className="schedule-time">19:30〜21:00</div>
                  </div>
                  <div className="schedule-info">
                    <h4>第1回 KAMOファンディング無料掲載説明会</h4>
                    <div className="tags">
                      <span className="tag tag-online">オンライン</span>
                      <span className="tag tag-free">参加費無料</span>
                    </div>
                  </div>
                  <div className="schedule-status status-open">募集中</div>
                </div>
                <div className="schedule-item">
                  <div className="schedule-date">
                    <div className="date-main">
                      <span className="date-month">8月</span>
                      <span className="date-day">28</span>
                      <span className="date-weekday">（金）</span>
                    </div>
                    <div className="schedule-time">19:30〜21:00</div>
                  </div>
                  <div className="schedule-info">
                    <h4>第2回 KAMOファンディング無料掲載説明会</h4>
                    <div className="tags">
                      <span className="tag tag-online">オンライン</span>
                      <span className="tag tag-free">参加費無料</span>
                    </div>
                  </div>
                  <div className="schedule-status status-open">募集中</div>
                </div>
                <div className="schedule-item">
                  <div className="schedule-date">
                    <div className="date-main">
                      <span className="date-month">9月</span>
                      <span className="date-day">15</span>
                      <span className="date-weekday">（火）</span>
                    </div>
                    <div className="schedule-time">19:30〜21:00</div>
                  </div>
                  <div className="schedule-info">
                    <h4>第3回 KAMOファンディング無料掲載説明会</h4>
                    <div className="tags">
                      <span className="tag tag-online">オンライン</span>
                      <span className="tag tag-free">参加費無料</span>
                    </div>
                  </div>
                  <div className="schedule-status status-open">募集中</div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ===== FORM SECTION ===== */}
      <section className="form-section" id="apply">
        <div className="container">
          <div className="form-card">
            <h2>説明会に<span className="accent">申し込む</span></h2>
            <p className="form-sub">以下の情報をご入力ください。確認メールが自動送信されます。</p>

            {submitted ? (
              <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                <div className="kamo-icon kamo-icon-check-lg" style={{ width: '48px', height: '48px', marginBottom: '16px' }}></div>
                <h3 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '8px' }}>
                  申込完了！
                </h3>
                <p style={{ color: 'var(--kamo-gray)', fontSize: '15px' }}>
                  確認メールを送信しました。当日までにお待ちください。
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label>お名前 <span className="required">必須</span></label>
                    <input type="text" name="name" required placeholder="鴨頭 太郎" />
                  </div>
                  <div className="form-group">
                    <label>メールアドレス <span className="required">必須</span></label>
                    <input type="email" name="email" required placeholder="example@email.com" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>会社名・団体名</label>
                    <input type="text" name="company" placeholder="株式会社〇〇" />
                  </div>
                  <div className="form-group">
                    <label>参加希望回 <span className="required">必須</span></label>
                    <select name="event_id" required>
                      <option value="">選択してください</option>
                      {infoEvents.length > 0 ? (
                        infoEvents.map(ev => (
                          <option key={ev.id} value={ev.id}>{formatEventDateJa(ev.event_date, ev.duration_minutes)} — {cleanTitle(ev.title)}</option>
                        ))
                      ) : (
                        <>
                          <option value="0ae42e1f-1a2b-4c3d-8e5f-6a7b8c9d0e1f">8/18（火）19:30〜21:00 — 第1回 掲載説明会</option>
                          <option value="851bfae5-2b3c-4d5e-9f6a-7b8c9d0e1f2a">8/28（金）19:30〜21:00 — 第2回 掲載説明会</option>
                          <option value="94f5db1d-3c4d-4e6f-a7b8-c9d0e1f2a3b4">9/15（火）19:30〜21:00 — 第3回 掲載説明会</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>参加経路（どこで知りましたか？）</label>
                  <select name="source">
                    <option value="">選択してください</option>
                    <option value="youtube">YouTube（クラファンの学校）</option>
                    <option value="sns">SNS（X / Instagram / Facebook）</option>
                    <option value="referral">知人の紹介</option>
                    <option value="web">Web検索</option>
                    <option value="other">その他</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>クラファンでの挑戦内容（任意）</label>
                  <textarea name="challenge" placeholder="実現したい夢やプロジェクトがあれば教えてください"></textarea>
                </div>
                {error && (
                  <p style={{ color: 'var(--kamo-red)', fontSize: '14px', marginBottom: '12px' }}>
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  className="form-submit"
                  disabled={submitting}
                  style={submitting ? { opacity: 0.7 } : {}}
                >
                  {submitting ? '送信中...' : '申し込む →'}
                </button>
                <p className="form-note">
                  ※ 申込後に確認メールが自動送信されます<br />
                  ※ 個人情報は本説明会の運営目的のみに使用します
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="section section-alt" id="faq">
        <div className="container">
          <div className="section-title">
            <span className="label">FAQ</span>
            <h2>よくある<span className="accent">質問</span></h2>
          </div>
          <div className="faq-list">
            <div className="faq-item">
              <div className="faq-question" onClick={toggleFaq}>
                参加費はかかりますか？
              </div>
              <div className="faq-answer"><div className="faq-answer-inner">
                説明会・一部のセミナーは参加費無料です。鴨頭参加会及び経営者懇親会は有料になります。
              </div></div>
            </div>
            <div className="faq-item">
              <div className="faq-question" onClick={toggleFaq}>
                クラウドファンディングの経験がなくても大丈夫ですか？
              </div>
              <div className="faq-answer"><div className="faq-answer-inner">
                はい、大丈夫です。説明会は初心者向けの基礎から始まります。オンラインセミナーでより実践的な内容を学べます。
              </div></div>
            </div>
            <div className="faq-item">
              <div className="faq-question" onClick={toggleFaq}>
                説明会に参加した後、どうなりますか？
              </div>
              <div className="faq-answer"><div className="faq-answer-inner">
                説明会参加後、希望者にはオンラインセミナー→リアル懇親会と段階的に進んでいただけます。各段階で掲載に向けたサポートを受けられます。
              </div></div>
            </div>
            <div className="faq-item">
              <div className="faq-question" onClick={toggleFaq}>
                AIツールでクラファンページが作れると聞きましたが？
              </div>
              <div className="faq-answer"><div className="faq-answer-inner">
                はい。セミナーではAIを活用したページ作成テンプレートとリターン設計のひな形生成ツールを体験いただけます。他のプラットフォームにはない差別化機能です。
              </div></div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="footer">
        <div className="container">
          <div className="footer-inner">
            <div className="footer-brand">
              <div className="logo">
                <img src="/kamo-logo-main.jpg" alt="KAMOファンディング" style={{height:'28px',width:'auto'}} />
              </div>
              <p>
                共犯者を集め、夢を叶える場所。<br />
                鴨頭嘉人が推進する日本で最も熱いクラウドファンディングサービス。
              </p>
            </div>
            <div className="footer-links">
              <div>
                <h5>サービス</h5>
                <ul>
                  <li><a href="https://www.kamofunding.com/">KAMOファンディング</a></li>
                  <li><a href="https://www.kamofunding.com/projects">プロジェクト一覧</a></li>
                  <li><a href="https://www.kamofunding.com/pages/about">KAMOとは</a></li>
                </ul>
              </div>
              <div>
                <h5>イベント</h5>
                <ul>
                  <li><a href="#about">掲載説明会</a></li>
                  <li><a href="#pillars">CFセミナー</a></li>
                  <li><a href="#schedule">懇親会</a></li>
                </ul>
              </div>
              <div>
                <h5>お問い合わせ</h5>
                <ul>
                  <li><a href="#apply">お申込み</a></li>
                  <li><a href="#faq">よくある質問</a></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            &copy; 2026 KAMO FUNDING. All rights reserved.
          </div>
        </div>
      </footer>
    </>
  );
}
