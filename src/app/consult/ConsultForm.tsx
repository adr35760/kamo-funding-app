'use client';

import { useState } from 'react';
import '@/styles/supporter-register.css';
import '@/styles/listing-apply.css';
import '@/styles/consult.css';
import SiteHeader from '@/components/SiteHeader';
import LegalFooter from '@/components/LegalFooter';
import {
  CONSULT_CALENDAR_URL,
  CONSULT_MINUTES,
} from '@/lib/seminar-info-content';
import { trackMetaEvent } from '@/lib/meta-pixel';
import {
  CONSULT_AGE_MAX,
  CONSULT_AGE_MIN,
  CONSULT_AMOUNT_MAX,
  CONSULT_GENDERS,
  CONSULT_IDEA_MAX,
  CONSULT_PAID_STATUS,
  CONSULT_STATUSES,
  validateConsultBooking,
} from '@/lib/consult-booking-shared';

/**
 * 事業資金づくり診断の予約前アンケート。
 *
 * 🔴 このフォームを送信するまで、予約カレンダーのURLは画面に出さない
 *    （2026-11-24 t iku指示: アンケート未入力では予約できないようにする）。
 *    カレンダーURLは送信中・送信後の状態でのみ表示する。
 *
 * 🔴 検証は共有モジュール（validateConsultBooking）を使う。
 *    サーバー（/api/consult-booking）も同じ関数で検証している。
 */
export default function ConsultForm() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [ideaLength, setIdeaLength] = useState(0);
  /** 現在の状況（ラジオの選択状態で枠色を変えるため値を持つ） */
  const [status, setStatus] = useState('');
  /** 送信時の状況。実施中は予約カレンダーを出さない（無料診断の対象外） */
  const [submittedStatus, setSubmittedStatus] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? '').trim();
    const payload = {
      name: get('name'),
      gender: get('gender'),
      status: get('status'),
      age: get('age'),
      email: get('email'),
      idea: get('idea'),
      amount: get('amount'),
      agree: fd.get('agree') === 'on',
      source: 'consult',
    };

    const checked = validateConsultBooking(payload);
    if (!checked.ok) {
      setErrors(checked.errors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);
    setErrors([]);
    try {
      const res = await fetch('/api/consult-booking', {
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
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      setSubmittedStatus(payload.status);
      setSubmitted(true);
      /**
       * 🔴 Metaピクセルの Lead（2026-11-26 t iku指示）。
       *    - 送信成功（res.ok かつ data.ok）の後、完了表示に切り替えた直後に1回だけ撃つ
       *    - ボタンクリック時・入力エラー・通信エラー・res.ok でない場合は撃たない
       *    - 「実施中（有償）」は完了画面にカレンダーを出さない分岐だが、
       *      送信自体は完了している＝リードとして数える（両分岐とも1回）
       *    - 同一ページ内の完了表示なので遷移先は無い
       */
      trackMetaEvent('Lead');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setErrors(['通信エラーで送信できませんでした。電波の良い場所でもう一度お試しください']);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="listing-apply consult-page">
      <SiteHeader cta={submitted ? undefined : { href: '#apply', label: '入力へ進む' }} />

      <section className="hero">
        <div className="container">
          <div className="hero-badge">クラファン事業資金づくり診断（無料{CONSULT_MINUTES}分）</div>
          <h1>
            事業資金づくり診断の<span className="gold">お申し込み</span>
          </h1>
          <p>
            ご予約の前に、以下の項目にお答えください。
            <br />
            送信後、無料診断の対象の方は予約カレンダーから日時をお選びいただけます。
          </p>
        </div>
      </section>

      <section className="form-section" id="apply">
        <div className="container">
          <div className="form-card">
            {submitted ? (
              <div className="success-state">
                <div className="check"></div>
                <h3>お申し込みを受け付けました</h3>
                {submittedStatus === CONSULT_PAID_STATUS ? (
                  <>
                    <p>
                      ありがとうございます。実施中の方は有償のご相談となるため、
                      <br />
                      無料診断の予約カレンダーはご案内しておりません。
                    </p>
                    <p>
                      担当者より、ご相談の内容と費用をご連絡します。
                      <br />
                      同じご案内を、ご入力のメールアドレスにもお送りしました。
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      ありがとうございます。つづいて、ご希望の日時をお選びください。
                      <br />
                      同じご案内を、ご入力のメールアドレスにもお送りしました。
                    </p>
                    <p className="consult-calendar-wrap">
                      <a
                        className="consult-calendar-btn"
                        href={CONSULT_CALENDAR_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        予約カレンダーを開く →
                      </a>
                    </p>
                    <p className="consult-calendar-note">
                      カレンダーが開かない場合は
                      <a href={CONSULT_CALENDAR_URL} target="_blank" rel="noopener noreferrer">
                        こちらのリンク
                      </a>
                      からお進みください。
                    </p>
                  </>
                )}
              </div>
            ) : (
              <>
                <h2>
                  予約前の<span className="gold">アンケート</span>
                </h2>
                <p className="consult-notice">
                  無料診断はこれから挑戦したい方のみです！
                  <br />
                  「実施中の方は有償です」
                </p>
                <p className="form-sub">
                  すべて必須項目です。所要時間は約2分です。
                </p>

                {errors.length > 0 && (
                  <div className="apply-error" role="alert">
                    {errors.map((msg) => (
                      <p key={msg}>{msg}</p>
                    ))}
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  <div className="form-group">
                    <label htmlFor="consult-name">
                      氏名 <span className="required">必須</span>
                    </label>
                    <input
                      id="consult-name"
                      type="text"
                      name="name"
                      required
                      maxLength={100}
                      autoComplete="name"
                      placeholder="山田 太郎"
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="consult-gender">
                        性別 <span className="required">必須</span>
                      </label>
                      <select id="consult-gender" name="gender" required defaultValue="">
                        <option value="" disabled>
                          選択してください
                        </option>
                        {CONSULT_GENDERS.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="consult-age">
                        年齢 <span className="required">必須</span>
                      </label>
                      <input
                        id="consult-age"
                        type="number"
                        name="age"
                        required
                        min={CONSULT_AGE_MIN}
                        max={CONSULT_AGE_MAX}
                        inputMode="numeric"
                        placeholder="40"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="consult-email">
                      メールアドレス <span className="required">必須</span>
                    </label>
                    <input
                      id="consult-email"
                      type="email"
                      name="email"
                      required
                      maxLength={254}
                      autoComplete="email"
                      placeholder="example@email.com"
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      現在の状況 <span className="required">必須</span>
                    </label>
                    <div className="apply-radios">
                      {CONSULT_STATUSES.map((v) => (
                        <label key={v} className={`apply-radio${status === v ? ' is-checked' : ''}`}>
                          <input
                            type="radio"
                            name="status"
                            value={v}
                            required
                            checked={status === v}
                            onChange={() => setStatus(v)}
                          />
                          {v}
                        </label>
                      ))}
                    </div>
                    {status === CONSULT_PAID_STATUS && (
                      <p className="consult-status-note">
                        実施中の方は、担当者より有償のご相談をご案内します（無料診断の対象外です）。
                      </p>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="consult-idea">
                      今考えているアイディアや企画 <span className="required">必須</span>
                    </label>
                    <textarea
                      id="consult-idea"
                      name="idea"
                      required
                      maxLength={CONSULT_IDEA_MAX}
                      rows={7}
                      placeholder="例：地域の食材を使ったお弁当屋を開きたい。店舗の初期費用と厨房設備に資金が必要です。"
                      onChange={(e) => setIdeaLength(e.target.value.length)}
                    ></textarea>
                    <p className="apply-count-line">
                      {ideaLength}/{CONSULT_IDEA_MAX}文字
                    </p>
                  </div>

                  <div className="form-group">
                    <label htmlFor="consult-amount">
                      集めたい希望金額は？ <span className="required">必須</span>
                    </label>
                    <input
                      id="consult-amount"
                      type="text"
                      name="amount"
                      required
                      maxLength={CONSULT_AMOUNT_MAX}
                      placeholder="例：100万円（未定の場合は「未定」とご記入ください）"
                    />
                  </div>

                  <label className="apply-agree">
                    <input type="checkbox" name="agree" required />
                    <span>
                      <a href="/privacy" target="_blank" rel="noopener noreferrer">
                        プライバシーポリシー
                      </a>
                      に同意します
                    </span>
                  </label>

                  <button type="submit" className="form-submit" disabled={submitting}>
                    {submitting ? '送信中…' : 'この内容で送信し、予約へ進む'}
                  </button>
                  <p className="form-note">
                    送信後、このページと確認メールに予約カレンダーのご案内を表示します。
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
