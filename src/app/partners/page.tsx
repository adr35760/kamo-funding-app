'use client';

import { useState } from 'react';
import SiteHeader from '@/components/SiteHeader';
import '@/styles/kamo-icons.css';
import '@/styles/partner-register.css';

export default function PartnerRegisterPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    formData.forEach((v, k) => { data[k] = v as string; });
    try {
      const res = await fetch('/api/register-partner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '登録に失敗しました');
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
          <div className="hero-badge"><span className="kamo-icon kamo-icon-pin sm" style={{marginRight:'4px'}}></span> 参入ハードル：最も低い・登録無料</div>
          <h1><span className="green">紹介するだけ</span>で<br />月数万円の副収入</h1>
          <p>KAMOファンディングの紹介パートナー。ネットワークを活かして、クラファン掲載候補を紹介するだけ。登録は無料・即日発行。</p>
          <p style={{ color: '#E60012', fontWeight: '700', fontSize: '15px', marginTop: '12px' }}>※説明会参加必須（紹介報酬規程の承諾が必要）</p>
          <div className="hero-cta-row">
            <a href="#register" className="hero-cta-main">無料で登録する →</a>
            <a href="#reward" className="hero-cta-sub">紹介料のしくみを見る</a>
          </div>
        </div>
      </section>

      <section className="benefits">
        <div className="container">
          <div className="benefits-grid">
            <div className="benefit-card"><h4><span className="kamo-icon kamo-icon-pen sm" style={{marginRight:'6px'}}></span>登録だけ・無料</h4><p>オンラインフォームに登録するだけ。即日で紹介コードが発行されます。<br />※紹介報酬規定にチェック必要</p></div>
            <div className="benefit-card" id="reward"><h4><span className="kamo-icon kamo-icon-yen sm" style={{marginRight:'6px'}}></span>紹介料：対象額の2%</h4><p>対象額＝総支援金額ー手数料ー手数料に係る消費税。その2%が報酬です。</p>
              <div className="reward-examples">
                <div className="reward-example">
                  <div className="reward-raised"><span className="reward-label">総支援金額</span><span className="reward-amount">¥1,000,000</span></div>
                  <div className="reward-arrow">→</div>
                  <div className="reward-fee"><span className="reward-label">紹介料</span><span className="reward-amount is-fee">約¥15,600</span></div>
                </div>
                <div className="reward-example">
                  <div className="reward-raised"><span className="reward-label">総支援金額</span><span className="reward-amount">¥10,000,000</span></div>
                  <div className="reward-arrow">→</div>
                  <div className="reward-fee"><span className="reward-label">紹介料</span><span className="reward-amount is-fee">約¥156,000</span></div>
                </div>
              </div>
              <details className="reward-detail"><summary>計算方法と注意事項</summary>
                <p className="reward-notes">計算例：総支援金額¥1,000,000→対象額¥780,000→紹介料約¥15,600／¥10,000,000→¥7,800,000→約¥156,000<br />※手数料20%・消費税10%で試算した参考値です<br />※募集終了時に明細を発行し、終了月の翌々月末に指定口座へお支払い</p>
              </details>
            </div>
            <div className="benefit-card"><h4><span className="kamo-icon kamo-icon-handshake sm" style={{marginRight:'6px'}}></span>新しいスキル不要</h4><p>あなたのネットワークを活かすだけ。クラファンの専門知識は必要ありません。</p></div>
            <div className="benefit-card"><h4><span className="kamo-icon kamo-icon-flame sm" style={{marginRight:'6px'}}></span>KAMOブランド力</h4><p>鴨頭義人さん・嘉人さんのブランド力で紹介しやすい。企業からの感謝も得られる。</p></div>
          </div>
        </div>
      </section>

      <section className="steps">
        <div className="container">
          <h2 style={{textAlign:'center',fontSize:'24px',fontWeight:900,marginBottom:'32px'}}>紹介パートナーの<span style={{color:'#27AE60'}}>フロー</span></h2>
          <div className="steps-list">
            <div className="step-item"><div className="step-num">1</div><div className="step-content"><h3>登録（無料）</h3><p>フォームに入力するだけ。即日で紹介コードが届きます。</p></div></div>
            <div className="step-item"><div className="step-num">2</div><div className="step-content"><h3>紹介コード発行</h3><p>あなた専用のコードを発行します。</p>
              <details className="step-more"><summary>くわしく</summary><p>パートナー固有の紹介コードが発行されます。このコード経由の掲載が自動的にあなたの紹介として紐付きます。</p></details></div></div>
            <div className="step-item"><div className="step-num">3</div><div className="step-content"><h3>掲載説明会へ紹介</h3><p>メールで届いたリンクを紹介先へ送るだけです。</p></div></div>
            <div className="step-item"><div className="step-num">4</div><div className="step-content"><h3>実績トラッキング</h3><p>コード経由の掲載はシステムが自動で追跡します。</p>
              <details className="step-more"><summary>くわしく</summary><p>紹介コード経由の掲載をシステムが自動追跡。紹介者が実施した場合、リマインドメールが届きます。</p></details></div></div>
            <div className="step-item"><div className="step-num">5</div><div className="step-content"><h3>報酬確定</h3><p>募集終了の時点で対象額の2%が確定し、明細をお送りします。</p>
              <details className="step-more"><summary>くわしく</summary><p>紹介した企業のクラファン掲載が完了し、募集終了した時点で、対象額（総支援金額から手数料・手数料に係る消費税を控除した額）の2%が報酬として確定します。その時点で、登録メールアドレスまでに明細を発行。</p></details></div></div>
            <div className="step-item"><div className="step-num">6</div><div className="step-content"><h3>紹介料のお支払い</h3><p>終了月の翌々月末に、指定口座へ入金します。</p></div></div>
          </div>
          <div style={{ marginTop: '32px', padding: '24px', background: '#0B1D3A', borderRadius: '12px', textAlign: 'center' }}>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: '16px', marginBottom: '6px' }}>
              すでに紹介パートナーとして登録済みの方へ
            </p>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '14px', marginBottom: '16px' }}>
              紹介コードをお持ちの方は、こちらから紹介者を登録できます。
            </p>
            <a href="/partners/referral" style={{ display: 'inline-block', background: 'var(--kamo-gold)', color: '#0B1D3A', padding: '14px 28px', borderRadius: '8px', fontWeight: 700, fontSize: '15px' }}>
              紹介者を登録する →
            </a>
          </div>
        </div>
      </section>

      <section className="form-section" id="register">
        <div className="container">
          <div className="form-card">
            <h2>紹介<span className="green">パートナー登録</span></h2>
            <p className="form-sub">登録は無料・即日発行。以下の情報をご入力ください。</p>
            {submitted ? (
              <div style={{textAlign:'center',padding:'48px 24px'}}>
                <div className="kamo-icon kamo-icon-check-lg" style={{width:'48px',height:'48px',marginBottom:'16px'}}></div>
                <h3 style={{fontSize:'24px',fontWeight:900,marginBottom:'8px'}}>登録完了！</h3>
                <p style={{color:'#666',fontSize:'15px'}}>紹介コードをメールで送信しました。ご確認ください。</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group"><label>お名前 <span className="required">必須</span></label><input type="text" name="name" required placeholder="鴨頭 太郎" /></div>
                  <div className="form-group"><label>メールアドレス <span className="required">必須</span></label><input type="email" name="email" required placeholder="example@email.com" /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>電話番号</label><input type="tel" name="phone" placeholder="090-1234-5678" /></div>
                  <div className="form-group"><label>会社名・団体名</label><input type="text" name="company" placeholder="株式会社〇〇" /></div>
                </div>
                <div className="form-group"><label>紹介可能な業界・ネットワーク（任意）</label><textarea name="network" placeholder="例：商工会議所メンバー、飲食業界の経営者ネットワーク、地域の起業家コミュニティ等"></textarea></div>
                <div className="form-group">
                  <label>紹介経路で知ったきっかけ</label>
                  <select name="source">
                    <option value="">選択してください</option>
                    <option value="session">パートナーシップ説明会</option>
                    <option value="youtube">YouTube（クラファンの学校）</option>
                    <option value="sns">SNS</option>
                    <option value="referral">知人の紹介</option>
                    <option value="other">その他</option>
                  </select>
                </div>
                {error && <p style={{color:'#E60012',fontSize:'14px',marginBottom:'12px'}}>{error}</p>}
                <button type="submit" className="form-submit" disabled={submitting} style={submitting ? {opacity:0.7} : {}}>
                  {submitting ? '登録中...' : '登録する →'}
                </button>
                <p className="form-note">※ 登録後に確認メールと紹介コードが自動送信されます<br />※ 個人情報はパートナーシップ運営目的のみに使用します</p>
              </form>
            )}
          </div>
        </div>
      </section>

      {!submitted && (
        <div className="sticky-cta">
          <div className="sticky-cta-inner">
            <span className="sticky-cta-text">登録は無料・即日発行</span>
            <a href="#register" className="sticky-cta-btn">無料で登録する →</a>
          </div>
        </div>
      )}

      <div className="footer">&copy; 2026 KAMO FUNDING. All rights reserved.</div>
    </>
  );
}
