'use client';

import { useEffect, useState } from 'react';
import '@/styles/kamo-icons.css';
import '@/styles/seminar-info.css';
import { formatEventDateJa, eventCardParts, EventLike } from '@/lib/event-format';

export default function SeminarInfoPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [events, setEvents] = useState<Array<EventLike>>([
    // フォールバック: API取得前の初期表示用
    { id: '0ae42e1f-1a2b-4c3d-8e5f-6a7b8c9d0e1f', title: '第1回 KAMOファンディング無料掲載説明会', event_date: '2026-08-18T19:30:00+09:00', pillar: 1 },
    { id: '851bfae5-2b3c-4d5e-9f6a-7b8c9d0e1f2a', title: '第2回 KAMOファンディング無料掲載説明会', event_date: '2026-08-28T19:30:00+09:00', pillar: 1 },
    { id: '94f5db1d-3c4d-4e6f-a7b8-c9d0e1f2a3b4', title: '第3回 KAMOファンディング無料掲載説明会', event_date: '2026-09-15T19:30:00+09:00', pillar: 1 },
  ]);

  useEffect(() => {
    fetch('/api/events')
      .then(res => res.ok ? res.json() : { events: [] })
      .then(data => {
        const filtered = (data.events || []).filter((e: { pillar?: number }) => !e.pillar || e.pillar === 1);
        if (filtered.length > 0) setEvents(filtered);
      })
      .catch(() => {});
  }, []);

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    formData.forEach((v, k) => { data[k] = v as string; });
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

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <a href="/"><img src="/kamo-logo-main.jpg" alt="KAMOファンディング" style={{height:'32px',width:'auto'}} /></a>
          <a href="#apply" className="header-cta">今すぐ申し込む</a>
        </div>
      </header>

      <section className="hero">
        <div className="container">
          <div className="hero-inner">
            <div className="hero-badge"><span className="hero-badge-dot"></span>参加費無料・月2回オンライン開催</div>
            <h1>本業の売上を上げる<br /><span className="gold">クラウドファンディング</span>の<br />使い方が学べる無料説明会</h1>
            <p className="hero-sub">KAMOファンディングの無料掲載説明会。AIでクラファンページが自動作成できる新しい仕組みも体験できます。</p>
            <a href="#apply" className="hero-cta">今すぐ無料で申し込む →</a>
            <div className="hero-meta">
              <div className="hero-meta-item"><span className="kamo-icon kamo-icon-calendar sm"></span> 月2回開催</div>
              <div className="hero-meta-item"><span className="kamo-icon kamo-icon-monitor sm"></span> オンライン（Zoom）</div>
              <div className="hero-meta-item"><span className="kamo-icon kamo-icon-yen sm"></span> 参加費¥0</div>
              <div className="hero-meta-item"><span className="kamo-icon kamo-icon-clock sm"></span> 約90分</div>
            </div>
          </div>
        </div>
      </section>

      <section className="benefits">
        <div className="container">
          <div className="benefits-title">
            <h2>なぜ<span className="accent">今</span>クラファンなのか？</h2>
            <p>本業が停滞している方こそ、クラウドファンディングが武器になります。</p>
          </div>
          <div className="benefits-grid">
            <div className="benefit-card"><div className="kamo-icon kamo-icon-trending-up lg"></div><h3>短期キャンペーンで売上UP</h3><p>クラファンを「先行販売」「限定商品」の短期キャンペーンに使い、本業の売上を一気に引き上げる。</p></div>
            <div className="benefit-card"><div className="kamo-icon kamo-icon-handshake lg"></div><h3>共犯者を集める仕組み</h3><p>「あなたの夢を応援したい」と言ってくれる人を集める。お金ではなく、応援者を集めるのがKAMO流。</p></div>
            <div className="benefit-card"><div className="kamo-icon kamo-icon-flame lg"></div><h3>AI時代のマネタイズ力を上げていこう！</h3><p>自分ができることを販売できればどんな投資にも勝ります！AIを味方に、スキルをリターンとして売る力を養いましょう</p></div>
          </div>
        </div>
      </section>

      <section className="learn">
        <div className="container">
          <div className="learn-title"><h2>説明会で<span className="accent">分かること</span></h2></div>
          <div className="learn-list">
            <div className="learn-item"><div className="kamo-icon kamo-icon-check sm"></div><div><h4>KAMOファンディングの特徴</h4><p>総支援額17億円！達成率95%のノウハウの一端をご紹介</p></div></div>
            <div className="learn-item"><div className="kamo-icon kamo-icon-check sm"></div><div><h4>クラウドファンディングの集める構造を理解する</h4><p>クラファンで資金を集める仕組みと、成功するプロジェクトの共通パターン</p></div></div>
            <div className="learn-item"><div className="kamo-icon kamo-icon-check sm"></div><div><h4>応援支援で高額支援を集めるノウハウを伝授</h4><p>スポンサー・VIP設計と、経営者からの高額支援を獲得する戦略</p></div></div>
          </div>
          <p style={{ textAlign: 'center', fontSize: '15px', color: '#E60012', fontWeight: '700', marginTop: '24px' }}>※KAMOファンディングに掲載希望者は参加必須です。</p>
        </div>
      </section>

      <section className="ai-highlight">
        <div className="container">
          <div className="ai-card">
            <div className="ai-card-text">
              <h2>AIで<span className="gold">クラファンページ</span>が<br />その場で作れる</h2>
              <p>説明会では、KAMOファンディング独自のAIツールを体験いただけます。</p>
              <ul>
                <li>ヒアリングに答えるだけでページのひな形が自動生成</li>
                <li>リターン5階層（entry→sponsor）の設計もAIが支援</li>
                <li>「他のプラットフォームにはない体験」が差別化の核</li>
              </ul>
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
              <h3>AIクラファン支援ツール</h3>
              <p>セミナー参加者がその場で<br />クラファンページのひな形を作れる</p>
            </div>
          </div>
        </div>
      </section>

      <section className="schedule" id="schedule">
        <div className="container">
          <div className="schedule-title"><h2>説明会の<span className="accent">開催日程</span></h2></div>
          <div className="schedule-list">
            {events.map(ev => {
              const p = eventCardParts(ev.event_date, ev.duration_minutes);
              return (
                <div className="schedule-item" key={ev.id}>
                  <div className="schedule-date">
                    <div className="month">{p.month}</div>
                    <div className="day">{p.day}</div>
                    <div className="weekday">{p.weekday}曜</div>
                  </div>
                  <div className="schedule-info">
                    <h4>{ev.title}</h4>
                    <p>{p.timeRange} | オンライン（Zoom）</p>
                  </div>
                  <div className="schedule-status" style={{ background: '#E60012', color: '#fff' }}>募集中</div>
                </div>
              );
            })}
          </div>
          <div className="schedule-title" style={{ marginTop: '48px' }}><h2>参加申込は<span className="accent">こちら</span></h2></div>
          <p style={{ textAlign: 'center', fontSize: '17px', fontWeight: '700', color: '#E60012', marginTop: '24px', marginBottom: '16px' }}>音声配信メディア！Voicyでも、クラウドファンディング成功ノウハウを配信中！</p>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <img src="/voicy-banner.png" alt="Voicy — クラウドファンディング成功ノウハウ配信中" style={{ maxWidth: '400px', width: '100%', height: 'auto', borderRadius: '12px' }} />
          </div>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <a href="https://r.voicy.jp/GZV0X8DWjVW" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', background: '#E60012', color: '#fff', padding: '14px 36px', borderRadius: '100px', fontSize: '17px', fontWeight: '700', textDecoration: 'none', boxShadow: '0 4px 20px rgba(230,0,18,0.3)' }}>Voicyはこちら →</a>
          </div>
        </div>
      </section>

      <section className="cta-banner">
        <div className="container">
          <h2>まずは無料説明会に参加してみませんか？</h2>
          <p>月2回開催・参加費無料・約90分。あなたのビジネスにクラファンが使えるか、一緒に確かめましょう。</p>
          <a href="#apply" className="hero-cta">説明会に申し込む →</a>
        </div>
      </section>

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
                          <option value="">日程確定後にご案内</option>
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

      <footer className="footer"><div className="container">&copy; 2026 KAMO FUNDING. All rights reserved.</div></footer>
    </>
  );
}
