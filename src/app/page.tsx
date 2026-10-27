'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import '@/styles/top-lp.css';
import SiteHeader from '@/components/SiteHeader';
import LegalFooter from '@/components/LegalFooter';
import { CONSULT_URL, CONSULT_MINUTES } from '@/lib/seminar-info-content';
import {
  LP_CARDS,
  LP_EMPATHY,
  LP_FINAL,
  LP_FOLLOW,
  LP_FORM,
  LP_HERO,
  LP_TRUST,
  type LpCard,
} from '@/lib/top-lp-content';
import {
  CONSULT_CATEGORIES,
  CONSULT_SUMMARY_MAX,
  validateConsult,
  type ConsultCategory,
} from '@/lib/consult-shared';
import { initAnalytics, track, type CtaPosition } from '@/lib/analytics';

/**
 * トップページ（/）— LP実装仕様書 v1.1 の Z1〜Z6＋相談フォーム。
 *
 * 構成（§2）:
 *   Z1 ファーストビュー / Z2 共感 / Z3 分岐ハブ（4カード）/ Z4 信頼性 /
 *   Z5 最終CTA / 相談フォーム（§10）/ Z6 追従CTA
 *
 * 🔴 触らないもの（PM指示 2026-10-27）:
 *   SiteHeader（ヘッダーCTAは現行のまま）・LegalFooter・他ページ・vercel.json。
 *   デザイントークンはこのページ内（.tlp-page）に閉じて定義し、globals.css は触らない。
 *
 * 🔴 未確定値は src/lib/top-lp-content.ts に集約する（本文にベタ書きしない）。
 */

/** TODO(t iku確認中: 仕様書§7は「30分」。実際の予約枠は45分のため定数で表示／PM判断 2026-10-27) */
const FINAL_NOTE = `${CONSULT_MINUTES}分のオンライン相談。経験豊富なアドバイザーが対応します`;

type SubmitState = 'idle' | 'submitting' | 'error' | 'done';

export default function HomePage() {
  const formRef = useRef<HTMLElement | null>(null);
  const startedRef = useRef(false);
  const [showFollow, setShowFollow] = useState(false);
  const [category, setCategory] = useState<ConsultCategory>(CONSULT_CATEGORIES[0]);
  const [formEntrance, setFormEntrance] = useState<number>(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [summary, setSummary] = useState('');
  const [agree, setAgree] = useState(false);
  const [status, setStatus] = useState<SubmitState>('idle');
  const [errors, setErrors] = useState<string[]>([]);

  // ===== 計測（§11）: GA4は任意。IDが無くてもエラーにしない =====
  useEffect(() => {
    initAnalytics(process.env.NEXT_PUBLIC_GA_ID);
  }, []);

  // ===== Z6 追従CTA: スクロール50%（半画面）超で初回表示 =====
  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > window.innerHeight * 0.5) setShowFollow(true);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ===== scroll_depth（25/50/75/100%・各1回） =====
  useEffect(() => {
    const fired = new Set<number>();
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const ratio = max <= 0 ? 1 : (window.scrollY / max) * 100;
      for (const percent of [25, 50, 75, 100]) {
        if (ratio >= percent && !fired.has(percent)) {
          fired.add(percent);
          track('scroll_depth', { percent });
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /** フォームへスクロール（①④のCTA・Z5・追従CTAの共通処理） */
  const goConsult = useCallback(
    (entrance: number, position: CtaPosition, preset?: ConsultCategory) => {
      track('cta_click', { entrance, position });
      if (preset) setCategory(preset);
      setFormEntrance(entrance);
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      formRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    },
    []
  );

  const onHeroCta = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      goConsult(1, 'fv');
    },
    [goConsult]
  );

  const onFinalCta = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      goConsult(1, 'footer');
    },
    [goConsult]
  );

  const onFollowCta = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      goConsult(formEntrance, 'follow');
    },
    [goConsult, formEntrance]
  );

  /** カードのクリック。①②③④すべてカード全体がクリック領域（§5.1） */
  const onCardClick = useCallback(
    (card: LpCard) => (e: React.MouseEvent<HTMLAnchorElement>) => {
      // ページ内フォームへ行くカード（①④）は goConsult が cta_click を送るので、
      // ここでは送らない（二重計上になる）。外部ページへ行くカード（②③）だけここで送る。
      if (card.href.startsWith('#')) {
        e.preventDefault();
        goConsult(card.id, 'hub', card.consult);
        return;
      }
      track('cta_click', { entrance: card.id, position: 'hub' });
    },
    [goConsult]
  );

  /** フォーム最初のフィールドにフォーカスした時だけ form_start を送る */
  const onFormStart = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    track('form_start', { entrance: formEntrance });
  }, [formEntrance]);

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const payload = {
        name,
        email,
        phone,
        category,
        summary,
        agree,
        entrance: formEntrance,
        source: 'top-lp',
      };

      const checked = validateConsult(payload);
      if (!checked.ok) {
        setErrors(checked.errors);
        setStatus('error');
        return;
      }

      setStatus('submitting');
      setErrors([]);
      try {
        const res = await fetch('/api/consult', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; errors?: string[] };
        if (!res.ok || !data.ok) {
          setErrors(
            data.errors && data.errors.length > 0
              ? data.errors
              : ['送信に失敗しました。時間をおいてもう一度お試しください']
          );
          setStatus('error');
          return;
        }
        track('form_submit', { entrance: formEntrance });
        setStatus('done');
        formRef.current?.scrollIntoView({ block: 'start' });
      } catch {
        setErrors(['通信エラーで送信できませんでした。電波の良い場所でもう一度お試しください']);
        setStatus('error');
      }
    },
    [name, email, phone, category, summary, agree, formEntrance]
  );

  const submitting = status === 'submitting';

  return (
    <div className="tlp-page">
      {/* ヘッダーCTAは現行のまま（PM指示） */}
      <SiteHeader
        current="/"
        cta={{ href: CONSULT_URL, label: '個別相談を予約', external: true }}
      />

      <main>
        {/* ===== Z1 ファーストビュー ===== */}
        <section className="tlp-hero" aria-label="KAMOファンディング">
          {/* 大見出しはKVに焼き込み済みでHTMLには出さない（§3.2）。
              ただしページにh1が1つも無いとSEO・読み上げで不利なので、sr-onlyでh1を置く（PM 2026-10-27） */}
          <h1 className="tlp-sr-only">挑戦を、加速させろ。クラファンのプロが伴走します</h1>
          <div className="tlp-hero-frame">
            {/* KVはLCP。寸法を明示してレイアウトシフトを防ぐ */}
            <img
              className="tlp-hero-img"
              src={LP_HERO.image}
              alt={LP_HERO.imageAlt}
              width={1672}
              height={941}
              fetchPriority="high"
            />
            <div className="tlp-hero-copy">
              <p className="tlp-hero-lead">
                {LP_HERO.lead[0]}
                <br />
                {LP_HERO.lead[1]}
              </p>
              <a className="tlp-btn tlp-btn-primary" href="#consult" onClick={onHeroCta}>
                {LP_HERO.cta}
              </a>
              {/* TODO(t iku確認中: 「最短24時間返信」は運用約束。文言は仕様書§3.2のまま／PM 2026-10-27) */}
              <p className="tlp-hero-note">{LP_HERO.note}</p>
            </div>
          </div>
        </section>

        {/* ===== Z2 共感 ===== */}
        <section className="tlp-empathy">
          <div className="tlp-inner">
            <h2 className="tlp-h2">{LP_EMPATHY.heading}</h2>
            <p className="tlp-body">{LP_EMPATHY.body}</p>
            <p className="tlp-empathy-lead">{LP_EMPATHY.lead}</p>
          </div>
        </section>

        {/* ===== Z3 分岐ハブ（2×2） ===== */}
        <section className="tlp-hub" id="hub">
          <div className="tlp-inner">
            <h2 className="tlp-sr-only">4つの入り口</h2>
            <div className="tlp-cards">
              {LP_CARDS.map((card) => (
                <a
                  key={card.id}
                  className={`tlp-card tlp-card-${card.id}`}
                  href={card.href}
                  onClick={onCardClick(card)}
                  data-entrance={card.id}
                >
                  <span className="tlp-card-media">
                    <img
                      className="tlp-card-img"
                      src={card.image}
                      alt=""
                      width={card.id === 4 ? 1536 : 1672}
                      height={card.id === 4 ? 1024 : 941}
                      loading="lazy"
                    />
                  </span>
                  <span className="tlp-card-body">
                    <span className="tlp-card-badge">{card.badge}</span>
                    <span className="tlp-card-title">{card.heading}</span>
                    <span className="tlp-card-text">{card.body}</span>
                    <span className="tlp-card-cta">{card.cta}</span>
                    <span className="tlp-card-note">{card.note}</span>
                    {card.footnote ? <span className="tlp-card-footnote">{card.footnote}</span> : null}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ===== Z4 信頼性 ===== */}
        <section className="tlp-trust">
          <div className="tlp-inner">
            <h2 className="tlp-sr-only">実績</h2>
            <div className="tlp-trust-grid">
              <div className="tlp-trust-item">
                <div className="tlp-trust-value tlp-trust-value-pending">{LP_TRUST.projectsLabel}</div>
                <div className="tlp-trust-label">{LP_TRUST.projectsNote}</div>
              </div>
              <div className="tlp-trust-item">
                <div className="tlp-trust-value">{LP_TRUST.rateLabel}</div>
                <div className="tlp-trust-label">{LP_TRUST.rateNote}</div>
              </div>
              <div className="tlp-trust-item">
                <div className="tlp-trust-value">{LP_TRUST.raisedLabel}</div>
                <div className="tlp-trust-label">{LP_TRUST.raisedNote}</div>
              </div>
            </div>
            <p className="tlp-trust-source">{LP_TRUST.source}</p>
          </div>
        </section>

        {/* ===== Z5 最終CTA ===== */}
        <section className="tlp-final">
          <div className="tlp-inner">
            <a className="tlp-btn tlp-btn-primary tlp-btn-lg" href="#consult" onClick={onFinalCta}>
              {LP_FINAL.cta}
            </a>
            <p className="tlp-final-note">{FINAL_NOTE}</p>
          </div>
        </section>

        {/* ===== 相談フォーム（§10） ===== */}
        <section className="tlp-form-section" id="consult" ref={formRef}>
          <div className="tlp-inner">
            <h2 className="tlp-h2">{LP_FORM.heading}</h2>
            <p className="tlp-form-lead">{LP_FORM.lead}</p>

            {status === 'done' ? (
              <div className="tlp-form-done" role="status">
                <h3 className="tlp-h3">{LP_FORM.doneHeading}</h3>
                <p className="tlp-body">{LP_FORM.doneBody}</p>
              </div>
            ) : (
              <form className="tlp-form" onSubmit={onSubmit} noValidate>
                {errors.length > 0 ? (
                  <div className="tlp-form-errors" role="alert">
                    <ul>
                      {errors.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="tlp-field">
                  <label className="tlp-label" htmlFor="consult-name">
                    氏名<span className="tlp-required">必須</span>
                  </label>
                  <input
                    id="consult-name"
                    className="tlp-input"
                    type="text"
                    name="name"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onFocus={onFormStart}
                  />
                </div>

                <div className="tlp-field">
                  <label className="tlp-label" htmlFor="consult-email">
                    メールアドレス<span className="tlp-required">必須</span>
                  </label>
                  <input
                    id="consult-email"
                    className="tlp-input"
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={onFormStart}
                  />
                </div>

                <div className="tlp-field">
                  <label className="tlp-label" htmlFor="consult-phone">
                    電話番号
                  </label>
                  <input
                    id="consult-phone"
                    className="tlp-input"
                    type="tel"
                    name="phone"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onFocus={onFormStart}
                  />
                </div>

                <fieldset className="tlp-field tlp-fieldset">
                  <legend className="tlp-label">
                    相談区分<span className="tlp-required">必須</span>
                  </legend>
                  <div className="tlp-radios">
                    {CONSULT_CATEGORIES.map((option) => (
                      <label key={option} className="tlp-radio">
                        <input
                          type="radio"
                          name="category"
                          value={option}
                          checked={category === option}
                          onChange={() => setCategory(option)}
                          onFocus={onFormStart}
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="tlp-field">
                  <label className="tlp-label" htmlFor="consult-summary">
                    挑戦・相談の概要<span className="tlp-required">必須</span>
                  </label>
                  <textarea
                    id="consult-summary"
                    className="tlp-input tlp-textarea"
                    name="summary"
                    rows={6}
                    maxLength={CONSULT_SUMMARY_MAX}
                    required
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    onFocus={onFormStart}
                  />
                  <p className="tlp-counter">
                    {summary.length} / {CONSULT_SUMMARY_MAX}文字
                  </p>
                </div>

                <label className="tlp-consent">
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                    onFocus={onFormStart}
                  />
                  <span>
                    <a href="/privacy" target="_blank" rel="noopener noreferrer">
                      プライバシーポリシー
                    </a>
                    に同意します
                  </span>
                </label>

                <button className="tlp-btn tlp-btn-primary tlp-submit" type="submit" disabled={submitting}>
                  {submitting ? LP_FORM.submitting : LP_FORM.submit}
                </button>
              </form>
            )}
          </div>
        </section>
      </main>

      <footer className="tlp-footer">
        <div className="tlp-footer-inner">
          <p className="tlp-footer-copy">&copy; 2026 KAMO FUNDING. 共犯者を集め、夢を叶える場所。</p>
          <a href="/admin" className="tlp-admin-link">
            管理画面
          </a>
          <LegalFooter />
        </div>
      </footer>

      {/* ===== Z6 追従CTA ===== */}
      {showFollow ? (
        <div className="tlp-follow">
          <a className="tlp-follow-link" href="#consult" onClick={onFollowCta}>
            <span className="tlp-follow-pc">{LP_FOLLOW.pc}</span>
            <span className="tlp-follow-sp">{LP_FOLLOW.sp}</span>
          </a>
        </div>
      ) : null}
    </div>
  );
}
