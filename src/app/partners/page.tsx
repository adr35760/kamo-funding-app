'use client';

import { useState } from 'react';
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
    try {
      const res = await fetch('/api/register-partner', { method: 'POST', body: formData });
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
      <div className="header">
        <div className="header-inner">
          <a href="/"><img src="/kamo-logo-main.jpg" alt="KAMOファンディング" style={{height:'32px',width:'auto'}} /></a>
        </div>
      </div>

      <section className="hero">
        <div className="container">
          <div className="hero-badge"><span className="kamo-icon kamo-icon-pin sm" style={{marginRight:'4px'}}></span> 参入ハードル：最も低い・登録無料</div>
          <h1><span className="green">紹介するだけ</span>で<br />月数万円の副収入</h1>
          <p>KAMOファンディングの紹介パートナー。ネットワークを活かして、クラファン掲載候補を紹介するだけ。登録は無料・即日発行。</p>
          <p style={{ color: '#E60012', fontWeight: '700', fontSize: '15px', marginTop: '12px' }}>※説明会参加必須（紹介報酬規程の承諾が必要）</p>
        </div>
      </section>

      <section className="benefits">
        <div className="container">
          <div className="benefits-grid">
            <div className="benefit-card"><h4><span className="kamo-icon kamo-icon-pen sm" style={{marginRight:'6px'}}></span>登録だけ・無料</h4><p>オンラインフォームに登録するだけ。即日で紹介コードが発行されます。<br />※紹介報酬規定にチェック必要</p></div>
            <div className="benefit-card"><h4><span className="kamo-icon kamo-icon-yen sm" style={{marginRight:'6px'}}></span>紹介料：総支援金額の約2%</h4><p>紹介した案件のプロジェクト支援金、対象金額の2%が報酬。例：¥1,000,000→¥20,000、¥10,000,000→¥200,000<br />※支援総額ー手数料＋税金＝対象金額</p></div>
            <div className="benefit-card"><h4><span className="kamo-icon kamo-icon-handshake sm" style={{marginRight:'6px'}}></span>新しいスキル不要</h4><p>あなたのネットワークを活かすだけ。クラファンの専門知識は必要ありません。</p></div>
            <div className="benefit-card"><h4><span className="kamo-icon kamo-icon-flame sm" style={{marginRight:'6px'}}></span>KAMOブランド力</h4><p>鴨頭義人さん・嘉人さんのブランド力で紹介しやすい。企業からの感謝も得られる。</p></div>
          </div>
        </div>
      </section>

      <section className="steps">
        <div className="container">
          <h2 style={{textAlign:'center',fontSize:'24px',fontWeight:900,marginBottom:'32px'}}>紹介パートナーの<span style={{color:'#27AE60'}}>フロー</span></h2>
          <div className="steps-list">
            <div className="step-item"><div className="step-num">1</div><div className="step-content"><h3>登録（オンラインフォーム・無料）</h3><p>以下のフォームに登録情報を入力。即日に紹介コードが発行されます。</p></div></div>
            <div className="step-item"><div className="step-num">2</div><div className="step-content"><h3>紹介コード発行</h3><p>パートナー固有の紹介コードが発行されます。このコード経由の掲載が自動的にあなたの紹介として紐付きます。</p></div></div>
            <div className="step-item"><div className="step-num">3</div><div className="step-content"><h3>紹介実績トラッキング</h3><p>紹介コード経由の掲載をシステムが自動追跡。あなたの管理画面で実績をいつでも確認できます。</p></div></div>
            <div className="step-item"><div className="step-num">4</div><div className="step-content"><h3>報酬受け取り</h3><p>紹介した企業のクラファン掲載が完了した時点で、総支援金額（税抜）の2%が報酬として確定します。</p></div></div>
          </div>
        </div>
      </section>

      <section className="form-section">
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

      <div className="footer">&copy; 2026 KAMO FUNDING. All rights reserved.</div>
    </>
  );
}
