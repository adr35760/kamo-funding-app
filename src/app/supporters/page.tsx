'use client';

import { useState } from 'react';
import '@/styles/supporter-register.css';

export default function SupporterRegisterPage() {
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
      const res = await fetch('/api/register-supporter', {
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
      <div className="header">
        <div className="header-inner">
          <a href="/"><img src="/kamo-logo-main.jpg" alt="KAMOファンディング" style={{height:'32px',width:'auto'}} /></a>
        </div>
      </div>

      <section className="hero">
        <div className="container">
          <div className="hero-badge">説明会参加必須です！参加日程をチェック！</div>
          <h1>KAMOファンディングの<span className="gold">お仕事サポート</span>で<br />成果報酬を受け取ろう</h1>
          <p>クラファン掲載プロジェクトの成功を支えるプロジェクトサポーター。あなたのスキルで挑戦者をサポートし、成果報酬を受け取ろう。</p>
        </div>
      </section>

      <section className="roles">
        <div className="container">
          <div className="roles-title"><h2>プロジェクトサポーターの<span className="gold">4つの役割</span></h2></div>
          <div className="roles-grid">
            <div className="role-card">
              <div className="role-num">1</div>
              <h4>事務局サポート</h4>
              <p>サムネ作成、リターン申請チェック、支援者さんとの連絡など</p>
            </div>
            <div className="role-card">
              <div className="role-num">2</div>
              <h4>SNS・ライブ配信サポート</h4>
              <p>投稿やライブ配信をサポート</p>
            </div>
            <div className="role-card">
              <div className="role-num">3</div>
              <h4>KAMOファンパートナー</h4>
              <p>クラファンサイト裏側の作業パートナー</p>
            </div>
            <div className="role-card">
              <div className="role-num">4</div>
              <h4>イベントサポーター</h4>
              <p>当日の会場手配・受付・案内誘導など</p>
            </div>
          </div>
        </div>
      </section>

      <section className="merits">
        <div className="container">
          <div className="merits-title"><h2>プロジェクトサポーターの<span className="gold">メリット</span></h2></div>
          <div className="merits-list">
            <div className="merit-item"><div className="merit-icon">🤝</div><div><h4>KAMOファンディングの「サポーターコミュニティ」に参加</h4><p>同じ夢を応援する仲間とのつながりが生まれます。</p></div></div>
            <div className="merit-item"><div className="merit-icon">📛</div><div><h4>サポーターページに、専門家として名前掲載</h4><p>KAMOファンディング特設ページにあなたの名前が載ります。</p></div></div>
            <div className="merit-item"><div className="merit-icon">📅</div><div><h4>鴨頭嘉人さんオンラインおよびリアル交流会に参加できます</h4><p>サポーター限定の交流会に参加可能。鴨頭嘉人さんと直接交流。</p></div></div>
            <div className="merit-item"><div className="merit-icon">🎁</div><div><h4>次回クラファン掲載時のPR支援を受ける権利</h4><p>サポーター実績に応じて、あなたがクラファンをする時に支援を受けられます。</p></div></div>
            <div className="merit-item"><div className="merit-icon">💰</div><div><h4>支援額に応じた成果報酬</h4><p>PR・集客の貢献度に応じて報酬が発生します。</p></div></div>
          </div>
        </div>
      </section>

      <section className="form-section">
        <div className="container">
          <div className="form-card">
            <h2>サポーター<span className="gold">登録</span></h2>
            <p className="form-sub">説明会参加後に登録ください。以下の情報をご入力ください。</p>
            {submitted ? (
              <div className="success-state">
                <div className="check"></div>
                <h3>登録完了！</h3>
                <p>ウェルカムメールを送信しました。ご確認ください。</p>
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
                <div className="form-group">
                  <label>得意な支援方法 <span className="required">必須</span></label>
                  <select name="support_type" required>
                    <option value="">選択してください</option>
                    <option value="office">事務局サポート</option>
                    <option value="sns">SNS・ライブ配信サポート</option>
                    <option value="partner">KAMOファンパートナー</option>
                    <option value="event">イベントサポーター</option>
                    <option value="all">すべてできる</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>参加した説明会 <span className="required">必須</span></label>
                  <select name="session_attended" required>
                    <option value="">選択してください</option>
                    <option value="ps_001">第1回 パートナーシップ説明会</option>
                    <option value="ps_002">第2回 パートナーシップ説明会</option>
                  </select>
                </div>
                <div className="form-group"><label>SNSアカウント（任意）</label><input type="text" name="sns" placeholder="@username（X / Instagram等）" /></div>
                <div className="form-group"><label>メッセージ・意気込み（任意）</label><textarea name="message" placeholder="サポーターとしての意気込みや、応援したいプロジェクトのタイプ等"></textarea></div>
                {error && <p style={{color:'#E60012',fontSize:'14px',marginBottom:'12px'}}>{error}</p>}
                <button type="submit" className="form-submit" disabled={submitting} style={submitting ? {opacity:0.7} : {}}>{submitting ? '登録中...' : 'サポーター登録する →'}</button>
                <p className="form-note">※ 登録後に確認メールが自動送信されます<br />※ 個人情報はサポータープログラム運営目的のみに使用します</p>
              </form>
            )}
          </div>
        </div>
      </section>

      <div className="footer">&copy; 2026 KAMO FUNDING. All rights reserved.</div>
    </>
  );
}
