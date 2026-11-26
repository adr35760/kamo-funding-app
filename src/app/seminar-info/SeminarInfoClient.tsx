'use client';

import { useEffect, useRef, useState } from 'react';
import '@/styles/kamo-icons.css';
import '@/styles/seminar-info.css';
import { formatEventDateJa, eventCardParts, EventLike } from '@/lib/event-format';
import SiteHeader from '@/components/SiteHeader';
import Image from 'next/image';
import { captureUtm, getUtmPayload } from '@/lib/utm';
import { captureReferralCode, getReferralPayload } from '@/lib/referral-link';
import LegalFooter from '@/components/LegalFooter';
import {
  allSuccessCases,
  caseImage,
  formatManYen,
  CASE_IMAGE_WIDTH,
  CASE_IMAGE_HEIGHT,
} from '@/lib/success-cases';
import StatsBanner from '@/components/StatsBanner';
import {
  CONSULT_URL,
  CONSULT_MINUTES,
  NUM_JISSEKI,
  NUM_TASSEI_RATE,
  NUM_JISSEKI_NOTE,
} from '@/lib/seminar-info-content';
import { PLATFORM_FEE_SHORT } from '@/lib/site-fees';
import TrackedLink from '@/components/TrackedLink';
import { track } from '@/lib/analytics';

/**
 * ④実績セクションで引用する成功事例（/success と同じ既存データを読む）。
 * 2026-11-22 t iku指示: 新商品・店舗開業・出版の3分野から1件ずつ。
 * 金額・見出し・画像は success-cases.ts が正で、ここでは slug と分野名だけ選ぶ
 * （数値を本文に書かない＝データ更新時に古い数字が残らない）。
 * リンク先は /success の各事例アンカー（article id = slug）。
 */
const FEATURED_CASES = [
  { slug: 'tenmeikaika', label: '新商品' },
  { slug: 'akahoshi', label: '店舗開業' },
  { slug: 'nakajima01', label: '出版' },
] as const;

/** ②無料診断で分かること（2026-11-22 t iku原稿の5項目） */
const CONSULT_POINTS = [
  'あなたの企画にクラファンが適しているか',
  '目標金額とリターンの考え方',
  '公開前に必要な準備',
  '応援してくれる人を集めるための方法',
  '掲載までの流れと必要な費用',
];

/** ⑤事業資金づくり診断の流れ（3ステップ） */
const FLOW_STEPS = [
  { title: '予約', body: 'カレンダーから日時を選ぶ' },
  { title: '当日伺うこと！', body: '実施アイディア／集めたい金額／時期など' },
  { title: `オンライン${CONSULT_MINUTES}分`, body: 'Zoomで直接お話しします' },
];

/** ⑥説明会はこんな方に */
const SEMINAR_FOR_YOU = ['まず全体像を聞きたい', '他の事例も聞きたい', '日程が合う'];

/** ⑦よくある質問 */
const FAQS = [
  { q: '参加は無料ですか', a: '参加費は無料です。' },
  { q: '顔出しは不要ですか', a: '顔出しは不要です。' },
  { q: '掲載を決めていなくても大丈夫ですか', a: '情報収集だけでも歓迎です。' },
  { q: '所要時間はどのくらいですか', a: `${CONSULT_MINUTES}分です。オンライン（Zoom）で行います。` },
];

/** 説明会の日程から選ぶCTA（ヒーロー副ボタン・最後のCTAで共用） */
const SCHEDULE_ANCHOR = '#schedule';

export default function SeminarInfoClient({
  initialEvents = [],
  eventsResolved = false,
  initialReferralCode = '',
}: {
  initialEvents?: EventLike[];
  /** サーバー側でDBを読めたか（true かつ 0件＝本当に公開日程が無い） */
  eventsResolved?: boolean;
  initialReferralCode?: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  // 固定日程をフォールバックに持つと過去日程が復活してしまうため、
  // 初期値は空にしてサーバー（/api/events）の結果だけを表示する
  // サーバー側で取得済みの日程を初期値にする（SSR時点でフォームに選択肢が入る）
  const [events, setEvents] = useState<Array<EventLike>>(initialEvents);
  // サーバーがDBを読めていれば「0件」も確定情報として扱う（＝フォームを出さない）。
  // 読めていない場合だけクライアント取得に委ねる。
  const [eventsLoaded, setEventsLoaded] = useState(eventsResolved || initialEvents.length > 0);
  /**
   * 2026-10-27 t iku決定（B＝申込があったときだけ開催）:
   * 公開日程が0件のときは「説明会の日程は個別にご案内」に一本化する。
   * 🔴 フォームは出さない（空のセレクト・送信時500を作らない）。
   */
  const noSchedule = eventsLoaded && events.length === 0;

  useEffect(() => {
    if (eventsResolved || initialEvents.length > 0) return; // サーバー取得済みなら再取得不要
    fetch('/api/events')
      .then(res => res.ok ? res.json() : { events: [] })
      .then(data => {
        const filtered = (data.events || []).filter((e: { pillar?: number }) => !e.pillar || e.pillar === 1);
        setEvents(filtered);
      })
      .catch(() => {})
      .finally(() => setEventsLoaded(true));
  }, [initialEvents.length, eventsResolved]);

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

  /**
   * 紹介パートナーの専用リンク（/r/<code> → /seminar-info?ref=<code>）から来た場合の
   * 紹介コード。フォームの hidden に入れ、申込時に registrations.referral_code へ保存する。
   *
   * 🔴 コードが無い・不正でも申込は必ず通す（紹介の計測は申込の前提条件ではない）。
   *    リンクを踏んだ後にページ内を移動しても消えないよう、sessionStorage にも残す。
   */
  const [referralCode, setReferralCode] = useState<string>(initialReferralCode);

  useEffect(() => {
    // サーバがURLから読んだ値を初期値にしている。ここでは
    // ①sessionStorage への保存（ページ内移動・別ページ経由でも紹介を消さない）
    // ②以降の遷移で ref が変わったときの追随
    // のために capture を呼ぶ。URL に ref が無ければ保存済みを返す。
    const code = captureReferralCode() ?? '';
    if (code) setReferralCode(code);
  }, []);

  /** フォームの最初の操作で form_start を1回だけ送る（/ と同じ考え方） */
  const formStartedRef = useRef(false);
  const onFormStart = () => {
    if (formStartedRef.current) return;
    formStartedRef.current = true;
    track('form_start', { form: 'seminar-info' });
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
    // 紹介パートナーのコードも同様に添付する（無ければ何も付かない）
    Object.assign(data, getReferralPayload());
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
      // 送信が通った時だけ form_submit を送る（入力値は載せない）
      track('form_submit', { form: 'seminar-info' });
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '申込に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const featuredCases = FEATURED_CASES.flatMap(({ slug, label }) => {
    const found = allSuccessCases().find(c => c.slug === slug);
    if (!found || !('heading' in found)) return [];
    return [{ slug, label, heading: found.heading, raised: found.raised }];
  });

  return (
    <div className="seminar-info-page">
      <SiteHeader
        current="/seminar-info"
        cta={{ href: CONSULT_URL, label: '事業資金づくり診断を予約' }}
      />

      {/* ===== ① ヒーロー（主CTA＝事業資金づくり診断／副CTA＝説明会日程） =====
          2026-11-22 t iku指示: 冒頭を「その企画、クラファンで実現できる？」に差し替え */}
      <section className="hero">
        <div className="container">
          <div className="hero-inner">
            <div className="hero-badge"><span className="hero-badge-dot"></span>無料・{CONSULT_MINUTES}分・オンライン</div>
            <h1>
              <span className="hero-line1">その企画、</span>
              <span className="hero-line2">クラファンで<span className="gold">実現できる？</span></span>
            </h1>
            <p className="hero-lead">クラファン事業資金づくり診断（無料{CONSULT_MINUTES}分）で、目標金額・リターン・公開までの準備を整理します。</p>
            <p className="hero-lead hero-lead-sub">
              新商品、出版、店舗開業、イベント、地域活動など。<br />
              「実現したいことはあるけれど、何から始めたらいいのか分からない」そんな方のための無料診断です。
            </p>
            <div className="hero-cta-row">
              <TrackedLink
                href={CONSULT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hero-cta hero-cta--main"
                event="cta_click"
                params={{ position: 'consult' }}
              >
                <span>事業資金づくり診断を予約する<span style={{ whiteSpace: 'nowrap' }}>（無料・{CONSULT_MINUTES}分）</span></span>
              </TrackedLink>
              <TrackedLink
                href={noSchedule ? '#apply' : SCHEDULE_ANCHOR}
                className="hero-cta hero-cta--sub"
                event="cta_click"
                params={{ position: 'schedule' }}
              >
                {noSchedule ? '説明会のご案内を見る' : '説明会の日程を見る'}
              </TrackedLink>
            </div>
            <p className="hero-note">オンライン開催・診断無料</p>
            <p className="hero-note">※掲載手数料は{PLATFORM_FEE_SHORT}。有償サポートは個別にお見積もりします。</p>
          </div>
        </div>
      </section>

      {/* ===== ② 無料診断で分かること（2026-11-22 t iku原稿） ===== */}
      <section className="learn">
        <div className="container">
          <div className="learn-title"><h2>無料診断で<span className="accent">分かること</span></h2></div>
          <div className="learn-list learn-list--simple">
            {CONSULT_POINTS.map(item => (
              <div className="learn-item" key={item}>
                <div className="kamo-icon kamo-icon-check sm"></div>
                <div><p>{item}</p></div>
              </div>
            ))}
          </div>
          <p className="learn-lead">まずは企画段階でも構いません。</p>
          <div className="hero-cta-row learn-cta-row">
            <TrackedLink
              href={CONSULT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hero-cta hero-cta--main"
              event="cta_click"
              params={{ position: 'consult' }}
            >
              <span>事業資金づくり診断を予約する<span style={{ whiteSpace: 'nowrap' }}>（無料・{CONSULT_MINUTES}分）</span></span>
            </TrackedLink>
          </div>
          <p className="learn-note">オンライン開催・診断無料</p>
          <p className="learn-note">※掲載手数料は{PLATFORM_FEE_SHORT}。有償サポートは個別にお見積もりします。</p>
        </div>
      </section>

      {/* ===== ④ 実績・成功事例（2026-11-22 t iku指示） =====
          旧「17億円・95%」の数値表示は廃止し、3ページ共通の StatsBanner に統一。
          成功事例は新商品・店舗開業・出版から1件ずつ、/success の該当アンカーへ送る。 */}
      <section className="results">
        <div className="container">
          <div className="results-title"><h2>実績・<span className="accent">成功事例</span></h2></div>
          <StatsBanner className="results-stats-banner" />
          <div className="results-grid">
            {featuredCases.map(c => (
              <a
                key={c.slug}
                href={`/success#${c.slug}`}
                className="result-card result-card--case"
              >
                <span className="result-card-media">
                  <img
                    src={caseImage(c.slug)}
                    alt={`${c.heading}（プロジェクトのメイン画像）`}
                    width={CASE_IMAGE_WIDTH}
                    height={CASE_IMAGE_HEIGHT}
                    loading="lazy"
                    className="result-card-image"
                  />
                </span>
                <span className="result-card-label">{c.label}</span>
                <h3 className="result-card-title">{c.heading}</h3>
                <span className="result-card-nums">
                  <span className="result-card-raised-label">支援総額</span>
                  <span className="result-card-raised">{formatManYen(c.raised)}</span>
                </span>
              </a>
            ))}
          </div>
          <p className="results-more"><a href="/success">成功事例をすべて見る →</a></p>
        </div>
      </section>

      {/* ===== ⑤ 事業資金づくり診断の流れ ===== */}
      <section className="flow">
        <div className="container">
          <div className="flow-title"><h2>事業資金づくり診断の<span className="accent">流れ</span></h2></div>
          <ol className="flow-list">
            {FLOW_STEPS.map((step, i) => (
              <li className="flow-step" key={step.title}>
                <span className="flow-num">{i + 1}</span>
                <h3>{step.title}</h3>
                <p>
                  {step.body.split('／').map((seg, si, arr) => (
                    <span key={si}><span className="flow-body-seg">{seg}</span>{si < arr.length - 1 ? '／' : ''}</span>
                  ))}
                </p>
              </li>
            ))}
          </ol>

          {/* 2026-11-02 t iku指示: 事業資金づくり診断の流れの下に予約バナー */}
          <TrackedLink
            href={CONSULT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="seminar-flow-banner"
            event="cta_click"
            params={{ position: 'consult' }}
          >
            <span className="seminar-flow-banner-text">無料の事業資金づくり診断を予約する<span className="seminar-flow-banner-arrow">→</span></span>
            <span className="seminar-flow-banner-note">無料・{CONSULT_MINUTES}分・オンライン</span>
          </TrackedLink>
        </div>
      </section>

      {/* ===== ⑥ 説明会はこんな方に（既存コンテンツの集約＋日程＋申込） ===== */}
      <section className="seminar-detail">
        <div className="container">
          {/* 2026-11-03 t iku指示: 事業資金づくり診断の予約と掲載の申込は別の手続きなので、間に区切りを入れる */}
          <div className="seminar-divider" role="separator" aria-label="ここからは別のお申し込みです">
            <span className="seminar-divider-line" aria-hidden="true" />
            <span className="seminar-divider-label">ここからは別のお申し込み</span>
            <span className="seminar-divider-line" aria-hidden="true" />
          </div>
          <p className="seminar-divider-note">
            上は<strong>事業資金づくり診断のご予約</strong>、ここからは<strong>掲載のお申し込み</strong>です。
          </p>
          {/* 2026-11-02 t iku指示: 説明会を経ずに掲載を希望する人向けの導線を、見出しの上に置く */}
          <a href="/apply-listing" className="seminar-listing-banner">
            <span>直接、掲載に進みたい方は！</span>
            <span className="seminar-listing-banner-cta">こちらに！</span>
          </a>
          <div className="seminar-detail-title"><h2>掲載説明会は<span className="accent">こんな方に！</span></h2></div>
          <ul className="seminar-for-you">
            {SEMINAR_FOR_YOU.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          {/* 公開日程が無いときの案内（B決定）。CTAは同じ枠内に置く */}
          {noSchedule && (
            <div className="seminar-schedule-note">
              <p>開催日程は、ご希望に応じて設定します。まずは事業資金づくり診断でご都合をお聞かせください。</p>
              <TrackedLink
                href={CONSULT_URL}
                className="seminar-consult-cta"
                target="_blank"
                rel="noopener noreferrer"
                event="cta_click"
                params={{ position: 'consult' }}
              >
                <span>事業資金づくり診断を予約する<span style={{ whiteSpace: 'nowrap' }}>（無料・{CONSULT_MINUTES}分）</span></span>
              </TrackedLink>
            </div>
          )}

          <div className="seminar-block">
            <h3 className="seminar-block-title">説明会で分かること</h3>
            <div className="learn-list">
              <div className="learn-item"><div className="kamo-icon kamo-icon-check sm"></div><div><h4>KAMOファンディングの特徴</h4><p>累計支援総額{NUM_JISSEKI}！目標達成率{NUM_TASSEI_RATE}のノウハウの一端をご紹介</p></div></div>
              <div className="learn-item"><div className="kamo-icon kamo-icon-check sm"></div><div><h4>クラウドファンディングの集める構造を理解する</h4><p>クラファンで資金を集める仕組みと、成功するプロジェクトの共通パターン</p></div></div>
              <div className="learn-item"><div className="kamo-icon kamo-icon-check sm"></div><div><h4>応援支援で高額支援を集めるノウハウを伝授</h4><p>スポンサー・VIP設計と、経営者からの高額支援を獲得する戦略</p></div></div>
              {/* 2026-11-03 t iku指示: 4枠目は「進め方」＋「特別オファー」を1枠にまとめて2列×2行に */}
              <div className="learn-item"><div className="kamo-icon kamo-icon-check sm"></div><div><h4>掲載に関しての進め方</h4><p>目標達成率{NUM_TASSEI_RATE}の個別伴走支援サポートの特別オファー</p></div></div>
            </div>
            <p className="seminar-stats-note">{NUM_JISSEKI_NOTE}</p>
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

          {/* 日程が0件のときは空の箱を出さない（上の案内に集約） */}
          {!noSchedule && (
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
          )}

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
            <h2>{noSchedule ? '説明会のご案内' : <>無料<span className="accent">説明会</span>に申し込む</>}</h2>
            {noSchedule ? (
              /* 🔴 日程0件のときはフォームを出さない（空セレクト・送信500を作らない） */
              <div className="seminar-no-schedule">
                <p>現在、説明会の日程は個別にご案内しています。</p>
                <TrackedLink
                  href={CONSULT_URL}
                  className="seminar-consult-cta"
                  target="_blank"
                  rel="noopener noreferrer"
                  event="cta_click"
                  params={{ position: 'consult' }}
                >
                  <span>事業資金づくり診断を予約する<span style={{ whiteSpace: 'nowrap' }}>（無料・{CONSULT_MINUTES}分）</span></span>
                </TrackedLink>
              </div>
            ) : (
            <>
            <p className="form-sub">以下の情報をご入力ください。確認メールが自動送信されます。</p>
            {submitted ? (
              <div style={{textAlign:'center',padding:'48px 24px'}}>
                <div className="kamo-icon kamo-icon-check-lg" style={{width:'48px',height:'48px',marginBottom:'16px'}}></div>
                <h3 style={{fontSize:'24px',fontWeight:900,marginBottom:'8px'}}>申込完了！</h3>
                <p style={{color:'#666',fontSize:'15px'}}>確認メールを送信しました。当日までにお待ちください。</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} onFocus={onFormStart}>
                <input type="hidden" name="event_type" value="seminar_info" />
                {/* 紹介パートナー専用リンク（/r/<code>）から来たときだけ値が入る。
                    申込はこの値をサーバ側で registrations.referral_code に保存する。
                    常に描画しておく（値の有無でDOMを作り分けると、水和のずれと
                    「項目が無い＝壊れている」の切り分けづらさを招くため）。 */}
                <input type="hidden" name="referral_code" value={referralCode} />
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
                {referralCode && (
                  <p className="form-note" style={{ marginTop: 8, color: '#2E7D32', fontWeight: 700 }}>
                    ご紹介リンクからのお申し込みとして受け付けます
                  </p>
                )}
              </form>
            )}
            </>
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

      {/* ===== アドバイザー志望・協業・セミナー依頼（主導線から外して小さく逃がす） ===== */}
      <p className="partner-links">
        アドバイザーとして働きたい方・協業やセミナーのご依頼は
        <a href="/partners">パートナー募集のページ</a>へ。
      </p>

      {/* ===== ⑧ 最後のCTA（事業資金づくり診断が主・説明会が副） ===== */}
      <section className="cta-banner">
        <div className="container">
          <h2>まずは、無料の事業資金づくり診断から。</h2>
          <p>{CONSULT_MINUTES}分で、あなたのアイデアの勝ち筋と現実的な設計をお伝えします。<br />{noSchedule ? '説明会についても、個別にご案内します。' : '説明会の日程から選ぶこともできます。'}</p>
          <div className="hero-cta-row">
            <TrackedLink
              href={CONSULT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hero-cta hero-cta--main"
              event="cta_click"
              params={{ position: 'consult' }}
            >
              <span>事業資金づくり診断を予約する<span style={{ whiteSpace: 'nowrap' }}>（無料・{CONSULT_MINUTES}分）</span></span>
            </TrackedLink>
            <TrackedLink
              href="#apply"
              className="hero-cta hero-cta--sub"
              event="cta_click"
              params={{ position: 'schedule' }}
            >
              {noSchedule ? '説明会のご案内を見る' : '説明会に申し込む'}
            </TrackedLink>
          </div>
        </div>
      </section>

      <footer className="footer"><div className="container">&copy; 2026 KAMO FUNDING. All rights reserved.<LegalFooter /></div></footer>
    </div>
  );
}
