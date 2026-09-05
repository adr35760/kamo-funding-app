'use client';

import { useState } from 'react';
import '@/styles/kamo-icons.css';
import '@/styles/partner-register.css';
import { REFERRAL_TERMS, REFERRAL_TERMS_TITLE, REFERRAL_TERMS_VERSION } from '@/lib/referral-terms';
import SiteHeader from '@/components/SiteHeader';
import LegalFooter from '@/components/LegalFooter';

const RELATIONSHIP_OPTIONS = ['知人・友人', '取引先', '親族', 'SNS経由', '同僚・仕事仲間', 'その他'];

export default function ReferralRegisterPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [relationship, setRelationship] = useState('');
  const [termsOpen, setTermsOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {};
    formData.forEach((v, k) => { data[k] = v as string; });

    // 「その他」選択時は自由入力を優先
    const other = (formData.get('relationship_other') as string || '').trim();
    data.relationship = relationship === 'その他' && other ? other : relationship;
    data.terms_agreed = formData.get('terms_agreed') === 'on';
    delete data.relationship_other;

    try {
      const res = await fetch('/api/apply-referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || '登録に失敗しました');
      }
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '登録に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SiteHeader current="/partners" />

      <section className="hero">
        <div className="container">
          <h1>紹介者の<span style={{ color: 'var(--kamo-gold)' }}>登録</span></h1>
          <p>紹介パートナーの方が、ご自身の紹介先を登録するフォームです。紹介コード経由で、あなたの紹介として自動的に紐付けられます。</p>
        </div>
      </section>

      <section className="form-section">
        <div className="container">
          {submitted ? (
            <div className="form-card" style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 900, marginBottom: '12px' }}>紹介者の登録が完了しました</h2>
              <p style={{ color: 'var(--kamo-gray)' }}>
                ご登録のメールアドレス宛に、確認メールと<strong>紹介料規約の全文</strong>をお送りしました。<br />
                掲載完了・募集終了時点で紹介料（対象額の2%）が確定し、明細を発行のうえ終了月の翌々月末にお支払いします。
              </p>
              <p style={{ marginTop: '20px' }}>
                <a href="/partners" style={{ color: 'var(--kamo-red)', fontWeight: 700 }}>← パートナーページに戻る</a>
              </p>
            </div>
          ) : (
            <div className="form-card">
              <h2 style={{ fontSize: '20px', fontWeight: 900, marginBottom: '20px' }}>紹介者登録フォーム</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>紹介コード <span className="required">必須</span></label>
                  <input type="text" name="referral_code" required placeholder="例: KAMO-XXXXXX" style={{ textTransform: 'uppercase' }} />
                  <p style={{ fontSize: '13px', color: 'var(--kamo-gray)', marginTop: '4px' }}>
                    パートナー登録時にお送りした、あなた専用の紹介コードをご入力ください。
                  </p>
                </div>

                <div className="form-group">
                  <label>紹介者の氏名 <span className="required">必須</span></label>
                  <input type="text" name="referred_name" required placeholder="例: 鴨頭 太郎" />
                </div>

                <div className="form-group">
                  <label>ご関係 <span className="required">必須</span></label>
                  <select name="relationship_select" required value={relationship} onChange={(e) => setRelationship(e.target.value)}>
                    <option value="">選択してください</option>
                    {RELATIONSHIP_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  {relationship === 'その他' && (
                    <input type="text" name="relationship_other" required placeholder="ご関係をご入力ください" style={{ marginTop: '8px' }} />
                  )}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>紹介者の会社・団体名（任意）</label>
                    <input type="text" name="referred_company" placeholder="例: 株式会社カモ" />
                  </div>
                  <div className="form-group">
                    <label>紹介者のメールアドレス（任意）</label>
                    <input type="email" name="referred_email" placeholder="example@email.com" />
                  </div>
                </div>

                <div className="form-group">
                  <label>備考（任意）</label>
                  <textarea name="notes" placeholder="紹介の背景や、共有しておきたいことがあればご記入ください"></textarea>
                </div>

                {/* 紹介料規約 */}
                <div style={{ margin: '24px 0', border: '1px solid var(--kamo-border)', borderRadius: '8px', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setTermsOpen(!termsOpen)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '14px 16px', background: '#0B1D3A',
                      color: '#fff', border: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: 700,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                  >
                    <span>{REFERRAL_TERMS_TITLE}（version {REFERRAL_TERMS_VERSION}）</span>
                    <span style={{ color: 'var(--kamo-gold)' }}>{termsOpen ? '閉じる ▲' : '全文を読む ▼'}</span>
                  </button>
                  {termsOpen && (
                    <div style={{ padding: '16px', maxHeight: '320px', overflowY: 'auto', background: '#fff' }}>
                      {REFERRAL_TERMS.map((a) => (
                        <div key={a.heading} style={{ marginBottom: '14px' }}>
                          <p style={{ fontWeight: 700, fontSize: '14px', color: '#0B1D3A', marginBottom: '4px' }}>{a.heading}</p>
                          <ol style={{ paddingLeft: '18px', fontSize: '13px', color: '#444', lineHeight: 1.8 }}>
                            {a.body.map((b, i) => (
                              <li key={i}>
                                {typeof b === 'string' ? b : (
                                  <>
                                    {b.text}
                                    <ol style={{ margin: '4px 0 0', paddingLeft: '18px', listStyle: 'none' }}>
                                      {b.items.map((it, j) => <li key={j}>（{j + 1}）{it}</li>)}
                                    </ol>
                                  </>
                                )}
                              </li>
                            ))}
                          </ol>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontWeight: 400 }}>
                    <input type="checkbox" name="terms_agreed" required style={{ width: 'auto', marginTop: '4px', flexShrink: 0 }} />
                    <span>
                      <strong>紹介料規約に同意します</strong> <span className="required">必須</span><br />
                      <span style={{ fontSize: '13px', color: 'var(--kamo-gray)' }}>
                        紹介料は対象額（総支援金額から手数料・手数料に係る消費税を控除した額）の2%、募集終了時に確定・明細発行、終了月の翌々月末にお支払いします。
                      </span>
                    </span>
                  </label>
                </div>

                {error && <p style={{ color: 'var(--kamo-red)', marginBottom: '12px', fontWeight: 700 }}>{error}</p>}

                <button type="submit" className="form-submit" disabled={submitting}>
                  {submitting ? '送信中...' : '紹介者を登録する →'}
                </button>
                <p style={{ fontSize: '13px', color: 'var(--kamo-gray)', marginTop: '12px', textAlign: 'center' }}>
                  ご登録の確認メールに、紹介料規約の全文をお送りします。
                </p>
              </form>
            </div>
          )}
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <p>&copy; 2026 KAMO FUNDING</p>
          <LegalFooter />
        </div>
      </footer>
    </>
  );
}
