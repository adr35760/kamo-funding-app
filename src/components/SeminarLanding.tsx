'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import '@/styles/kamo-icons.css';
import '@/styles/seminar-landing.css';
import { pendingLabel, splitPriceLabel, PRICE_TAX_NOTE, type SeminarConfig } from '@/lib/seminar-config';
import { formatEventDateJa } from '@/lib/event-format';
import SiteHeader from '@/components/SiteHeader';
import { captureUtm, getUtmPayload } from '@/lib/utm';

interface EventRow {
  id: string;
  title: string;
  event_date: string;
  pillar?: number;
  duration_minutes?: number | null;
  location?: string | null;
  capacity?: number | null;
}

/**
 * 新規セミナーLPの共通コンポーネント（/ai-seminar・/real-seminar で共用）
 *
 * - 日程は events テーブルから pillar で絞って動的取得し、
 *   取得できない場合は設定ファイルの固定日程を表示する（フォールバック）
 * - 料金・定員は seminar-config.ts が単一の情報源（未確定値は「準備中」表示になる）
 * - ヒーロー画像は届いてから heroImage を渡せばよい（未指定でも成立する）
 */
export default function SeminarLanding({
  config,
  heroImage,
  heroImageAlt,
  heroImageWidth = 2048,
  heroImageHeight = 1280,
  initialEvents = [],
}: {
  config: SeminarConfig;
  heroImage?: string;
  heroImageAlt?: string;
  /** ヒーロー画像の実寸（比率が正しく保たれるよう画像ごとに指定する） */
  heroImageWidth?: number;
  heroImageHeight?: number;
  /** サーバー側で取得済みの日程（初期HTMLに含めるため） */
  initialEvents?: EventRow[];
}) {
  const [events, setEvents] = useState<EventRow[]>(initialEvents);
  // サーバーで取得できていれば追加取得は不要
  const [loadingEvents, setLoadingEvents] = useState(initialEvents.length === 0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const isReal = config.pillar === 3;
  const accent = isReal ? 'var(--kamo-gold)' : 'var(--kamo-red)';

  useEffect(() => {
    if (initialEvents.length > 0) return; // サーバー取得済み
    fetch('/api/events')
      .then(r => r.json())
      .then(d => {
        const rows: EventRow[] = (d.events || []).filter((e: EventRow) => e.pillar === config.pillar);
        setEvents(rows);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvents(false));
  }, [config.pillar, initialEvents.length]);

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
    if (!data.event_id) {
      setError('参加希望日を選択してください');
      setSubmitting(false);
      return;
    }
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || '申込に失敗しました');
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '申込に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const priceText = pendingLabel(config.price);
  const priceParts = splitPriceLabel(config.price);
  const hasSpeakers = !!config.speakers && config.speakers.length > 0;
  const capacityText = pendingLabel(config.capacity);

  return (
    <div className={isReal ? 'seminar-lp theme-real' : 'seminar-lp theme-online'}>
      <SiteHeader cta={{ href: '#apply', label: '申し込む' }} />

      {/* Hero */}
      <section className="sl-hero">
        <div className="sl-container">
          <div className="sl-badge">{config.format}</div>
          <h1>{config.title}</h1>
          <p className="sl-lead">{config.lead}</p>
          {config.emphasizePrice ? (
            <div className="sl-price-box">
              <div className="sl-price-main">
                <span className="sl-price-label">参加費</span>
                <span className="sl-price-amount">{priceParts.amount}</span>
                {priceParts.suffix && <span className="sl-price-suffix">（{priceParts.suffix}）</span>}
              </div>
              {config.priceNote && <div className="sl-price-note">{config.priceNote}</div>}
              <div className="sl-price-capacity">
                👥 定員：{capacityText}
                {config.capacityParty && <> / {pendingLabel(config.capacityParty)}</>}
              </div>
            </div>
          ) : (
            <div className="sl-hero-meta">
              <span>
                💰 参加費：{priceText}
                {config.priceNote && <span style={{ fontWeight: 400, opacity: .85 }}>（{config.priceNote}）</span>}
              </span>
              <span>
                👥 定員：{capacityText}
                {config.capacityParty && <> / {pendingLabel(config.capacityParty)}</>}
              </span>
            </div>
          )}
          <a href="#apply" className="sl-cta">申し込む →</a>
          {heroImage && (
            <div className="sl-hero-image">
              <Image
                src={heroImage}
                alt={heroImageAlt || `${config.shortTitle}の様子`}
                width={heroImageWidth}
                height={heroImageHeight}
                priority
                quality={95}
                sizes={`(max-width: 768px) 100vw, (max-width: 1400px) 100vw, ${heroImageWidth}px`}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>
          )}
        </div>
      </section>

      {/* 内容 */}
      <section className="sl-section">
        <div className="sl-container">
          <h2>セミナーの<span style={{ color: accent }}>内容</span></h2>
          {config.program ? (
            <>
              <div className="sl-program">
                {config.program.map((b, i) => (
                  <div className={b.special ? 'sl-program-item is-special' : 'sl-program-item'} key={b.label}>
                    <div className="sl-program-label" style={b.special ? undefined : { background: accent }}>
                      {b.special ? '特別セッション' : `第${i + 1}部`}
                    </div>
                    <div className="sl-program-body">
                      <h3>{b.special ? `${b.title}` : b.title}</h3>
                      <p>{b.body}</p>
                    </div>
                  </div>
                ))}
              </div>
              {config.programClosing && (
                <div className="sl-program-closing">
                  <p>{config.programClosing}</p>
                </div>
              )}
            </>
          ) : (
            <ol className="sl-contents">
              {config.contents.map((c, i) => (
                <li key={c}>
                  <span className="sl-num" style={{ background: accent }}>{i + 1}</span>
                  <span>{c}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {/* 講師紹介 */}
      {hasSpeakers && config.speakers && (
        <section className="sl-section sl-section-alt">
          <div className="sl-container">
            <h2>講師<span style={{ color: accent }}>紹介</span></h2>
            <div className="sl-speakers">
              {config.speakers.map(sp => (
                <div className={sp.special ? 'sl-speaker is-special' : 'sl-speaker'} key={sp.name}>
                  <div className="sl-speaker-photo">
                    <Image
                      src={sp.image}
                      alt={`${sp.role} ${sp.name}`}
                      width={900}
                      height={675}
                      quality={90}
                      sizes="(max-width: 768px) 100vw, 320px"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                  <div className="sl-speaker-info">
                    <div className="sl-speaker-role">{sp.role}</div>
                    <div className="sl-speaker-name">{sp.name}</div>
                    {sp.title && <p className="sl-speaker-title">{sp.title}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 日程（背景は前セクションと交互になるよう切替） */}
      <section className={hasSpeakers ? 'sl-section' : 'sl-section sl-section-alt'} id="schedule">
        <div className="sl-container">
          <h2>開催<span style={{ color: accent }}>日程</span></h2>
          {events.length === 0 && !loadingEvents && (
            <div className="sl-empty-schedule">
              <p className="sl-empty-title">現在募集中の日程はありません</p>
              <p className="sl-empty-sub">次回日程は近日公開します。公開までお待ちください。</p>
            </div>
          )}
          <div className="sl-schedule">
            {config.sessions.map((s, i) => (
              <div className="sl-schedule-card" key={s.isoDate}>
                <div className="sl-schedule-date" style={{ background: accent }}>
                  <span className="sl-round">第{s.round ?? i + 1}回</span>
                  <span className="sl-date">{s.dateLabel}</span>
                </div>
                <div className="sl-schedule-body">
                  <p className="sl-time">{s.timeLabel}</p>
                  {s.partyTimeLabel && <p className="sl-time sl-time-sub">{s.partyTimeLabel}</p>}
                  {config.venue ? (
                    <p className="sl-venue">
                      会場：{config.venue.seminar}
                      {config.venue.party && <><br />懇親会：{config.venue.party}</>}
                    </p>
                  ) : (
                    <p className="sl-venue">オンライン（Zoom）</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="sl-note">
            参加費：
            {config.emphasizePrice ? (
              <>
                <span className="sl-note-amount">{priceParts.amount}</span>
                {priceParts.suffix && <span className="sl-note-suffix">（{priceParts.suffix}）</span>}
              </>
            ) : (
              <strong>{priceText}</strong>
            )}
            {config.priceNote && <>（{config.priceNote}）</>}
            {PRICE_TAX_NOTE && <><br />{PRICE_TAX_NOTE}</>}
            <br />
            定員：{config.capacity.status === 'pending'
              ? '準備中（決まり次第、このページと申込者の皆さまへご案内します）'
              : capacityText}
            {config.capacityParty && <> / {pendingLabel(config.capacityParty)}</>}
          </p>
        </div>
      </section>

      {/* 申込フォーム */}
      <section className="sl-section" id="apply">
        <div className="sl-container">
          <div className="sl-form-card">
            {submitted ? (
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ marginBottom: '12px' }}>お申し込みありがとうございます</h2>
                <p style={{ color: '#666' }}>
                  ご登録のメールアドレスに確認メールをお送りしました。<br />
                  参加費などの詳細は、決まり次第あらためてご案内します。
                </p>
                <p style={{ marginTop: '20px' }}>
                  <a href="/" style={{ color: accent, fontWeight: 700 }}>← トップページに戻る</a>
                </p>
              </div>
            ) : (
              <>
                <h2 style={{ marginBottom: '20px' }}>お申し込み</h2>
                <form onSubmit={handleSubmit}>
                  <div className="sl-form-group">
                    <label>参加希望日 <span className="sl-required">必須</span></label>
                    <select name="event_id" required defaultValue="">
                      <option value="" disabled>選択してください</option>
                      {events.length > 0
                        ? events.map(ev => (
                            <option key={ev.id} value={ev.id}>
                              {formatEventDateJa(ev.event_date, ev.duration_minutes ?? null)}
                            </option>
                          ))
                        : config.sessions.map(s => (
                            <option key={s.isoDate} value="" disabled>
                              {s.dateLabel} {s.timeLabel}
                              {loadingEvents ? '（読み込み中）' : '（現在受付を準備中）'}
                            </option>
                          ))}
                    </select>
                    {events.length === 0 && (
                      <p className="sl-hint">
                        {loadingEvents
                          ? '日程を読み込んでいます...'
                          : '日程を取得できませんでした。お手数ですが、ページを再読み込みしてください。'}
                      </p>
                    )}
                  </div>
                  <div className="sl-form-row">
                    <div className="sl-form-group">
                      <label>お名前 <span className="sl-required">必須</span></label>
                      <input type="text" name="name" required placeholder="例: 鴨頭 太郎" />
                    </div>
                    <div className="sl-form-group">
                      <label>メールアドレス <span className="sl-required">必須</span></label>
                      <input type="email" name="email" required placeholder="example@email.com" />
                    </div>
                  </div>
                  <div className="sl-form-group">
                    <label>会社・団体名（任意）</label>
                    <input type="text" name="company" placeholder="例: 株式会社カモ" />
                  </div>
                  <div className="sl-form-group">
                    <label>実現したいこと・ご質問（任意）</label>
                    <textarea name="challenge" placeholder="クラウドファンディングで実現したいこと、聞きたいことなどをお書きください"></textarea>
                  </div>
                  {error && <p className="sl-error">{error}</p>}
                  <button type="submit" className="sl-submit" disabled={submitting} style={{ background: accent }}>
                    {submitting ? '送信中...' : '申し込む →'}
                  </button>
                  <p className="sl-hint" style={{ textAlign: 'center', marginTop: '12px' }}>
                    持ち物・当日の詳細は、開催前にメールでご案内します。
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      <footer className="sl-footer">
        <div className="sl-container">&copy; 2026 KAMO FUNDING. 共犯者を集め、夢を叶える場所。</div>
      </footer>
    </div>
  );
}
