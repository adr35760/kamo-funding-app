'use client';

import { useEffect, useState } from 'react';
import '@/styles/kamo-icons.css';
import '@/styles/partner-session-announce.css';

export default function PartnerSessionAnnouncePage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handler = (e: Event) => {
      const a = e.target as HTMLAnchorElement;
      if (a.tagName === 'A' && a.getAttribute('href')?.startsWith('#')) {
        const target = document.querySelector(a.getAttribute('href')!);
        if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    formData.forEach((v, k) => { data[k] = v as string; });
    try {
      const res = await fetch('/api/apply-partner-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '申込に失敗しました');
      }
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '申込に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <a href="/"><img src="/kamo-logo-main.jpg" alt="KAMOファンディング" style={{height:'32px',width:'auto'}} /></a>
          <a href="#apply" className="header-cta">今すぐ申し込む</a>
        </div>
      </header>

      <section className="hero">
        <div className="container">
          <div className="hero-inner">
            <div className="hero-badge"><span className="hero-badge-dot"></span>1対1の個別説明会・目安60分・参加費無料</div>
            <h1><span className="gold">共犯者</span>になって、<br />一緒に稼ごう。<br />KAMOファンディング<br />パートナーシップ個別説明会（1対1）</h1>
            <p className="hero-sub">紹介するだけ、伴走する、がっつり稼ぐ — あなたの関わり方に合わせた3つのプログラム。<br />どれからでも始められる、KAMOファンディングのパートナーシップ制度。</p>
            <a href="#apply" className="hero-cta">無料で申し込む →</a>
            <div className="hero-meta">
              <div className="hero-meta-item"><span className="kamo-icon kamo-icon-clock sm"></span> 目安60分</div>
              <div className="hero-meta-item"><span className="kamo-icon kamo-icon-monitor sm"></span> オンライン</div>
              <div className="hero-meta-item"><span className="kamo-icon kamo-icon-yen sm"></span> 参加費¥0</div>
              <div className="hero-meta-item"><span className="kamo-icon kamo-icon-target sm"></span> 3プログラム一堂に</div>
            </div>
          </div>
        </div>
      </section>

      <section className="programs">
        <div className="container">
          <div className="programs-title">
            <h2>3つの<span className="accent">プログラム</span></h2>
            <p>参入ハードルに合わせて選べる3つのパートナータイプ。</p>
          </div>
          <div className="programs-grid">
            <div className="program-card green">
              <div className="num">PROGRAM A</div>
              <h3>紹介パートナー</h3>
              <div className="reward">総支援金額（税抜）の2%</div>
              <p>クラファン掲載候補を紹介するだけ。ネットワークを活かす。</p>
              <span className="barrier barrier-low">登録のみ・無料</span>
            </div>
            <div className="program-card red">
              <div className="num">PROGRAM B</div>
              <h3>認定アドバイザー</h3>
              <div className="reward">KAMO手数料の20%＋コンサル¥30k〜100k</div>
              <p>全6回の養成講座でプロに。受講料¥128,000。</p>
              <span className="barrier barrier-high">養成講座修了</span>
            </div>
            <div className="program-card gold">
              <div className="num">PROGRAM C</div>
              <h3>KAMOファンディングの作業をサポートで成果報酬を受け取ろう</h3>
              <div className="reward">コミュニティ特典＋成果報酬</div>
              <p>PR・事務局でプロジェクトを伴走サポート</p>
              <span className="barrier barrier-mid">個別説明会</span>
            </div>
          </div>
        </div>
      </section>

      <section className="comparison">
        <div className="container">
          <div className="comparison-title"><h2>3プログラム<span className="accent">比較表</span></h2></div>
          <div className="table-wrap">
            <table className="ctable">
              <thead>
                <tr><th>項目</th><th>紹介パートナー</th><th>認定アドバイザー</th><th>プロジェクトサポーター</th></tr>
              </thead>
              <tbody>
                <tr><td><strong>役割</strong></td><td>掲載候補を紹介</td><td>企画〜支援フルサポート</td><td>PR・集客支援</td></tr>
                <tr><td><strong>報酬</strong></td><td>総支援金額の2%</td><td>KAMO手数料20%＋コンサル</td><td>コミュニティ特典＋成果報酬</td></tr>
                <tr><td><strong>ハードル</strong></td><td>登録のみ（無料）</td><td>養成講座（¥128,000）</td><td>個別説明会</td></tr>
                <tr><td><strong>想定月収</strong></td><td>数千円〜数十万円</td><td>10万〜50万+</td><td>特典メイン</td></tr>
                <tr><td><strong>こんな方に</strong></td><td>紹介で副収入</td><td>がっつり稼ぎたい専門家</td><td>PR・事務局でプロジェクトを伴走サポート。成果報酬あり。※SNS発信、スケジュール管理、裏方業務得意な方！求む！</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="schedule" id="schedule">
        <div className="container">
          <div className="schedule-title"><h2>個別説明会<span className="accent">（1対1）</span></h2></div>
          <div style={{maxWidth:'640px',margin:'0 auto',background:'#fff',border:'2px solid #FFE0E0',borderRadius:'16px',padding:'28px 24px',textAlign:'center'}}>
            <p style={{fontSize:'18px',fontWeight:900,marginBottom:'12px'}}>ご希望の日時をお知らせください。</p>
            <p style={{fontSize:'15px',color:'#666',lineHeight:1.9}}>
              担当者より個別に日程調整のご連絡をします。<br />
              <strong style={{color:'#E60012'}}>所要時間の目安：60分／オンライン（Zoom）</strong>
            </p>
            <a href="#apply" className="hero-cta" style={{display:'inline-block',marginTop:'20px'}}>希望日時を送る →</a>
          </div>
          <p style={{textAlign:'center',fontSize:'14px',color:'#666',marginTop:'20px'}}>※ お申込み後、ご希望日時を確認のうえ担当者よりご連絡します</p>
        </div>
      </section>

      <section className="cta-banner">
        <div className="container">
          <h2>あなたの関わり方に合わせて選べる</h2>
          <p>まずは1対1の個別説明会で、3つのプログラムを知ってください。</p>
          <a href="#apply" className="hero-cta">個別説明会に申し込む →</a>
        </div>
      </section>

      <section className="form-section" id="apply">
        <div className="container">
          <div className="form-card">
            <h2>パートナーシップ<span className="accent">個別説明会</span>に申し込む</h2>
            <p className="form-sub">1対1の個別説明会（目安60分・オンライン／Zoom・無料）です。ご希望の日時をお知らせください。担当者より個別に日程調整のご連絡をします。</p>
            {submitted ? (
              <div style={{textAlign:'center',padding:'48px 24px'}}>
                <div className="kamo-icon kamo-icon-check-lg" style={{width:'48px',height:'48px',marginBottom:'16px'}}></div>
                <h3 style={{fontSize:'24px',fontWeight:900,marginBottom:'8px'}}>申込完了！</h3>
                <p style={{color:'#666',fontSize:'15px'}}>確認メールを送信しました。ご希望日時を確認のうえ、担当者より日程確定のご連絡をします。</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group"><label>お名前 <span className="required">必須</span></label><input type="text" name="name" required placeholder="鴨頭 太郎" /></div>
                  <div className="form-group"><label>メールアドレス <span className="required">必須</span></label><input type="email" name="email" required placeholder="example@email.com" /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>会社名・団体名</label><input type="text" name="company" placeholder="株式会社〇〇" /></div>
                  <div className="form-group"><label>職業・専門分野</label><input type="text" name="profession" placeholder="税理士 / コンサルタント / etc" /></div>
                </div>
                <div className="form-group">
                  <label>興味のあるプログラム <span className="required">必須</span></label>
                  <select name="program_interest" required>
                    <option value="">選択してください</option>
                    <option value="partner">紹介パートナー（登録だけ）</option>
                    <option value="advisor">認定アドバイザー養成講座</option>
                    <option value="supporter">プロジェクトサポーター</option>
                    <option value="all">すべて聞いてから決めたい</option>
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>ご希望日時：第1希望 <span className="required">必須</span></label><input type="text" name="preferred_slot_1" required placeholder="例: 9/10（木）20:00〜" /></div>
                  <div className="form-group"><label>ご希望日時：第2希望</label><input type="text" name="preferred_slot_2" placeholder="例: 9/12（土）14:00〜" /></div>
                </div>
                <div className="form-group"><label>質問・メッセージ（任意）</label><textarea name="message" placeholder="個別説明会で聞きたいこと等があれば"></textarea></div>
                {error && <p style={{color:'#E60012',fontSize:'14px',marginBottom:'12px'}}>{error}</p>}
                <button type="submit" className="form-submit" disabled={submitting} style={submitting ? {opacity:0.7} : {}}>{submitting ? '送信中...' : '申し込む →'}</button>
                <p className="form-note">※ 申込後に確認メールが自動送信されます<br />※ ご希望日時を確認のうえ、担当者より日程確定のご連絡をします<br />※ 個人情報は本説明会の運営目的のみに使用します</p>
              </form>
            )}
          </div>
        </div>
      </section>

      <footer className="footer"><div className="container">&copy; 2026 KAMO FUNDING. All rights reserved.</div></footer>
    </>
  );
}
