'use client';

import { useEffect, useState } from 'react';
import SiteHeader from '@/components/SiteHeader';
import { formatEventDateJa } from '@/lib/event-format';
import { captureUtm, getUtmPayload } from '@/lib/utm';
import { AI_SEMINAR, REAL_SEMINAR } from '@/lib/seminar-config';
import '@/styles/seminar-hub.css';

export interface HubEvent {
  id: string;
  title: string;
  type: string;
  pillar: number;
  event_date: string;
  duration_minutes: number | null;
  location: string | null;
  capacity: number | null;
  finished?: boolean;
}

/** イベント種別 → 表示用の情報。DBのtypeを唯一の判定軸にする */
const KIND = {
  seminar: {
    label: 'オンラインセミナー',
    short: 'オンライン',
    price: AI_SEMINAR.price.label,
    detailHref: '/ai-seminar',
    place: 'オンライン（Zoom）',
  },
  networking: {
    label: 'リアルセミナー＆懇親会',
    short: 'リアル＆懇親会',
    price: REAL_SEMINAR.price.label,
    detailHref: '/real-seminar',
    place: 'エデュケーションギャラリー',
  },
} as const;

type KindKey = keyof typeof KIND;

function kindOf(ev: HubEvent): KindKey {
  return ev.type === 'networking' ? 'networking' : 'seminar';
}

/** 比較カードの内容（料金・形式・所要時間・含まれるもの） */
const COMPARE = [
  {
    key: 'seminar' as KindKey,
    title: 'オンラインセミナー',
    price: AI_SEMINAR.price.label,
    priceNote: null as string | null,
    format: 'オンライン開催（Zoom）',
    duration: '4時間（16:00〜20:00）',
    capacity: '20名',
    includes: AI_SEMINAR.contents,
    detailHref: '/ai-seminar',
    accent: 'red' as const,
  },
  {
    key: 'networking' as KindKey,
    title: 'リアルセミナー＆懇親会',
    price: REAL_SEMINAR.price.label,
    priceNote: REAL_SEMINAR.priceNote ?? null,
    format: 'リアル開催（セミナー＋懇親会）',
    duration: '5時間（15:00〜20:00）',
    capacity: 'セミナー20名 / 懇親会35名',
    includes: REAL_SEMINAR.contents,
    detailHref: '/real-seminar',
    accent: 'gold' as const,
  },
];

export default function SeminarHubClient({ initialEvents }: { initialEvents: HubEvent[] }) {
  const [events, setEvents] = useState<HubEvent[]>(initialEvents);
  const [loading, setLoading] = useState(initialEvents.length === 0);
  const [selected, setSelected] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // サーバーで取得できていなければ /api/events にフォールバック
  useEffect(() => {
    if (initialEvents.length > 0) return;
    fetch('/api/events')
      .then(r => r.json())
      .then(d => {
        const rows: HubEvent[] = (d.events || []).filter(
          (e: HubEvent) => e.type === 'seminar' || e.type === 'networking'
        );
        setEvents(rows);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [initialEvents.length]);

  // 流入元（UTM）を保持する。既存ページと同じ仕組み
  useEffect(() => {
    captureUtm();
  }, []);

  // ページ内アンカーをスムーズスクロールに
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

  /** 日程を選んで申込フォームへ移動する */
  const chooseAndJump = (id: string) => {
    setSelected(id);
    const el = document.querySelector('#apply');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    formData.forEach((v, k) => { data[k] = v as string; });
    // 流入元（UTM）を添付。取れていなければ何も付かない（申込は必ず通す）
    Object.assign(data, getUtmPayload());
    if (!data.event_id) {
      setError('参加希望日を選択してください');
      setSubmitting(false);
      return;
    }
    try {
      // 既存の申込経路をそのまま使う（完了メール・リマインドcron・満席/中止判定を継承）
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

  return (
    <>
      <SiteHeader />
      <div className="seminar-hub-page">
        {/* ヒーロー */}
        <section className="sh-hero">
          <div className="sh-container">
            <div className="sh-hero-badge">
              <span className="sh-hero-badge-dot" />
              オンライン / リアル 両方から選べます
            </div>
            <h1>
              セミナー日程を選んで<span className="gold">そのまま申し込む</span>
            </h1>
            <p className="sh-hero-sub">
              オンラインセミナーとリアルセミナー＆懇親会。
              <wbr />
              2つの日程を見比べて、このページからそのままお申し込みいただけます。
            </p>
            <div className="sh-hero-highlight">
              <span className="sh-hero-highlight-icon" aria-hidden="true">🔥</span>
              <span>
                <strong>参加者はその場でAIクラファンページが作れます。</strong>
                KAMOファンディング独自のツールを両セミナー共通で体験いただけます。
              </span>
            </div>
            <a href="#schedule" className="sh-hero-cta">日程を見る →</a>
          </div>
        </section>

        {/* 2種類を比較 */}
        <section className="sh-section" id="compare">
          <div className="sh-container">
            <div className="sh-section-title">
              <h2>2つの<span className="accent">参加スタイル</span></h2>
              <p>ご都合と目的に合わせてお選びください。</p>
            </div>
            <div className="sh-compare">
              {COMPARE.map(c => (
                <div className={`sh-compare-card sh-accent-${c.accent}`} key={c.key}>
                  <div className="sh-compare-head">
                    <span className="sh-compare-kind">{c.title}</span>
                    <span className="sh-compare-price">{c.price}</span>
                    {c.priceNote && <span className="sh-compare-price-note">{c.priceNote}</span>}
                  </div>
                  <dl className="sh-compare-spec">
                    <div className="sh-spec-row">
                      <dt>開催形式</dt>
                      <dd>{c.format}</dd>
                    </div>
                    <div className="sh-spec-row">
                      <dt>所要時間</dt>
                      <dd>{c.duration}</dd>
                    </div>
                    <div className="sh-spec-row">
                      <dt>定員</dt>
                      <dd>{c.capacity}</dd>
                    </div>
                  </dl>
                  <div className="sh-compare-includes">
                    <p className="sh-includes-label">含まれるもの</p>
                    <ul>
                      {c.includes.map(item => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                  <a href={c.detailHref} className="sh-compare-detail">詳しく見る →</a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 日程一覧 */}
        <section className="sh-section sh-section-alt" id="schedule">
          <div className="sh-container">
            <div className="sh-section-title">
              <h2>開催<span className="accent">日程</span></h2>
              <p>ご希望の回を選んでお申し込みください。</p>
            </div>

            {events.length === 0 ? (
              <div className="sh-empty">
                <p className="sh-empty-title">
                  {loading ? '日程を読み込んでいます...' : '現在募集中の日程はありません'}
                </p>
                <p className="sh-empty-sub">
                  {loading ? '' : '次回日程は近日公開します。公開までお待ちください。'}
                </p>
              </div>
            ) : (
              <div className="sh-schedule">
                {events.map(ev => {
                  const k = KIND[kindOf(ev)];
                  const isSelected = selected === ev.id;
                  return (
                    <div className={`sh-slot${isSelected ? ' is-selected' : ''}`} key={ev.id}>
                      <div className={`sh-slot-date sh-accent-${kindOf(ev) === 'networking' ? 'gold' : 'red'}`}>
                        {formatEventDateJa(ev.event_date, ev.duration_minutes)}
                      </div>
                      <div className="sh-slot-body">
                        <span className={`sh-slot-kind sh-kind-${kindOf(ev)}`}>{k.label}</span>
                        <p className="sh-slot-title">{ev.title}</p>
                        <p className="sh-slot-meta">
                          <span className="sh-slot-price">{k.price}</span>
                          <span className="sh-slot-place">{ev.location || k.place}</span>
                        </p>
                      </div>
                      <div className="sh-slot-action">
                        <button type="button" onClick={() => chooseAndJump(ev.id)}>
                          {isSelected ? '選択中 ✓' : 'この回に申し込む'}
                        </button>
                        <a href={k.detailHref} className="sh-slot-detail">詳しく見る →</a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* 申込フォーム */}
        <section className="sh-section" id="apply">
          <div className="sh-container sh-container-narrow">
            <div className="sh-form-card">
              {submitted ? (
                <div className="sh-thanks">
                  <h2>お申し込みありがとうございます</h2>
                  <p>
                    ご登録のメールアドレスに確認メールをお送りしました。<br />
                    当日の詳細もあわせてご確認ください。
                  </p>
                  <p className="sh-thanks-back">
                    <a href="/">← トップページに戻る</a>
                  </p>
                </div>
              ) : (
                <>
                  <div className="sh-section-title sh-form-title">
                    <h2>お申し込み</h2>
                    <p>ご希望の回を選んで、必要事項をご入力ください。</p>
                  </div>
                  <form onSubmit={handleSubmit}>
                    <div className="sh-form-group">
                      <label htmlFor="sh-event">参加希望日 <span className="sh-required">必須</span></label>
                      <select
                        id="sh-event"
                        name="event_id"
                        required
                        value={selected}
                        onChange={e => setSelected(e.target.value)}
                      >
                        <option value="" disabled>選択してください</option>
                        {events.map(ev => (
                          <option key={ev.id} value={ev.id}>
                            {KIND[kindOf(ev)].short}／{formatEventDateJa(ev.event_date, ev.duration_minutes)}／{KIND[kindOf(ev)].price}
                          </option>
                        ))}
                      </select>
                      {events.length === 0 && (
                        <p className="sh-hint">
                          {loading
                            ? '日程を読み込んでいます...'
                            : '日程を取得できませんでした。お手数ですが、ページを再読み込みしてください。'}
                        </p>
                      )}
                    </div>
                    <div className="sh-form-row">
                      <div className="sh-form-group">
                        <label htmlFor="sh-name">お名前 <span className="sh-required">必須</span></label>
                        <input id="sh-name" type="text" name="name" required placeholder="例: 鴨頭 太郎" />
                      </div>
                      <div className="sh-form-group">
                        <label htmlFor="sh-email">メールアドレス <span className="sh-required">必須</span></label>
                        <input id="sh-email" type="email" name="email" required placeholder="example@email.com" />
                      </div>
                    </div>
                    <div className="sh-form-group">
                      <label htmlFor="sh-company">会社・団体名（任意）</label>
                      <input id="sh-company" type="text" name="company" placeholder="例: 株式会社カモ" />
                    </div>
                    <div className="sh-form-group">
                      <label htmlFor="sh-challenge">クラウドファンディングで実現したいこと <span className="sh-required">必須</span></label>
                      <textarea
                        id="sh-challenge"
                        name="challenge"
                        required
                        placeholder="実現したいこと、聞きたいことなどをお書きください"
                      />
                    </div>
                    {error && <p className="sh-error">{error}</p>}
                    <button type="submit" className="sh-submit" disabled={submitting}>
                      {submitting ? '送信中...' : '申し込む 🔥'}
                    </button>
                    <p className="sh-form-note">
                      お申し込み後、確認メールに当日のご案内をお送りします。
                    </p>
                  </form>
                </>
              )}
            </div>
          </div>
        </section>

        <footer className="sh-footer">
          <div className="sh-container">
            KAMO FUNDING — 共犯者を集め、夢を叶える場所
          </div>
        </footer>
      </div>
    </>
  );
}
