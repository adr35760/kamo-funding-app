'use client';

import { useEffect, useState } from 'react';
import '@/styles/kamo-icons.css';
import '@/styles/seminar-landing.css';
import { AWARD_EVENT, awardBreakdown, pendingLabel, splitPriceLabel, PRICE_TAX_NOTE } from '@/lib/seminar-config';
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
 * 11/9 KAMOファンディングアワードの専用LP（/award）
 *
 * 🔴 **SeminarLanding を流用していない理由**: あちらは 12/8 とオンライン回の構造
 *   （参加区分カード・programClosing「2時間半後には企画が完成」・第1部〜第5部）に
 *   密結合していて、アワードに存在しない要素が必ず付いてくる。
 *   意匠（seminar-landing.css）だけを共有し、構造はこちらで持つ。
 *
 * 🔴 定員は 40 のみ表示する。表彰式会場の 100 名は出さない
 *   （券が懇親会込みの1種類しかないため、実質の上限は 40。
 *    100 を出すと 41 人目が「まだ空いている」と誤解する）。
 */
export default function AwardLanding({ initialEvents = [] }: { initialEvents?: EventRow[] }) {
  const [events, setEvents] = useState<EventRow[]>(initialEvents);
  const [loadingEvents, setLoadingEvents] = useState(initialEvents.length === 0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const accent = '#C9A227';

  useEffect(() => {
    if (initialEvents.length > 0) return;
    fetch('/api/events')
      .then(r => r.json())
      .then(d => {
        setEvents((d.events || []).filter((e: EventRow) => e.pillar === AWARD_EVENT.pillar));
      })
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvents(false));
  }, [initialEvents.length]);

  useEffect(() => { captureUtm(); }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    formData.forEach((v, k) => { data[k] = v as string; });
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

  const priceParts = splitPriceLabel(AWARD_EVENT.price);

  return (
    <div className="seminar-lp theme-real">
      <SiteHeader cta={{ href: '#apply', label: '申し込む' }} />

      <section className="sl-hero">
        <div className="sl-container">
          <div className="sl-badge">{AWARD_EVENT.format}</div>
          <h1>{AWARD_EVENT.title}</h1>
          <p className="sl-lead">{AWARD_EVENT.lead}</p>
          <div className="sl-price-box">
            <div className="sl-price-main">
              <span className="sl-price-label">参加費</span>
              <span className="sl-price-amount">{priceParts.amount}</span>
              {priceParts.suffix && <span className="sl-price-suffix">（{priceParts.suffix}）</span>}
            </div>
            <div className="sl-price-note">{AWARD_EVENT.dateLabel}／{AWARD_EVENT.venue.main}</div>
            <div className="sl-price-capacity">👥 定員：{pendingLabel(AWARD_EVENT.capacity)}</div>
          </div>
          <a href="#apply" className="sl-cta">申し込む →</a>
        </div>
      </section>

      {/* 当日の流れ — 第二部と懇親会の間が空くので、区間を並べて出す */}
      <section className="sl-section">
        <div className="sl-container">
          <h2>当日の流れ</h2>
          <p className="sl-note" style={{ marginTop: 0, marginBottom: '24px' }}>{awardBreakdown()}</p>
          <div className="sl-program">
            <div className="sl-program-item">
              <div className="sl-program-label" style={{ background: accent }}>受付</div>
              <div className="sl-program-body">
                <h3>{AWARD_EVENT.receptionTimeLabel}</h3>
                <p>{AWARD_EVENT.venue.main} にて受付を行います。</p>
              </div>
            </div>
            {AWARD_EVENT.parts.map(p => (
              <div className={p.party ? 'sl-program-item is-party' : 'sl-program-item'} key={p.label}>
                <div className="sl-program-label" style={p.party ? undefined : { background: accent }}>
                  {p.label}
                </div>
                <div className="sl-program-body">
                  <h3>{p.title}</h3>
                  <p>🕒 {p.timeLabel}　📍 {p.venue}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="sl-note">
            第二部の終了後、会場を移して懇親会を行います（{AWARD_EVENT.venue.party}）。
          </p>
        </div>
      </section>

      <section className="sl-section sl-section-alt">
        <div className="sl-container">
          <h2>開催概要</h2>
          <p className="sl-price-capacity">📅 {AWARD_EVENT.dateLabel}</p>
          <p className="sl-price-capacity">🏢 {AWARD_EVENT.format}</p>
          <p className="sl-price-capacity">📍 {AWARD_EVENT.venue.main}（懇親会：{AWARD_EVENT.venue.party}）</p>
          <p className="sl-price-capacity">💰 参加費：{pendingLabel(AWARD_EVENT.price)}</p>
          <p className="sl-price-capacity">👥 定員：{pendingLabel(AWARD_EVENT.capacity)}</p>
          {PRICE_TAX_NOTE && <p className="sl-note">{PRICE_TAX_NOTE}</p>}
        </div>
      </section>

      <section className="sl-section" id="apply">
        <div className="sl-container">
          <div className="sl-form-card">
            {submitted ? (
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ marginBottom: '12px' }}>お申し込みありがとうございます</h2>
                <p style={{ color: '#666' }}>
                  ご登録のメールアドレスに確認メールをお送りしました。<br />
                  お支払い方法もそのメールに記載しています。
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
                        : (
                            <option value="" disabled>
                              {AWARD_EVENT.dateLabel} {AWARD_EVENT.parts[0].timeLabel}
                              {loadingEvents ? '（読み込み中）' : '（現在受付を準備中）'}
                            </option>
                          )}
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
                    <label>ご質問・メッセージ（任意）</label>
                    <textarea name="challenge" placeholder="当日についてのご質問などをお書きください"></textarea>
                  </div>
                  {error && <p className="sl-error">{error}</p>}
                  <button type="submit" className="sl-submit" disabled={submitting} style={{ background: accent }}>
                    {submitting ? '送信中...' : '申し込む →'}
                  </button>
                  <p className="sl-hint" style={{ textAlign: 'center', marginTop: '12px' }}>
                    お支払い方法・当日の詳細は、お申し込み後のメールでご案内します。
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      <LegalFooter />
    </div>
  );
}
