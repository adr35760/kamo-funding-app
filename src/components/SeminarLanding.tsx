'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import '@/styles/kamo-icons.css';
import '@/styles/seminar-landing.css';
import { pendingLabel, splitPriceLabel, PRICE_TAX_NOTE, realTierFor, REAL_ATTEND_TIERS, type SeminarConfig } from '@/lib/seminar-config';
import { formatEventDateJa } from '@/lib/event-format';
import SiteHeader from '@/components/SiteHeader';
import { captureUtm, getUtmPayload } from '@/lib/utm';
import LegalFooter from '@/components/LegalFooter';

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
 * ISO日時 →「2026年12月8日（火）」。
 * 日付は設定の isoDate（JST）から作る（ページに日付を直書きしない）。
 * 端末のタイムゾーンに関係なくJSTで出すため timeZone を固定する。
 */
function jstDateLabel(isoDate?: string): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  try {
    const parts = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
    }).formatToParts(d);
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
    const y = get('year');
    const m = get('month');
    const day = get('day');
    const w = get('weekday');
    if (!y || !m || !day) return '';
    return w ? `${y}年${m}月${day}日（${w}）` : `${y}年${m}月${day}日`;
  } catch {
    return '';
  }
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
  // リアル回だけに付ける装飾用の目印（isReal=false の /ai-seminar はクラスが増えない）
  const rc = (name: string) => (isReal ? ` sl-r-${name}` : '');
  const eyebrow = (key: keyof NonNullable<SeminarConfig['eyebrows']>) => {
    const label = config.eyebrows?.[key];
    return label ? <p className="sl-r-eyebrow">{label}</p> : null;
  };

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
  // ヒーローの日付は設定の isoDate（JST）から作る（ページに日付を直書きしない）
  const heroDate = jstDateLabel(config.sessions[0]?.isoDate);
  const ctaLabel = config.ctaLabel ?? '申し込む →';

  return (
    <div className={isReal ? 'seminar-lp theme-real is-real' : 'seminar-lp theme-online'}>
      <SiteHeader cta={{ href: '#apply', label: '申し込む' }} />

      {/* ページ最上部の告知バナー（ヒーローより上）— 画像全体を見せる（切り抜かない）。
          SiteHeader が固定ヘッダー分の余白を出すので、ここに余白を足さない。 */}
      {/* 2026-11-23 t iku指示: リアル回は「1画面で終わる」FVに組み直した。
          PCでは告知バナーを出さず、FVの中に登壇者写真と見出しを並べる（下のCSS）。
          スマホは従来どおりバナー＋ヒーローの縦積み。 */}
      {config.topBanner && (
        <section className="sl-top-banner" aria-label="イベントのお知らせ">
          <Image
            src={config.topBanner.src}
            alt={config.topBanner.alt}
            width={config.topBanner.width}
            height={config.topBanner.height}
            priority
            quality={92}
            sizes="100vw"
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </section>
      )}

      {/* Hero */}
      <section className={'sl-hero' + (isReal ? ' sl-hero-fv' : '')}>
        {isReal && (
          <div className="sl-fv-visual" aria-hidden="true">
            <Image
              src="/real-seminar-fv-collage.jpg"
              alt="鴨頭嘉人さんと代表の登壇風景、セミナー会場と交流会の様子"
              width={1254}
              height={1254}
              priority
              quality={95}
              sizes="(max-width: 1023px) 0px, 46vw"
            />
          </div>
        )}
        <div className="sl-container">
          {isReal && (
            <p className="sl-fv-hook">
              KAMOファンディング 挑戦者交流会！<span>鴨頭嘉人 参加会のみ！</span>
            </p>
          )}
          <div className="sl-badge">{config.format}</div>
          {/* タグラインとキャッチはリアル回だけが持つ（/ai-seminar は未設定＝従来どおり title がH1） */}
          {config.heroTagline && <p className="sl-hero-tagline">{config.heroTagline}</p>}
          <h1>{config.heroCatch ?? config.title}</h1>
          <p className="sl-lead">{config.lead}</p>
          {config.heroStats && (
            <>
              <div className="sl-hero-stats">
                {config.heroStats.map(s => (
                  <div className="sl-hero-stat" key={s.label}>
                    <div className="sl-hero-stat-value">{s.value}</div>
                    <div className="sl-hero-stat-label">{s.label}</div>
                    {s.note && <div className="sl-hero-stat-note">{s.note}</div>}
                  </div>
                ))}
              </div>
              {config.heroStatNote && <p className="sl-hero-stat-src">{config.heroStatNote}</p>}
            </>
          )}
          {isReal && heroDate && (
            <p className="sl-hero-when">
              <span>{heroDate}</span>
              {config.venue && (
                <span>
                  会場：{config.venue.seminar}
                  {/* 懇親会も同じ会場のときは「懇親会：同会場」と短く書く
                      （同名を2回並べると別会場に見える） */}
                  {config.venue.party &&
                    (config.venue.party === config.venue.seminar
                      ? '（懇親会も同会場）'
                      : `（懇親会：${config.venue.party}）`)}
                </span>
              )}
            </p>
          )}
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
          <a href="#apply" className="sl-cta">{ctaLabel}</a>
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

      {/* 3大価値（リアル回のみ） */}
      {config.valueProps && (
        <section className={'sl-section sl-section-alt' + rc('values')}>
          <div className="sl-container">
            {eyebrow('values')}
            <h2>{config.valueProps.heading}</h2>
            {config.valueProps.lead && <p className="sl-section-lead">{config.valueProps.lead}</p>}
            <div className="sl-values">
              {config.valueProps.items.map((v, i) => (
                <div className="sl-value-card" key={v.title}>
                  <div className="sl-value-no">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <h3>{v.title}</h3>
                  <p>{v.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 内容 */}
      <section className={'sl-section' + rc('program')}>
        <div className="sl-container">
          {eyebrow('program')}
          <h2>セミナーの<span className="sl-h2-accent">内容</span></h2>
          {config.program ? (
            <>
              <div className="sl-program">
                {config.program.map(b => (
                  <div
                    className={
                      b.special
                        ? 'sl-program-item is-special'
                        : b.party
                          ? 'sl-program-item is-party'
                          : 'sl-program-item'
                    }
                    key={b.label}
                  >
                    {/* ラベルは設定の値をそのまま使う。配列の位置から採番すると
                        第1部〜第5部の後に懇親会が来たとき「第6部」に化ける */}
                    <div className="sl-program-label">
                      {b.label}
                    </div>
                    <div className="sl-program-body">
                      <h3>{b.title}</h3>
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

      {/* 当日のタイムテーブル（リアル回のみ・2026-11-22 t iku案）
          「内容」で全体像を出したあとに、当日の流れを時間割で見せる。
          各コマは1行説明まで（パートの狙いの長文は program 側が担う）。 */}
      {config.timetables && config.timetables.length > 0 && (
        <section className={'sl-section' + rc('timetable')}>
          <div className="sl-container">
            {eyebrow('timetable')}
            <h2>当日の<span className="sl-h2-accent">流れ</span></h2>
            {config.timetables.map(tt => (
              <div className="sl-tt-block" key={tt.heading}>
                <div className="sl-tt-head">
                  {tt.kicker && <span className="sl-tt-kicker">{tt.kicker}</span>}
                  <h3 className="sl-tt-heading">{tt.heading}</h3>
                  {tt.lead && <p className="sl-tt-lead">{tt.lead}</p>}
                </div>
                <ol className="sl-tt-list">
                  {tt.rows.map(r => (
                    <li className="sl-tt-row" key={`${r.time}-${r.title}`}>
                      <div className="sl-tt-time">
                        <span className="sl-tt-clock">{r.time}</span>
                        {r.minutes && <span className="sl-tt-min">{r.minutes}</span>}
                      </div>
                      <div className="sl-tt-body">
                        <p className="sl-tt-title">{r.title}</p>
                        <p className="sl-tt-desc">{r.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                {tt.totalLabel && <p className="sl-tt-total">{tt.totalLabel}</p>}
                {tt.note && <p className="sl-tt-note">{tt.note}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 成功者から直接聞ける機会（リアル回のみ・今回の差別化） */}
      {config.community && (
        <section className={'sl-section sl-community' + rc('community')}>
          <div className="sl-container">
            {eyebrow('community')}
            {config.community.eyebrow && <p className="sl-eyebrow">{config.community.eyebrow}</p>}
            <h2>{config.community.heading}</h2>
            <div className="sl-community-body">
              {config.community.paragraphs.map((text, i) => (
                <p key={i}>{text}</p>
              ))}
            </div>
            <p className="sl-punch">{config.community.punch}</p>
            {config.community.after && <p className="sl-community-after">{config.community.after}</p>}
          </div>
        </section>
      )}

      {/* 講師紹介 */}
      {hasSpeakers && config.speakers && (
        <section className={'sl-section sl-section-alt' + rc('speakers')}>
          <div className="sl-container">
            {eyebrow('speakers')}
            <h2>講師<span className="sl-h2-accent">紹介</span></h2>
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
                    {/* プロフィール本文は未提供のあいだ undefined。
                        届いて値が入った時点で、両ページに自動で出る */}
                    {sp.profile && (
                      <div className="sl-speaker-profile">
                        {sp.profile.split('\n').filter(Boolean).map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 日程（背景は前セクションと交互になるよう切替） */}
      <section className={(hasSpeakers ? 'sl-section' : 'sl-section sl-section-alt') + rc('schedule')} id="schedule">
        <div className="sl-container">
          {eyebrow('schedule')}
          <h2>開催<span className="sl-h2-accent">日程</span></h2>
          {events.length === 0 && !loadingEvents && (
            <div className="sl-empty-schedule">
              <p className="sl-empty-title">現在募集中の日程はありません</p>
              <p className="sl-empty-sub">次回日程は近日公開します。公開までお待ちください。</p>
            </div>
          )}
          <div className="sl-schedule">
            {config.sessions.map((s, i) => (
              <div className="sl-schedule-card" key={s.isoDate}>
                <div className="sl-schedule-date">
                  <span className="sl-round">第{s.round ?? i + 1}回</span>
                  <span className="sl-date">{s.dateLabel}</span>
                </div>
                <div className="sl-schedule-body">
                  {/* 受付はセミナー本編より前。A区分（セミナーから参加）の案内なので
                      交流会のみの方向けの表示（区分カード側）には出さない */}
                  {s.receptionTimeLabel && <p className="sl-time sl-time-sub">{s.receptionTimeLabel}</p>}
                  <p className="sl-time">{s.timeLabel}</p>
                  {s.partyTimeLabel && <p className="sl-time sl-time-sub">{s.partyTimeLabel}</p>}
                  {config.venue ? (
                    <p className="sl-venue">
                      会場：{config.venue.seminar}
                      {config.venue.party && config.venue.party !== config.venue.seminar && (
                        <><br />懇親会：{config.venue.party}</>
                      )}
                      {config.venue.party && config.venue.party === config.venue.seminar && (
                        <><br />セミナー・懇親会とも同じ会場です</>
                      )}
                    </p>
                  ) : (
                    <p className="sl-venue">オンライン（Zoom）</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {/* リアル回は参加区分が2つ（どちらも同額・時間と会場が違う）。
              申込前にどちらを選ぶか判断できるよう、日程の直後に並べる。 */}
          {isReal && (
            <div className="sl-tiers">
              {REAL_ATTEND_TIERS.map(t => (
                <div className="sl-tier" key={t.label}>
                  <div className="sl-tier-head">
                    <span className="sl-tier-name">{t.label}</span>
                    <span className="sl-tier-price">{priceParts.amount}</span>
                  </div>
                  <p className="sl-tier-time">🕒 {t.timeLabel}</p>
                  <p className="sl-tier-venue">
                    📍 {t.venue.main}
                    {t.venue.sub && t.venue.sub !== t.venue.main && <>（懇親会：{t.venue.sub}）</>}
                  </p>
                  <p className="sl-tier-cap">👥 定員 {t.capacity}名</p>
                  <p className="sl-tier-summary">{t.summary}</p>
                </div>
              ))}
            </div>
          )}
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

      {/* 参加費に含まれるもの（リアル回のみ）— 価格の直前に何が含まれるかを並べる */}
      {config.valueTable && (
        <section className={'sl-section' + rc('included')} id="value">
          <div className="sl-container">
            {eyebrow('included')}
            <h2>{config.valueTable.heading}</h2>
            {config.valueTable.lead && <p className="sl-section-lead">{config.valueTable.lead}</p>}
            <div className="sl-value-table">
              <div className="sl-value-head">
                <span className="sl-value-head-label">参加すると得られること</span>
                <span className="sl-value-head-tier">{REAL_ATTEND_TIERS[0]?.label}</span>
                <span className="sl-value-head-tier">{REAL_ATTEND_TIERS[1]?.label}</span>
              </div>
              {config.valueTable.rows.map(r => (
                <div className="sl-value-row" key={r.label}>
                  <div className="sl-value-main">
                    <span className="sl-value-label">{r.label}</span>
                    <span className="sl-value-body">{r.body}</span>
                  </div>
                  <div
                    className={r.seminar ? 'sl-value-mark is-on' : 'sl-value-mark'}
                    data-tier={REAL_ATTEND_TIERS[0]?.label}
                    aria-label={`${r.label}：${REAL_ATTEND_TIERS[0]?.label}は${r.seminar ? '含む' : '含まない'}`}
                  >
                    {r.seminar ? '✓' : '—'}
                  </div>
                  <div
                    className={r.party ? 'sl-value-mark is-on' : 'sl-value-mark'}
                    data-tier={REAL_ATTEND_TIERS[1]?.label}
                    aria-label={`${r.label}：${REAL_ATTEND_TIERS[1]?.label}は${r.party ? '含む' : '含まない'}`}
                  >
                    {r.party ? '✓' : '—'}
                  </div>
                </div>
              ))}
            </div>
            <div className="sl-value-closing">
              <p className="sl-value-closing-text">{config.valueTable.closing}</p>
              <p className="sl-value-closing-price">
                参加費 <strong>{priceParts.amount}</strong>
                {priceParts.suffix && <span className="sl-value-closing-suffix">（{priceParts.suffix}）</span>}
              </p>
              {config.priceNote && <p className="sl-value-closing-note">{config.priceNote}</p>}
              <a href="#apply" className="sl-cta sl-cta-inline">{ctaLabel}</a>
            </div>
          </div>
        </section>
      )}

      {/* 対象者別メッセージ（リアル回のみ） */}
      {config.audience && (
        <section className={'sl-section sl-section-alt' + rc('audience')}>
          <div className="sl-container">
            {eyebrow('audience')}
            <h2>{config.audience.heading}</h2>
            {config.audience.lead && <p className="sl-section-lead">{config.audience.lead}</p>}
            <div className="sl-audience">
              {config.audience.items.map(a => (
                <div className="sl-audience-card" key={a.label}>
                  <h3>{a.label}</h3>
                  <p>{a.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* クロージング（リアル回のみ） */}
      {config.closing && (
        <section className={'sl-section sl-closing' + rc('closing')}>
          <div className="sl-container">
            {eyebrow('closing')}
            <h2>{config.closing.heading}</h2>
            <div className="sl-closing-body">
              {config.closing.paragraphs.map((text, i) => (
                <p key={i}>{text}</p>
              ))}
            </div>
            <p className="sl-punch">{config.closing.punch}</p>
            <div className="sl-closing-box">
              <p className="sl-closing-price-label">参加費</p>
              <p className="sl-closing-price">
                <span className="sl-closing-amount">{priceParts.amount}</span>
                {priceParts.suffix && <span className="sl-closing-suffix">（{priceParts.suffix}）</span>}
              </p>
              {config.priceNote && <p className="sl-closing-note">{config.priceNote}</p>}
              {heroDate && (
                <p className="sl-closing-when">
                  {heroDate}
                  {config.venue && `／${config.venue.seminar}`}
                </p>
              )}
              <a href="#apply" className="sl-cta sl-cta-inline">{ctaLabel}</a>
              <p className="sl-closing-cap">
                定員：{capacityText}
                {config.capacityParty && `（${pendingLabel(config.capacityParty)}）`}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 申込フォーム */}
      <section className={'sl-section' + rc('apply')} id="apply">
        <div className="sl-container">
          {eyebrow('apply')}
          {config.priceValueNote && (
            <div className="sl-price-value">
              <p className="sl-price-value-lead">{config.priceValueNote.lead}</p>
              {config.priceValueNote.lines.map(line => (
                <p className="sl-price-value-line" key={line}>{line}</p>
              ))}
              <p className="sl-price-value-punch">{config.priceValueNote.punch}</p>
            </div>
          )}
          <div className="sl-form-card">
            {submitted ? (
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ marginBottom: '12px' }}>お申し込みありがとうございます</h2>
                <p style={{ color: '#666' }}>
                  ご登録のメールアドレスに申し込み受付リンクを発行いたしました。<br />
                  申し込み決済順になりますので、無くなり次第終了とさせていただきます！
                </p>
                <p style={{ marginTop: '20px' }}>
                  <a href="/" className="sl-back-link">← トップページに戻る</a>
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
                              {/* リアル回は同じ日に2区分が並ぶので、どちらか分かるようにする */}
                              {realTierFor(ev.event_date) ? `／${realTierFor(ev.event_date)!.label}` : ''}
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
                  <button type="submit" className="sl-submit" disabled={submitting}>
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
        <div className="sl-container">&copy; 2026 KAMO FUNDING. 共犯者を集め、夢を叶える場所。<LegalFooter /></div>
      </footer>
    </div>
  );
}
