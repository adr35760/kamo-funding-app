'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import '@/styles/top-lp.css';
import SiteHeader from '@/components/SiteHeader';
import StatsBanner from '@/components/StatsBanner';
import LegalFooter from '@/components/LegalFooter';
import { CONSULT_URL, CONSULT_MINUTES } from '@/lib/seminar-info-content';
import {
  LP_CARDS,
  LP_EMPATHY,
  LP_FINAL,
  LP_FOLLOW,
  LP_FORM,
  LP_HERO,
  LP_STEPS,
  LP_SUCCESS,
  LP_SUPPORT,
  LP_TRUST,
  type LpCard,
} from '@/lib/top-lp-content';
import {
  allSuccessCases,
  caseImage,
  formatManYen,
  CASE_IMAGE_WIDTH,
  CASE_IMAGE_HEIGHT,
} from '@/lib/success-cases';
import {
  CONSULT_CATEGORIES,
  CONSULT_SUMMARY_MAX,
  validateConsult,
  type ConsultCategory,
} from '@/lib/consult-shared';
import { initAnalytics, track, type CtaPosition } from '@/lib/analytics';

/**
 * トップページ（/）の本体 — LP実装仕様書 v1.1 の Z1〜Z6＋相談フォーム。
 *
 * 🔴 ルート側（src/app/page.tsx）は**サーバーコンポーネント**にして
 *    `/` 専用の title / description を持たせている（layout.tsx は共通のまま）。
 *    そのため画面本体はここに分離し、'use client' はこのファイルにだけ付ける。
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

/**
 * Z3.5 成功事例カード（2026-11-22 t iku指示）。
 * 事例の本文・金額・画像は success-cases.ts が正。ここでは slug で引き当てるだけ。
 */
type SuccessCaseCard = { slug: string; label: string; raised: number; heading: string };
const SUCCESS_CASES: SuccessCaseCard[] = LP_SUCCESS.items.flatMap(({ slug, label }) => {
  const found = allSuccessCases().find(c => c.slug === slug);
  if (!found || !('heading' in found)) return [];
  return [{ slug, label, raised: found.raised, heading: found.heading }];
});

type SubmitState = 'idle' | 'submitting' | 'error' | 'done';

export default function TopLandingPage() {
  const formRef = useRef<HTMLElement | null>(null);
  const startedRef = useRef(false);
  const [showFollow, setShowFollow] = useState(false);
  const [category, setCategory] = useState<ConsultCategory>(CONSULT_CATEGORIES[0]);
  const [formEntrance] = useState<number>(1);
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

  /**
   * 相談CTAの計測（2026-11-22 t iku指示）。
   * 🔴 遷移先はすべてカレンダー予約（CONSULT_URL）なので、クリックを記録して
   *    そのままリンクを開かせる（preventDefault しない＝別タブで開く）。
   *    位置は置き場所ごとに分ける（fv / cases / support / trust / steps / follow / form）。
   */
  const trackCta = useCallback(
    (position: CtaPosition) => () => {
      track('cta_click', { position });
    },
    []
  );

  /** カードのクリック。①②③④すべてカード全体がクリック領域（§5.1） */
  const onCardClick = useCallback(
    (card: LpCard) => () => {
      track('cta_click', { entrance: card.id, position: 'hub' });
    },
    []
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
      // 予約前の質問窓口として使われたことを位置「form」で記録する
      track('cta_click', { position: 'form' });
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
        {/* ===== Z1 ファーストビュー =====
            2026-11-13 t iku指示: 元のKV画像（文字焼き込み済み）をそのまま使い、
            元の実装どおり下段の小さいコピーとCTAだけを重ねる。
            大見出しは画像内の文字なので、読み上げ・SEO用に sr-only の h1 を置く。 */}
        <section className="tlp-hero" aria-label="KAMOファンディング">
          <div className="tlp-hero-frame">
            {/* KVはLCP。寸法を明示してレイアウトシフトを防ぐ */}
            <img
              className="tlp-hero-img"
              src={LP_HERO.image}
              alt={LP_HERO.imageAlt}
              width={1759}
              height={988}
              fetchPriority="high"
            />
            <div className="tlp-hero-copy2">
              <p className="tlp-hero-eyebrow">{LP_HERO.eyebrow}</p>
              <h1 className="tlp-hero-h1">{LP_HERO.title}</h1>
              <p className="tlp-hero-h2">{LP_HERO.sub}</p>
              <p className="tlp-hero-body">{LP_HERO.description}</p>
              <div className="tlp-hero-ctas">
                <a
                  className="tlp-btn tlp-btn-primary tlp-hero-cta tlp-hero-cta-main"
                  href={LP_HERO.ctaHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={trackCta('fv')}
                >
                  {LP_HERO.cta}
                </a>
                {/* 2026-11-19 t iku指示: 説明会導線は赤バナーで目立たせる */}
                <a className="tlp-hero-redbanner" href={LP_HERO.subCtaHref}>
                  <span className="tlp-hero-redbanner-lead">{LP_HERO.subCtaLead}</span>
                  <span className="tlp-hero-redbanner-main">{LP_HERO.subCta}</span>
                  <span className="tlp-hero-redbanner-arrow" aria-hidden="true">
                    →
                  </span>
                </a>
              </div>
              <p className="tlp-hero-note">{LP_HERO.note}</p>
            </div>
          </div>
        </section>

        {/* ===== Z1.5 実績（2026-11-22 t iku指示: 構想より前に置く） =====
            2026-11-21 t iku指示: 3ページ共通の StatsBanner（コンパクトな横長） */}
        <section className="tlp-stats" aria-label="クラウドファンディング支援実績">
          <div className="tlp-inner">
            <StatsBanner className="tlp-stats-banner" />
          </div>
        </section>

        {/* ===== Z3.5 成功事例への案内（2026-11-22 t iku指示: 実績の直後に追加） ===== */}
        <section className="tlp-cases" aria-label="成功事例">
          <div className="tlp-inner">
            <h2 className="tlp-h2">{LP_SUCCESS.heading}</h2>
            <p className="tlp-cases-lead">{LP_SUCCESS.lead}</p>
            <div className="tlp-cases-grid">
              {SUCCESS_CASES.map(item => (
                <a className="tlp-case" href={`${LP_SUCCESS.href}#${item.slug}`} key={item.slug}>
                  <span className="tlp-case-media">
                    <img
                      className="tlp-case-img"
                      src={caseImage(item.slug)}
                      alt={`${item.heading}（プロジェクトのメイン画像）`}
                      width={CASE_IMAGE_WIDTH}
                      height={CASE_IMAGE_HEIGHT}
                      loading="lazy"
                    />
                  </span>
                  <span className="tlp-case-body">
                    <span className="tlp-case-label">{item.label}</span>
                    <span className="tlp-case-heading">{item.heading}</span>
                    <span className="tlp-case-raised">
                      <span className="tlp-case-raised-label">支援総額</span>
                      {formatManYen(item.raised)}
                    </span>
                  </span>
                </a>
              ))}
            </div>
            <div className="tlp-cases-cta">
              <div className="tlp-cases-cta-item">
                <a
                  className="tlp-btn tlp-btn-primary"
                  href={CONSULT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={trackCta('cases')}
                >
                  {LP_SUCCESS.consultCta}
                </a>
                <span className="tlp-cta-note">{LP_SUCCESS.consultNote}</span>
              </div>
              <div className="tlp-cases-cta-item">
                <a className="tlp-btn tlp-btn-outline" href={LP_SUCCESS.href}>
                  {LP_SUCCESS.cta}
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ===== Z3.6 支援内容・掲載までの流れ・費用（2026-11-22 t iku承認） =====
            手数料は利用規約 第4条と一致（総支援額の20%・税別・その他無料）。
            数値は src/lib/site-fees.ts が唯一の情報源。 */}
        <section className="tlp-support" aria-label={LP_SUPPORT.heading}>
          <div className="tlp-inner">
            <h2 className="tlp-h2">{LP_SUPPORT.heading}</h2>
            <p className="tlp-support-lead">{LP_SUPPORT.lead}</p>

            <div className="tlp-support-block">
              <h3 className="tlp-support-title">{LP_SUPPORT.servicesHeading}</h3>
              <div className="tlp-support-services">
                {LP_SUPPORT.services.map(service => (
                  <div className="tlp-support-service" key={service.title}>
                    <h4>{service.title}</h4>
                    <p>{service.body}</p>
                  </div>
                ))}
              </div>
              <p className="tlp-support-note">{LP_SUPPORT.servicesNote}</p>
            </div>

            <div className="tlp-support-block">
              <h3 className="tlp-support-title">{LP_SUPPORT.flowHeading}</h3>
              <ol className="tlp-support-flow">
                {LP_SUPPORT.flow.map((step, i) => (
                  <li className="tlp-support-step" key={step.title}>
                    <span className="tlp-support-step-no" aria-hidden="true">
                      {i + 1}
                    </span>
                    <h4>{step.title}</h4>
                    <p>{step.body}</p>
                  </li>
                ))}
              </ol>
              <p className="tlp-support-note">{LP_SUPPORT.flowNote}</p>
            </div>

            <div className="tlp-support-block">
              <h3 className="tlp-support-title">{LP_SUPPORT.feeHeading}</h3>
              <dl className="tlp-support-fees">
                {LP_SUPPORT.fees.map(fee => (
                  <div className="tlp-support-fee" key={fee.label}>
                    <dt>{fee.label}</dt>
                    <dd>
                      <span className="tlp-support-fee-value">{fee.value}</span>
                      <span className="tlp-support-fee-note">{fee.note}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* 2026-11-22 t iku指示: 費用の直後に置く唯一のCTA（セクションは増やさない） */}
            <div className="tlp-support-cta">
              <h3 className="tlp-support-cta-heading">{LP_SUPPORT.ctaHeading}</h3>
              <p className="tlp-support-cta-body">{LP_SUPPORT.ctaBody}</p>
              <div className="tlp-support-cta-buttons">
                <div className="tlp-support-cta-item">
                  <a
                    className="tlp-btn tlp-btn-primary tlp-btn-lg"
                    href={CONSULT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={trackCta('support')}
                  >
                    {LP_SUPPORT.ctaConsult}
                  </a>
                  <span className="tlp-cta-note">{LP_SUPPORT.ctaConsultNote}</span>
                </div>
                <div className="tlp-support-cta-item">
                  <a
                    className="tlp-btn tlp-btn-outline tlp-btn-lg"
                    href={LP_SUPPORT.ctaSeminarHref}
                    onClick={trackCta('seminar')}
                  >
                    {LP_SUPPORT.ctaSeminar}
                  </a>
                  <span className="tlp-cta-note">{LP_SUPPORT.ctaSeminarNote}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== Z3 分岐ハブ（4つの入り口） =====
            共感の見出しは4つの入り口の導入として、カードの直前に置く */}
        <section className="tlp-hub" id="hub">
          <div className="tlp-inner">
            <div className="tlp-hub-lead">
              <h2 className="tlp-h2">{LP_EMPATHY.heading}</h2>
              <p className="tlp-body">{LP_EMPATHY.body}</p>
              <p className="tlp-empathy-lead">{LP_EMPATHY.lead}</p>
            </div>
            <h2 className="tlp-sr-only">4つの入り口</h2>
            <div className="tlp-cards">
              {LP_CARDS.map((card) => (
                <a
                  key={card.id}
                  className={`tlp-card tlp-card-${card.id}`}
                  href={card.href}
                  onClick={onCardClick(card)}
                  // 外部サイト（④スタートアップEXPO）は別タブで開く
                  {...(card.href.startsWith('http')
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                  data-entrance={card.id}
                >
                  <span className="tlp-card-media">
                    <img
                      className="tlp-card-img"
                      src={card.image}
                      alt=""
                      width={card.id === 4 ? 1376 : 1672}
                      height={card.id === 4 ? 768 : 941}
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
                <div className="tlp-trust-value">{LP_TRUST.countLabel}</div>
                <div className="tlp-trust-label">{LP_TRUST.countNote}</div>
              </div>
              <div className="tlp-trust-item">
                <div className="tlp-trust-value">{LP_TRUST.raisedLabel}</div>
                <div className="tlp-trust-label">{LP_TRUST.raisedNote}</div>
              </div>
              <div className="tlp-trust-item">
                <div className="tlp-trust-value">{LP_TRUST.rateLabel}</div>
                <div className="tlp-trust-label">{LP_TRUST.rateNote}</div>
              </div>
            </div>
            <p className="tlp-trust-source">{LP_TRUST.source}</p>
          </div>
        </section>

        {/* ===== Z5 最終CTA ===== */}
        <section className="tlp-final">
          <div className="tlp-inner">
            <a
              className="tlp-btn tlp-btn-primary tlp-btn-lg"
              href={CONSULT_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={trackCta('trust')}
            >
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

        {/* ===== Z6 今後の構想（2026-11-22 t iku指示: 相談フォームより後ろへ移動） =====
            提供前の02・03には「今後の構想」を付け、現在相談できる内容と区別する。 */}
        <section className="tlp-steps" aria-label="クラファンから、その先の事業成長へ">
          <div className="tlp-inner">
            <h2 className="tlp-steps-title">{LP_STEPS.heading}</h2>
            <div className="tlp-steps-grid">
              {LP_STEPS.items.map((step) => (
                <div className={`tlp-step${step.future ? ' is-future' : ''}`} key={step.no}>
                  <span className="tlp-step-no" aria-hidden="true">
                    {step.no}
                  </span>
                  {step.future ? <span className="tlp-step-tag">{LP_STEPS.futureTag}</span> : null}
                  <h3 className="tlp-step-title">{step.title}</h3>
                  <p className="tlp-step-body">{step.body}</p>
                </div>
              ))}
            </div>
            <p className="tlp-steps-note">{LP_STEPS.note}</p>
            <div className="tlp-steps-cta">
              <a
                className="tlp-btn tlp-btn-primary tlp-btn-lg"
                href={CONSULT_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={trackCta('steps')}
              >
                {LP_STEPS.cta}
              </a>
            </div>
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
          <a
            className="tlp-follow-link"
            href={CONSULT_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackCta('follow')}
          >
            <span className="tlp-follow-pc">{LP_FOLLOW.pc}</span>
            <span className="tlp-follow-sp">{LP_FOLLOW.sp}</span>
          </a>
        </div>
      ) : null}
    </div>
  );
}
