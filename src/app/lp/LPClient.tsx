'use client';

import { useEffect, useRef, useState } from 'react';
import '@/styles/kamo-icons.css';
import '@/styles/kamo-lp.css';
import { formatEventDateJa, eventCardParts, cleanTitle, EventLike } from '@/lib/event-format';
import SiteHeader from '@/components/SiteHeader';
import { captureUtm, getUtmPayload } from '@/lib/utm';
import LegalFooter from '@/components/LegalFooter';
import { CONSULT_URL, CONSULT_MINUTES } from '@/lib/seminar-info-content';
import StatsBanner from '@/components/StatsBanner';
import { ACHIEVEMENT_RATE_LABEL, KAMO_RAISED_LABEL } from '@/lib/site-stats';
import TrackedLink from '@/components/TrackedLink';
import { track } from '@/lib/analytics';

interface EventOption extends EventLike {}

export default function LPClient({
  initialEvents = [],
  eventsResolved = false,
}: {
  initialEvents?: EventOption[];
  /** サーバー側でDBを読めたか（true かつ 0件＝本当に公開日程が無い） */
  eventsResolved?: boolean;
}) {
  // サーバー側で取得済みの日程を初期値にする（SSR時点でフォームに選択肢が入る）
  const [events, setEvents] = useState<EventOption[]>(initialEvents);
  const [eventsLoaded, setEventsLoaded] = useState(eventsResolved || initialEvents.length > 0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // 説明会（pillar=1）イベントのみ表示用にフィルタ
  const infoEvents = events.filter(e => !e.pillar || e.pillar === 1);
  /**
   * 2026-10-27 t iku決定（B＝申込があったときだけ開催）:
   * 公開日程が0件のときは「説明会の日程は個別にご案内」に差し替える。
   * 🔴 空のセレクト・送信時500を作らないため、フォーム自体を出さない。
   */
  const noSchedule = eventsLoaded && infoEvents.length === 0;

  // 動的にイベント一覧を取得（EngineerのAPIから）
  useEffect(() => {
    if (eventsResolved || initialEvents.length > 0) return; // サーバー取得済みなら再取得不要
    fetch('/api/events')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        const list: EventOption[] = (data.events || data || []).map((e: EventLike) => ({ ...e }));
        setEvents(list);
      })
      .catch(() => {
        // 固定日程をフォールバックにすると過去日程が復活するため、何も出さない
        setEvents([]);
      })
      .finally(() => setEventsLoaded(true));
  }, [initialEvents.length, eventsResolved]);

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
  // 流入元（UTM）をURLから読み取り、申込送信まで保持する
  // （スクロールや再描画で消えないよう sessionStorage に保存する）
  useEffect(() => {
    captureUtm();
  }, []);

  /** フォームの最初の操作で form_start を1回だけ送る（/ と同じ考え方） */
  const formStartedRef = useRef(false);
  const onFormStart = () => {
    if (formStartedRef.current) return;
    formStartedRef.current = true;
    track('form_start', { form: 'lp' });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    formData.forEach((v, k) => { data[k] = v as string; });
    // 流入元（UTM）を申込データに添付する。取れていなければ何も付かない（申込は必ず通す）
    Object.assign(data, getUtmPayload());
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
      // 送信が通った時だけ form_submit を送る（入力値は載せない）
      track('form_submit', { form: 'lp' });
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
      {/* ===== HEADER =====
          ⚠️ ヘッダーCTAは説明会フォームのまま（2026-10-26 判断）。
          /lp のPCヘッダーはナビ項目が多いため1280pxで既に横に溢れており、
          文言を長くすると溢れが増える。主CTAの差し替えはヒーローで行う。 */}
      <SiteHeader
        cta={{ href: '#apply', label: 'お申込み' }}
        pageLinks={[
          { href: '#about', label: '説明会とは' },
          { href: '#pillars', label: '説明会で分かること' },
          { href: '#schedule', label: '開催日程' },
          { href: '#faq', label: 'よくある質問' },
        ]}
      />

      {/* ===== HERO ===== */}
      <section className="hero" id="about">
        <div className="container">
          <div className="hero-inner">
            <div className="hero-content">
              <div className="hero-badge">
                <span className="hero-badge-dot"></span>
                オンライン開催・参加費無料
              </div>
              {/* 2026-11-22 t iku指示: 「4つのサービス紹介」ではなく、
                  クラファン掲載を考えている人の入口として対象者・タイトルを見直す。
                  開催日時・形式（90分講座への変更）は未確定のため触らない。 */}
              <h1>
                <span className="accent">クラファン掲載まで</span>の<br />
                すべてが分かる<br />
                <span className="gold">無料オンライン説明会</span>
              </h1>
              <p className="hero-sub">
                新商品、出版、店舗開業、イベント、地域活動。<br />
                クラファンでの実現を考えている方のための説明会です。<br />
                企画の立て方、目標金額とリターンの設計、公開までの準備、<br />
                応援を集める考え方を、実際の成功事例をもとに解説します。
              </p>
              {/* 主導線（2026-10-26 t iku決定）: 事業資金づくり診断が主・説明会申込と日程が二番手。
                  URLと所要時間は seminar-info-content.ts の定数を共有する。 */}
              <div className="hero-cta-group">
                <TrackedLink
                  href={CONSULT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                  event="cta_click"
                  params={{ position: 'fv' }}
                >
                  事業資金づくり診断を予約する<span style={{ whiteSpace: 'nowrap' }}>（無料・{CONSULT_MINUTES}分）</span>
                </TrackedLink>
                <TrackedLink
                  href="#apply"
                  className="btn-secondary"
                  event="cta_click"
                  params={{ position: 'schedule' }}
                >
                  {noSchedule ? '説明会のご案内を見る →' : '説明会に申し込む →'}
                </TrackedLink>
                <TrackedLink
                  href="#schedule"
                  className="hero-cta-quiet"
                  event="cta_click"
                  params={{ position: 'schedule' }}
                >
                  開催日程を見る
                </TrackedLink>
              </div>
            </div>
            <div className="hero-visual">
              {/* 2026-11-22: 旧ヒーロー画像には「95%」「90分」が焼き込まれていて
                  現在の実績・開催形式と食い違うため、実際の説明会の写真に差し替える。 */}
              <img src="/seminar-community.jpg" alt="オンライン説明会に参加する皆さん" style={{ width: '100%', height: 'auto', borderRadius: '16px', objectFit: 'cover' }} />
            </div>
          </div>
        </div>
      </section>

      {/* ===== 実績バナー（2026-11-21 t iku指示・3ページ共通コンポーネント） =====
          2026-11-22 t iku指示: 上の旧 stats-bar（1,159%／¥10M+ 等）は数値が古く
          StatsBanner と二重表示になるため撤去し、このバナーに一本化した。 */}
      <section className="lp-stats-banner" aria-label="クラウドファンディング支援実績">
        <div className="container">
          <StatsBanner />
        </div>
      </section>

      {/* ===== 説明会で分かること（2026-11-22 t iku指示） =====
          旧「4つの具体策」は説明会・有料セミナー・交流会・パートナー制度の紹介で、
          クラファン掲載を考えている人の入口になっていなかったため、
          講座内容（企画・設計・準備・集客）の4項目に絞り直した。
          パートナー・交流会の案内はページ下部の小さな導線に移す。 */}
      <section className="section section-alt" id="pillars">
        <div className="container">
          <div className="section-title">
            <span className="label">PROGRAM</span>
            <h2>説明会で<span className="accent">分かること</span></h2>
            <p className="nowrap-pc">クラファンを実施したい人のための、実践的な4つの内容です。</p>
          </div>
          <div className="pillars-grid">
            <div className="pillar-card">
              <div className="pillar-number">01</div>
              <span className="pillar-tag">企画</span>
              <h3>企画の立て方</h3>
              <p>何を、誰に、どう届けるか。頭の中のアイデアを、クラファンの企画のかたちにする考え方を解説します。</p>
              <ul>
                <li>実現したいことの整理の仕方</li>
                <li>実際の成功事例から学ぶ企画のつくり方</li>
                <li>クラファンに向く企画・向かない企画</li>
              </ul>
            </div>
            <div className="pillar-card">
              <div className="pillar-number">02</div>
              <span className="pillar-tag">設計</span>
              <h3>目標金額とリターン設計</h3>
              <p>無理のない目標金額の決め方と、支援してくれる人が選びやすいリターンの組み立て方を学びます。</p>
              <ul>
                <li>目標金額と期間の現実的な決め方</li>
                <li>リターンの種類と価格の考え方</li>
                <li>高額支援につながるスポンサー・VIP設計</li>
              </ul>
            </div>
            <div className="pillar-card">
              <div className="pillar-number">03</div>
              <span className="pillar-tag">準備</span>
              <h3>公開までの準備</h3>
              <p>ページ制作から公開日までのスケジュールまで。掲載が決まってから公開するまでに必要なことを整理します。</p>
              <ul>
                <li>プロジェクトページの作り方</li>
                <li>公開前に用意するもの</li>
                <li>掲載までの流れとスケジュール</li>
              </ul>
            </div>
            <div className="pillar-card">
              <div className="pillar-number">04</div>
              <span className="pillar-tag">集客</span>
              <h3>応援を集める考え方</h3>
              <p>公開前に味方を増やし、支援につなげる方法を、実際の事例をもとに解説します。</p>
              <ul>
                <li>公開前から応援してくれる人を集める方法</li>
                <li>支援が広がるページ・発信の作り方</li>
                <li>期間中の動き方と終了までの進め方</li>
              </ul>
            </div>
          </div>
          {/* 事業資金づくり診断への導線を、説明会の内容の直後にも置く */}
          <div className="lp-consult-band">
            <p>自分の企画でどうなるか知りたい方は、事業資金づくり診断が早いです。</p>
            <TrackedLink
              href={CONSULT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              event="cta_click"
              params={{ position: 'middle' }}
            >
              事業資金づくり診断を予約する<span style={{ whiteSpace: 'nowrap' }}>（無料・{CONSULT_MINUTES}分）</span>
            </TrackedLink>
          </div>
        </div>
      </section>

      {/* ===== SCHEDULE ===== */}
      <section className="section" id="schedule">
        <div className="container">
          <div className="section-title">
            <span className="label">SCHEDULE</span>
            <h2>開催<span className="accent">日程</span></h2>
            <p>{noSchedule
              ? '日程は、ご希望に応じて設定します。まずは事業資金づくり診断でご都合をお聞かせください。'
              : '各回定員になり次第締切となります。お早めにお申込みください。'}</p>
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
                    <div className={ev.finished ? 'schedule-status' : 'schedule-status status-open'}
                      style={ev.finished ? { background: '#9E9E9E', color: '#fff' } : undefined}>
                      {ev.finished ? '終了' : '募集中'}
                    </div>
                  </div>
                );
              })
            ) : eventsLoaded ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', background: '#FFF5F5', borderRadius: '16px', border: '2px solid #FFE0E0' }}>
                <p style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>現在、説明会の日程は個別にご案内しています。</p>
                <p style={{ fontSize: '15px', color: '#666', marginBottom: '18px' }}>ご希望に応じて日程を設定します。まずは事業資金づくり診断でご都合をお聞かせください。</p>
                <TrackedLink
                  href={CONSULT_URL}
                  className="lp-consult-cta"
                  target="_blank"
                  rel="noopener noreferrer"
                  event="cta_click"
                  params={{ position: 'middle' }}
                >
                  事業資金づくり診断を予約する<span style={{ whiteSpace: 'nowrap' }}>（無料・{CONSULT_MINUTES}分）</span>
                </TrackedLink>
              </div>
            ) : (
              <></>
            )}
          </div>
        </div>
      </section>

      {/* ===== FORM SECTION ===== */}
      <section className="form-section" id="apply">
        <div className="container">
          <div className="form-card">
            <h2>{noSchedule ? '説明会のご案内' : <>説明会に<span className="accent">申し込む</span></>}</h2>
            {noSchedule ? (
              /* 🔴 日程0件のときはフォームを出さない（空セレクト・送信500を作らない） */
              <div style={{ textAlign: 'center', padding: '8px 4px' }}>
                <p style={{ fontSize: '16px', fontWeight: 700, marginBottom: '18px' }}>
                  現在、説明会の日程は個別にご案内しています。
                </p>
                <TrackedLink
                  href={CONSULT_URL}
                  className="lp-consult-cta"
                  target="_blank"
                  rel="noopener noreferrer"
                  event="cta_click"
                  params={{ position: 'footer' }}
                >
                  事業資金づくり診断を予約する<span style={{ whiteSpace: 'nowrap' }}>（無料・{CONSULT_MINUTES}分）</span>
                </TrackedLink>
              </div>
            ) : (
            <>
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
              <form onSubmit={handleSubmit} onFocus={onFormStart}>
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
                      {/* 固定の選択肢を持つと終了した回に申込できてしまうため、
                          選択肢は /api/events（終了回を除外済み）の結果のみとする */}
                      {infoEvents.map(ev => (
                        <option key={ev.id} value={ev.id}>{formatEventDateJa(ev.event_date, ev.duration_minutes)} — {cleanTitle(ev.title)}</option>
                      ))}
                      {eventsLoaded && infoEvents.length === 0 && (
                        <option value="" disabled>現在募集中の日程はありません</option>
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
            </>
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
                この掲載説明会は参加費無料です。事業資金づくり診断も無料です。有償サポートは必要な場合のみ、個別にお見積もりします。
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
                説明会のあと、希望者は無料の事業資金づくり診断へ進みます。企画・目標金額・リターンを具体的に整理し、掲載が決まったら企画設計から公開まで伴走します。
              </div></div>
            </div>
            <div className="faq-item">
              <div className="faq-question" onClick={toggleFaq}>
                AIツールでクラファンページが作れると聞きましたが？
              </div>
              <div className="faq-answer"><div className="faq-answer-inner">
                はい。説明会では、KAMOファンディング独自のAIツールの体験案内を行っています。ページ作成のテンプレートとリターン設計のひな形をその場で試せます。
              </div></div>
            </div>
          </div>
        </div>
      </section>

      {/* アドバイザー・協業・セミナー依頼（主導線から外して小さく逃がす） */}
      <p className="lp-partner-links">
        アドバイザーとして働きたい方・協業やセミナーのご依頼は
        <a href="/partners">パートナー募集のページ</a>へ。
      </p>

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
                  <li><a href="#pillars">説明会で分かること</a></li>
                  <li><a href="#schedule">開催日程</a></li>
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
            <LegalFooter />
          </div>
        </div>
      </footer>
    </>
  );
}
