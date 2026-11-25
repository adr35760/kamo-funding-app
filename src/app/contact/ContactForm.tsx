'use client';

import { useState } from 'react';
import '@/styles/supporter-register.css';
import '@/styles/listing-apply.css';
import '@/styles/contact.css';
import SiteHeader from '@/components/SiteHeader';
import LegalFooter from '@/components/LegalFooter';
import {
  CONTACT_KINDS,
  CONTACT_MESSAGE_MAX,
  CONTACT_PRESS_KIND,
  validateContact,
} from '@/lib/contact-shared';

/**
 * 質問・問い合わせ・取材依頼のフォーム。
 *
 * 🔴 検証は共有モジュール（validateContact）を使う。
 *    サーバー（/api/contact）も同じ関数で検証している。
 * 🔴 取材依頼を選んだときだけ、書いてほしい項目を補足で出す
 *    （必須にはしない。取材の依頼は相手の都合で項目が変わるため）。
 */
export default function ContactForm() {
  const [kind, setKind] = useState('');
  const [messageLength, setMessageLength] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? '').trim();
    const payload = {
      kind: get('kind'),
      name: get('name'),
      organization: get('organization'),
      email: get('email'),
      phone: get('phone'),
      message: get('message'),
      agree: fd.get('agree') === 'on',
    };

    const checked = validateContact(payload);
    if (!checked.ok) {
      setErrors(checked.errors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);
    setErrors([]);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        errors?: string[];
        confirmationSent?: boolean;
      };
      if (!res.ok || !data.ok) {
        setErrors(
          data.errors && data.errors.length > 0
            ? data.errors
            : ['送信に失敗しました。時間をおいてもう一度お試しください']
        );
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      setConfirmationSent(data.confirmationSent !== false);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setErrors(['通信エラーで送信できませんでした。電波の良い場所でもう一度お試しください']);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="contact-page">
      <SiteHeader current="/contact" />

      <section className="hero">
        <div className="container">
          <div className="hero-badge">お問い合わせ</div>
          <h1>
            質問・問い合わせ・<span className="gold">取材依頼</span>
          </h1>
          <p>
            ご質問、掲載・支援のご相談、取材・メディア掲載のご依頼は、
            <br />
            こちらのフォームからお送りください。
          </p>
        </div>
      </section>

      <section className="form-section" id="contact">
        <div className="container">
          <div className="form-card">
            {submitted ? (
              <div className="success-state">
                <div className="check"></div>
                <h3>お問い合わせを受け付けました</h3>
                <p>
                  内容を確認のうえ、原則として2営業日以内にご返信します。
                  {confirmationSent ? (
                    <>
                      <br />
                      同じ内容を、ご入力のメールアドレスにもお送りしました。
                    </>
                  ) : (
                    <>
                      <br />
                      控えメールをお送りできなかったため、受付の控えは残っていません。
                      お急ぎの場合は info@local-creation.com へ直接ご連絡ください。
                    </>
                  )}
                </p>
                <p className="contact-back">
                  <a href="/">トップページへ戻る</a>
                </p>
              </div>
            ) : (
              <>
                <h2>
                  お問い合わせ<span className="gold">フォーム</span>
                </h2>
                <p className="form-sub">
                  返信は原則として2営業日以内（土日祝を除く）です。
                  <br />
                  お急ぎの場合は info@local-creation.com へ直接ご連絡ください。
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
                    <label>
                      お問い合わせの種類 <span className="required">必須</span>
                    </label>
                    <div className="apply-radios is-contact-kinds">
                      {CONTACT_KINDS.map((v) => (
                        <label key={v} className={`apply-radio${kind === v ? ' is-checked' : ''}`}>
                          <input
                            type="radio"
                            name="kind"
                            value={v}
                            required
                            checked={kind === v}
                            onChange={() => setKind(v)}
                          />
                          {v}
                        </label>
                      ))}
                    </div>
                    {kind === CONTACT_PRESS_KIND && (
                      <p className="contact-kind-note">
                        媒体名・企画の概要・掲載予定日・取材をご希望の内容を「お問い合わせ内容」にご記入ください。
                        会社名・媒体名の欄もあわせてご利用ください。
                      </p>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="contact-name">
                      お名前 <span className="required">必須</span>
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      name="name"
                      required
                      maxLength={100}
                      autoComplete="name"
                      placeholder="山田 太郎"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="contact-organization">会社名・媒体名（任意）</label>
                    <input
                      id="contact-organization"
                      type="text"
                      name="organization"
                      maxLength={120}
                      autoComplete="organization"
                      placeholder="株式会社〇〇／〇〇編集部"
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="contact-email">
                        メールアドレス <span className="required">必須</span>
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        name="email"
                        required
                        maxLength={254}
                        autoComplete="email"
                        placeholder="example@email.com"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="contact-phone">電話番号（任意）</label>
                      <input
                        id="contact-phone"
                        type="tel"
                        name="phone"
                        maxLength={30}
                        autoComplete="tel"
                        placeholder="090-1234-5678"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="contact-message">
                      お問い合わせ内容 <span className="required">必須</span>
                    </label>
                    <textarea
                      id="contact-message"
                      name="message"
                      required
                      maxLength={CONTACT_MESSAGE_MAX}
                      rows={8}
                      placeholder="ご質問・ご相談の内容をご記入ください。"
                      onChange={(e) => setMessageLength(e.target.value.length)}
                    ></textarea>
                    <p className="apply-count-line">
                      {messageLength}/{CONTACT_MESSAGE_MAX}文字
                    </p>
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
                    {submitting ? '送信中…' : 'この内容で送信する'}
                  </button>
                  <p className="form-note">
                    送信後、受付の控えをメールでお送りします。
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      <footer className="footer">
        &copy; 2026 KAMO FUNDING. 共犯者を集め、夢を叶える場所。
        <LegalFooter />
      </footer>
    </div>
  );
}
