'use client';

import { useEffect, useState } from 'react';
import '@/styles/kamo-icons.css';
import '@/styles/seminar-info.css';
import { formatEventDateJa, eventCardParts, EventLike } from '@/lib/event-format';
import SiteHeader from '@/components/SiteHeader';
import Image from 'next/image';
import { captureUtm, getUtmPayload } from '@/lib/utm';
import LegalFooter from '@/components/LegalFooter';
import { allSuccessCases, formatYen, projectUrl } from '@/lib/success-cases';
import { CONSULT_URL, NUM_JISSEKI, NUM_TASSEI_RATE } from '@/lib/seminar-info-content';

/**
 * ④実績セクションで引用する成功事例（/success と同じ既存データを読む）。
 * 金額・達成率・タイトルは success-cases.ts が正で、ここでは slug だけ選ぶ
 * （数値を本文に書かない＝データ更新時に古い数字が残らない）。
 */
const FEATURED_SLUGS = ['nakajima01', 'ooshimakeisuke01', 'takibinokai'];

/** ②こんな方へ */
const FOR_YOU = [
  'アイデアはあるが形にできていない',
  '何から手を付けていいか分からない',
  '過去に挑戦したが目標に届かなかった',
  '掲載できるか現実的に知りたい',
];

/** ③個別相談（60分）で分かること */
const CONSULT_GAINS = [
  { title: 'あなたのアイデアの勝ち筋', body: '誰に・何を・どう届けるか' },
  { title: '目標金額と期間の現実的な設計', body: '無理のない金額・期間の置き方' },
  { title: '掲載までに必要な準備と順番', body: '何を先にやるか' },
  { title: '費用とスケジュールの概算', body: 'かかる費用と時期の目安' },
];

/** ⑤個別相談の流れ（3ステップ） */
const FLOW_STEPS = [
  { title: '予約', body: 'カレンダーから日時を選ぶ' },
  { title: '事前に3問', body: '事業・アイデア／目標金額／希望時期' },
  { title: 'オンライン60分', body: 'Zoomで直接お話しします' },
];

/** ⑥説明会はこんな方に */
const SEMINAR_FOR_YOU = ['まず全体像を聞きたい', '他の事例も聞きたい', '日程が合う'];

/** ⑦よくある質問 */
const FAQS = [
  { q: '参加は無料ですか', a: '参加費は無料です。' },
  { q: '顔出しは不要ですか', a: '顔出しは不要です。' },
  { q: '掲載を決めていなくても大丈夫ですか', a: '情報収集だけでも歓迎です。' },
  { q: '所要時間はどのくらいですか', a: '60分です。オンライン（Zoom）で行います。' },
];

/** 説明会の日程から選ぶCTA（ヒーロー副ボタン・最後のCTAで共用） */
const SCHEDULE_ANCHOR = '#schedule';

export default function SeminarInfoClient({ initialEvents = [] }: { initialEvents?: EventLike[] }) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  // 固定日程をフォールバックに持つと過去日程が復活してしまうため、
  // 初期値は空にしてサーバー（/api/events）の結果だけを表示する
  // サーバー側で取得済みの日程を初期値にする（SSR時点でフォームに選択肢が入る）
  const [events, setEvents] = useState<Array<EventLike>>(initialEvents);
  const [eventsLoaded, setEventsLoaded] = useState(initialEvents.length > 0);

  useEffect(() => {
    if (initialEvents.length > 0) return; // サーバー取得済みなら再取得不要
    fetch('/api/events')
      .then(res => res.ok ? res.json() : { events: [] })
      .then(data => {
        const filtered = (data.events || []).filter((e: { pillar?: number }) => !e.pillar || e.pillar === 1);
        setEvents(filtered);
      })
      .catch(() => {})
      .finally(() => setEventsLoaded(true));
  }, [initialEvents.length]);

  useEffect(() => {
    const onScroll = () => {
      const header = document.querySelector('.header');
      if (header) header.classList.toggle('scrolled', window.scrollY > 50);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const a = e.target as HTMLAnchorElement;
      if (a.tagName === 'A' && a.getAttribute('href')?.startsWith('#')) {
        const target = document.querySelector(a.getAttribute('href')!);
        if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // 流入元（UTM）をURLから読み取り、申込送信まで保持する
  // （スクロールや再描画で消えないよう sessionStorage に保存する）
  useEffect(() => {
    captureUtm();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    formData.forEach((v, k) => { data[k] = v as string; });
    // 流入元（UTM）を申込データに添付する。取れていなければ何も付かない（申込は必ず通す）
    Object.assign(data, getUtmPayload());
    if (!data.event_id || data.event_id === '') delete data.event_id;
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        throw new Error(result.error || '申込に失敗しました');
      }
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '申込に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const featuredCases = allSuccessCases().filter(c => FEATURED_SLUGS.includes(c.slug));

  return (
    <div className="seminar-info-page">
      <SiteHeader
        current="/seminar-info"
        cta={{ href: CONSULT_URL, label: '個別相談を予約', external: true }}
      />

      {/* ===== ① ヒーロー（主CTA＝個別相談／副CTA＝説明会日程） ===== */}
      <section className="hero">
        <div className="container">
          <div className="hero-inner">
            <div className="hero-badge"><span className="hero-badge-dot"></span>無料・60分・オンライン</div>
            <h1>
              実績{NUM_JISSEKI}・達成率{NUM_TASSEI_RATE}の私が、
              <br />
              あなたのアイデアと<span className="h1-keep">&quot;達成したいこと&quot;</span>を直接伺います
            </h1>
            <p className="hero-lead">クラウドファンディングで、挑戦をかたちにする最初の60分。</p>
            <div className="hero-cta-row">
              <a href={CONSULT_URL} target="_blank" rel="noopener noreferrer" className="hero-cta hero-cta--main">
                個別相談を予約する（無料・60分）
              </a>
              <a href={SCHEDULE_ANCHOR} className="hero-cta hero-cta--sub">説明会の日程を見る</a>
            </div>
            <p className="hero-note">オンライン（Zoom）／顔出し不要／無理な営業はしません</p>
          </div>
        </div>
      </section>

      {/* ===== ② こんな方へ ===== */}
      <section className="for-you">
        <div className="container">
          <div className="for-you-title"><h2>こんな方へ</h2></div>
          <div className="for-you-grid">
            {FOR_YOU.map(item => (
              <div className="for-you-card" key={item}>
                <span className="kamo-icon kamo-icon-check sm"></span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ③ 個別相談（60分）で分かること ===== */}
      <section className="learn">
        <div className="container">
          <div className="learn-title"><h2>個別相談（60分）で<span className="accent">分かること</span></h2></div>
          <div className="learn-list">
            {CONSULT_GAINS.map(item => (
              <div className="learn-item" key={item.title}>
                <div className="kamo-icon kamo-icon-check sm"></div>
                <div><h4>{item.title}</h4><p>{item.body}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ④ 実績・成功事例 ===== */}
      <section className="results">
        <div className="container">
          <div className="results-title"><h2>実績・<span className="accent">成功事例</span></h2></div>
          <div className="results-stats">
            <div className="results-stat">
              <span className="results-num">{NUM_JISSEKI}</span>
              <span className="results-label">の支援実績</span>
            </div>
            <div className="results-stat">
              <span className="results-num">{NUM_TASSEI_RATE}</span>
              <span className="results-label">達成率</span>
            </div>
          </div>
          <div className="results-grid">
            {featuredCases.map(c => (
              <a
                key={c.slug}
                href={projectUrl(c.slug)}
                target="_blank"
                rel="noopener noreferrer"
                className="result-card"
              >
                <span className="result-card-owner">{c.owner}</span>
                <h3 className="result-card-title">{c.title}</h3>
                <div className="result-card-nums">
                  <span className="result-card-raised">{formatYen(c.raised)}</span>
                  <span className="result-card-rate">達成率{c.achievementRate.toLocaleString('ja-JP')}%</span>
                </div>
              </a>
            ))}
          </div>
          <p className="results-more"><a href="/success">成功事例をすべて見る →</a></p>
        </div>
      </section>

      {/* ===== ⑤ 個別相談の流れ ===== */}
      <section className="flow">
        <div className="container">
          <div className="flow-title"><h2>個別相談の<span className="accent">流れ</span></h2></div>
          <ol className="flow-list">
            {FLOW_STEPS.map((step, i) => (
              <li className="flow-step" key={step.title}>
                <span className="flow-num">{i + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ===== ⑥ 説明会はこんな方に（既存コンテンツの集約＋日程＋申込） ===== */}
      <section className="seminar-detail">
        <div className="container">
          <div className="seminar-detail-title"><h2>説明会は<span className="accent">こんな方に</span></h2></div>
          <ul className="seminar-for-you">
            {SEMINAR_FOR_YOU.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <div className="seminar-block">
            <h3 className="seminar-block-title">説明会で分かること</h3>
            <div className="learn-list">
              <div className="learn-item"><div className="kamo-icon kamo-icon-check sm"></div><div><h4>KAMOファンディングの特徴</h4><p>総支援額{NUM_JISSEKI}！達成率{NUM_TASSEI_RATE}のノウハウの一端をご紹介</p></div></div>
              <div className="learn-item"><div className="kamo-icon kamo-icon-check sm"></div><div><h4>クラウドファンディングの集める構造を理解する</h4><p>クラファンで資金を集める仕組みと、成功するプロジェクトの共通パターン</p></div></div>
              <div className="learn-item"><div className="kamo-icon kamo-icon-check sm"></div><div><h4>応援支援で高額支援を集めるノウハウを伝授</h4><p>スポンサー・VIP設計と、経営者からの高額支援を獲得する戦略</p></div></div>
            </div>
          </div>

          <div className="seminar-ai">
            <div className="ai-card">
              <div className="ai-card-text">
                <h2>AIで<span className="gold">クラファンページ</span>が作れる</h2>
                <p>説明会では、KAMOファンディング独自のツールの体験案内を行います！<br />瞬時でクラファンページが作成できます！</p>
              </div>
              <div className="ai-card-visual">
                <div style={{width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', flexShrink: '0'}}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="8" width="16" height="12" rx="2" />
                    <path d="M12 4V8" />
                    <circle cx="9" cy="14" r="1" />
                    <circle cx="15" cy="14" r="1" />
                    <path d="M12 2V4" />
                  </svg>
                </div>
                <h3>AIクラファンページ<br />作成ツール</h3>
                <p>参加者のみ！体験がその場でできます！</p>
              </div>
            </div>
          </div>

          <figure className="hero-community seminar-photo">
            <Image
              src="/seminar-community.jpg"
              alt="KAMOファンディング掲載説明会の参加者"
              width={1400}
              height={1055}
              sizes="(max-width: 768px) 100vw, 720px"
              className="hero-community-image"
            />
            <figcaption className="hero-community-caption">オンラインで全国から参加できます</figcaption>
          </figure>

          <div id="schedule" className="schedule-block">
            <h3 className="seminar-block-title">説明会の開催日程</h3>
            <div className="schedule-list">
              {eventsLoaded && events.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', background: '#FFF5F5', borderRadius: '16px', border: '2px solid #FFE0E0' }}>
                  <p style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>現在募集中の日程はありません</p>
                  <p style={{ fontSize: '15px', color: '#666' }}>次回日程は近日公開します。公開までお待ちください。</p>
                </div>
              )}
              {events.map(ev => {
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
                      <h4>{ev.title}</h4>
                      <p>オンライン（Zoom） | 参加費無料</p>
                    </div>
                    <div className="schedule-status" style={ev.finished
                      ? { background: '#9E9E9E', color: '#fff' }
                      : { background: '#E60012', color: '#fff' }}>{ev.finished ? '終了' : '募集中'}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="seminar-voicy">
            <p className="seminar-voicy-lead">音声配信メディア！Voicyでも、クラウドファンディング成功ノウハウを配信中！</p>
            <img src="/voicy-banner.png" alt="Voicy — クラウドファンディング成功ノウハウ配信中" style={{ maxWidth: '400px', width: '100%', height: 'auto', borderRadius: '12px' }} />
            <a href="https://r.voicy.jp/GZV0X8DWjVW" target="_blank" rel="noopener noreferrer" className="seminar-voicy-btn">Voicyはこちら →</a>
          </div>
        </div>
      </section>

      {/* ===== 説明会 参加申込フォーム（既存のフォーム・送信処理は変更なし） ===== */}
      <section className="form-section" id="apply">
        <div className="container">
          <div className="form-card">
            <h2>無料<span className="accent">説明会</span>に申し込む</h2>
            <p className="form-sub">以下の情報をご入力ください。確認メールが自動送信されます。</p>
            {submitted ? (
              <div style={{textAlign:'center',padding:'48px 24px'}}>
                <div className="kamo-icon kamo-icon-check-lg" style={{width:'48px',height:'48px',marginBottom:'16px'}}></div>
                <h3 style={{fontSize:'24px',fontWeight:900,marginBottom:'8px'}}>申込完了！</h3>
                <p style={{color:'#666',fontSize:'15px'}}>確認メールを送信しました。当日までにお待ちください。</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <input type="hidden" name="event_type" value="seminar_info" />
                <div className="form-row">
                  <div className="form-group"><label>お名前 <span className="required">必須</span></label><input type="text" name="name" required placeholder="鴨頭 太郎" /></div>
                  <div className="form-group"><label>メールアドレス <span className="required">必須</span></label><input type="email" name="email" required placeholder="example@email.com" /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>会社名・団体名</label><input type="text" name="company" placeholder="株式会社〇〇" /></div>
                  <div className="form-group">
                    <label>参加希望回</label>
                    <select name="event_id">
                      <option value="">選択してください</option>
                      {events.length > 0 ? (
                        events.map(ev => {
                          const dateStr = formatEventDateJa(ev.event_date, ev.duration_minutes);
                          return <option key={ev.id} value={ev.id}>{dateStr} — {ev.title.replace(/\s*\(.*\)\s*$/, '')}</option>;
                        })
                      ) : (
                        <>
                          {/* 全日程が終了/未公開のときのみ出す。読込中は誤解を招かない文言にする */}
                          <option value="" disabled>
                            {eventsLoaded ? '日程確定後にご案内' : '日程を読み込んでいます...'}
                          </option>
                          <option value="any">開催できる日ならいつでもOK</option>
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
                    <option value="voicy">Voicy</option>
                  </select>
                </div>
                <div className="form-group"><label>クラファンでの挑戦内容 <span className="required">必須</span></label><textarea name="challenge" required placeholder="実現したい夢やプロジェクトがあれば教えてください"></textarea></div>
                {error && <p style={{color:'#E60012',fontSize:'14px',marginBottom:'12px'}}>{error}</p>}
                <button type="submit" className="form-submit" disabled={submitting} style={submitting ? {opacity:0.7} : {}}>{submitting ? '送信中...' : '申し込む →'}</button>
                <p className="form-note">※ 申込後に確認メールが自動送信されます<br />※ 個人情報は本説明会の運営目的のみに使用します</p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ===== ⑦ よくある質問 ===== */}
      <section className="faq">
        <div className="container">
          <div className="faq-title"><h2>よくある<span className="accent">質問</span></h2></div>
          <div className="faq-list">
            {FAQS.map(item => (
              <details className="faq-item" key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ⑧ 最後のCTA（個別相談が主・説明会が副） ===== */}
      <section className="cta-banner">
        <div className="container">
          <h2>まずは、無料の個別相談から。</h2>
          <p>60分で、あなたのアイデアの勝ち筋と現実的な設計をお伝えします。<br />説明会の日程から選ぶこともできます。</p>
          <div className="hero-cta-row">
            <a href={CONSULT_URL} target="_blank" rel="noopener noreferrer" className="hero-cta hero-cta--main">
              個別相談を予約する（無料・60分）
            </a>
            <a href="#apply" className="hero-cta hero-cta--sub">説明会に申し込む</a>
          </div>
        </div>
      </section>

      <footer className="footer"><div className="container">&copy; 2026 KAMO FUNDING. All rights reserved.<LegalFooter /></div></footer>
    </div>
  );
}
