'use client';

import { useEffect, useState } from 'react';
import '@/styles/kamo-icons.css';
import '@/styles/partner-session.css';

export default function PartnerSessionPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onScroll = () => {
      const header = document.getElementById('header');
      if (header) header.classList.toggle('scrolled', window.scrollY > 50);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
    try {
      const res = await fetch('/api/apply-partner-session', { method: 'POST', body: formData });
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

  const toggleFaq = (e: React.MouseEvent) => {
    (e.currentTarget as HTMLElement).parentElement?.classList.toggle('open');
  };

  return (
    <>
      <header className="header" id="header">
        <div className="header-inner">
          <a href="/" className="logo"><img src="/kamo-logo-main.jpg" alt="KAMOファンディング" style={{height:'36px',width:'auto'}} /></a>
          <nav className="header-nav">
            <a href="#programs">3プログラム</a>
            <a href="#comparison">比較表</a>
            <a href="#schedule">説明会構成</a>
            <a href="#apply" className="header-cta">説明会に申し込む</a>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="container">
          <div className="hero-inner">
            <div className="hero-badge"><span className="hero-badge-dot"></span>Pillar 4 — エコシステム拡張プログラム</div>
            <h1><span className="accent">共犯者</span>になって、一緒に稼ごう。<br />KAMOファンディング<br /><span className="gold">パートナーシップ説明会</span></h1>
            <p className="hero-sub">紹介するだけ、伴走する、がっつり稼ぐ — あなたの関わり方に合わせた3つのプログラム。<br />どれからでも始められる、KAMOファンディングのパートナーシップ制度。</p>
            <div className="hero-cta-group">
              <a href="#apply" className="btn-primary">説明会に申し込む →</a>
              <a href="#programs" className="btn-secondary">3プログラムを見る</a>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="programs">
        <div className="container">
          <div className="section-title">
            <span className="label">PARTNERSHIP PROGRAMS</span>
            <h2>3つの<span className="accent">プログラム</span></h2>
            <p>参入ハードルに合わせて選べる3つのパートナータイプ。まずは登録から、慣れたら上位プログラムへ。</p>
          </div>
          <div className="programs-grid">
            <div className="program-card entry">
              <div className="program-num">PROGRAM A</div>
              <span className="program-tag">参入ハードル：最も低い</span>
              <h3>紹介パートナー</h3>
              <p>クラファン掲載候補をKAMOに紹介するだけ。登録は無料・即日発行。</p>
              <ul>
                <li>登録のみ（オンラインフォーム）</li>
                <li>紹介コード自動発行</li>
                <li>掲載完了時に紹介料（総支援額の2%）</li>
                <li>新しいスキルは不要・ネットワークを活かすだけ</li>
              </ul>
              <div className="reward-text">紹介料：総支援金額（税抜）の2%<span style={{fontSize:'12px',color:'#666',fontWeight:400,display:'block'}}>例：¥1,000,000→¥20,000 / ¥10,000,000→¥200,000</span></div>
              <a href="/partners" className="cta-link">パートナー登録へ →</a>
            </div>
            <div className="program-card high">
              <div className="program-num">PROGRAM B</div>
              <span className="program-tag">参入ハードル：高（養成講座修了）</span>
              <h3>認定アドバイザー養成講座</h3>
              <p>がっつり稼ぎたい方向け。企画から支援までフルサポートするプロフェッショナル。</p>
              <ul>
                <li>全6回・オンライン＋実践</li>
                <li>KAMO手数料の20%＋コンサルフィー</li>
                <li>コンサルフィー¥30,000〜100,000/月</li>
                <li>受講料¥128,000・認定証授与</li>
              </ul>
              <div className="reward-text">KAMO手数料の20%＋コンサルフィー¥30,000〜100,000<span style={{fontSize:'12px',color:'#666',fontWeight:400,display:'block'}}>受講料：¥128,000</span></div>
              <a href="#apply" className="cta-link">説明会に申し込む →</a>
            </div>
            <div className="program-card mid">
              <div className="program-num">PROGRAM C</div>
              <span className="program-tag">参入ハードル：中（説明会参加）</span>
              <h3>プロジェクトサポーター</h3>
              <p>KAMOファンディングの作業をサポートで成果報酬を受け取ろう。PR・事務局でプロジェクトを伴走サポート。※SNS発信、スケジュール管理、裏方業務得意な方！求む！</p>
              <ul>
                <li>PR支援・SNS拡散・周囲への紹介</li>
                <li>集客支援・イベント動員</li>
                <li>月1回の鴨頭嘉人さんオンライン交流会</li>
                <li>支援額に応じた成果報酬</li>
              </ul>
              <div className="reward-text">コミュニティ特典＋成果報酬<span style={{fontSize:'12px',color:'#666',fontWeight:400,display:'block'}}>報酬設定は今後追加予定・コミュニティ参加型</span></div>
              <a href="/supporters" className="cta-link">サポーター登録へ →</a>
            </div>
          </div>
        </div>
      </section>

      <section className="comparison-section" id="comparison">
        <div className="container">
          <div className="section-title">
            <span className="label">COMPARISON</span>
            <h2>3プログラム<span className="accent">比較表</span></h2>
            <p>あなたに最適なプログラムを見つけてください。</p>
          </div>
          <div className="comparison-table-wrap">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>比較項目</th><th>紹介パートナー</th><th>認定アドバイザー</th><th>サポーター</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>プログラム名</strong></td>
                  <td><span className="program-name entry">紹介パートナー</span></td>
                  <td><span className="program-name high">認定アドバイザー</span></td>
                  <td><span className="program-name mid">プロジェクトサポーター</span></td>
                </tr>
                <tr>
                  <td><strong>役割</strong></td>
                  <td>クラファン掲載候補を紹介</td>
                  <td>企画から支援までフルサポート</td>
                  <td>掲載後のPR・集客支援</td>
                </tr>
                <tr>
                  <td><strong>報酬</strong></td>
                  <td>総支援金額（税抜）の2%</td>
                  <td>KAMO手数料の20%＋コンサルフィー¥30k〜100k</td>
                  <td>コミュニティ特典（報酬設定は今後追加）</td>
                </tr>
                <tr>
                  <td><strong>参入ハードル</strong></td>
                  <td><span className="barrier-badge barrier-low">登録のみ（無料）</span></td>
                  <td><span className="barrier-badge barrier-high">養成講座修了</span></td>
                  <td><span className="barrier-badge barrier-mid">説明会参加</span></td>
                </tr>
                <tr>
                  <td><strong>必要なスキル</strong></td>
                  <td>特になし（ネットワーク活用）</td>
                  <td>ヒアリング・企画・支援スキル</td>
                  <td>PR・SNS・コミュニケーション</td>
                </tr>
                <tr>
                  <td><strong>想定月収</strong></td>
                  <td>数千円〜数十万円（紹介次第）</td>
                  <td>10万〜50万円+</td>
                  <td>特典メイン（報酬は今後追加）</td>
                </tr>
                <tr>
                  <td><strong>登録方法</strong></td>
                  <td>オンラインフォーム（即日）</td>
                  <td>養成講座申し込み（全6回）</td>
                  <td>説明会参加後、オンライン登録</td>
                </tr>
                <tr>
                  <td><strong>こんな方に</strong></td>
                  <td>紹介だけで副収入を得たい方</td>
                  <td>がっつり稼ぎたい専門家・コンサル</td>
                  <td>コミュニティに参加したい方</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="section-title">
            <span className="label">FUNNEL DESIGN</span>
            <h2>ファネル<span className="accent">設計</span></h2>
            <p>参入ハードルが低い順で説明し、まず登録で母数を作り、上位プログラムに引き上げます。</p>
          </div>
          <div className="funnel-section">
            <div className="funnel-diagram">
              <div className="funnel-top"><span className="kamo-icon kamo-icon-clipboard sm" style={{display:'inline-flex',verticalAlign:'middle',marginRight:'8px'}}></span>説明会参加（90分・3プログラム統合）</div>
              <div className="funnel-arrow">↓</div>
              <div className="funnel-split">
                <div className="funnel-branch green"><strong>紹介パートナー</strong><br />登録だけ（ハードル低）</div>
                <div className="funnel-branch gold"><strong>サポーター</strong><br />コミュニティ参加型</div>
                <div className="funnel-branch red"><strong>アドバイザー</strong><br />がっつり稼ぎたい</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="schedule">
        <div className="container">
          <div className="section-title">
            <span className="label">EXPLANATION SESSION</span>
            <h2>説明会<span className="accent">構成（90分）</span></h2>
            <p>3プログラムを1回の説明会に統合。参入ハードル順に説明します。</p>
          </div>
          <div className="schedule-timeline">
            <div className="timeline-item"><div className="timeline-time">0:00-0:05</div><div className="timeline-content"><h4>開場・アイスブレイク <span className="timeline-tag tag-info">導入</span></h4><p>鴨頭嘉人さんメッセージ動画</p></div></div>
            <div className="timeline-item"><div className="timeline-time">0:05-0:15</div><div className="timeline-content"><h4>KAMOファンディングの現状 <span className="timeline-tag tag-info">概要</span></h4><p>月10件獲得の目標と現在地</p></div></div>
            <div className="timeline-item"><div className="timeline-time">0:15-0:30</div><div className="timeline-content"><h4>プログラムA：紹介パートナー <span className="timeline-tag tag-a">最も参入しやすい</span></h4><p>登録だけ・紹介料：総支援金額（税抜）の2%</p></div></div>
            <div className="timeline-item"><div className="timeline-time">0:30-0:50</div><div className="timeline-content"><h4>プログラムB：アドバイザー養成講座 <span className="timeline-tag tag-b">がっつり稼ぎたい方</span></h4><p>全6回・受講料¥128,000・KAMO手数料の20%＋コンサルフィー</p></div></div>
            <div className="timeline-item"><div className="timeline-time">0:50-1:05</div><div className="timeline-content"><h4>プログラムC：サポーター <span className="timeline-tag tag-c">コミュニティ参加型</span></h4><p>PR・集客支援</p></div></div>
            <div className="timeline-item"><div className="timeline-time">1:05-1:20</div><div className="timeline-content"><h4>登録フロー・次のアクション <span className="timeline-tag tag-info">行動喚起</span></h4><p>その場で登録可能・LP経由</p></div></div>
            <div className="timeline-item"><div className="timeline-time">1:20-1:30</div><div className="timeline-content"><h4>質疑応答＋交流 <span className="timeline-tag tag-info">クロージング</span></h4><p>鴨頭嘉人さん参加</p></div></div>
          </div>
        </div>
      </section>

      <section className="form-section" id="apply">
        <div className="container">
          <div className="form-card">
            <h2>パートナーシップ説明会に<span className="accent">申し込む</span></h2>
            <p className="form-sub">3プログラムの説明会（90分・オンライン）にご参加ください。</p>
            {submitted ? (
              <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                <div className="kamo-icon kamo-icon-check-lg" style={{ width: '48px', height: '48px', marginBottom: '16px' }}></div>
                <h3 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '8px' }}>申込完了！</h3>
                <p style={{ color: '#666', fontSize: '15px' }}>確認メールを送信しました。当日までにお待ちください。</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <input type="hidden" name="event_type" value="partner_session" />
                <div className="form-row">
                  <div className="form-group">
                    <label>お名前 <span className="required">必須</span></label>
                    <input type="text" name="name" required placeholder="鴨頭 太郎" />
                  </div>
                  <div className="form-group">
                    <label>メールアドレス <span className="required">必須</span></label>
                    <input type="email" name="email" required placeholder="example@email.com" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>会社名・団体名</label>
                    <input type="text" name="company" placeholder="株式会社〇〇" />
                  </div>
                  <div className="form-group">
                    <label>職業・専門分野</label>
                    <input type="text" name="profession" placeholder="税理士 / コンサルタント / etc" />
                  </div>
                </div>
                <div className="form-group">
                  <label>興味のあるプログラム <span className="required">必須</span></label>
                  <select name="program_interest" required>
                    <option value="">選択してください</option>
                    <option value="partner">紹介パートナー（登録だけ）</option>
                    <option value="advisor">認定アドバイザー養成講座（がっつり稼ぎたい）</option>
                    <option value="supporter">プロジェクトサポーター</option>
                    <option value="all">すべて聞いてから決めたい</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>参加希望日</label>
                  <select name="event_id">
                    <option value="">選択してください</option>
                    <option value="ps_001">第1回 パートナーシップ説明会（日程調整中）</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>質問・メッセージ（任意）</label>
                  <textarea name="message" placeholder="説明会で聞きたいこと、質問などがあればお書きください"></textarea>
                </div>
                {error && <p style={{ color: '#E60012', fontSize: '14px', marginBottom: '12px' }}>{error}</p>}
                <button type="submit" className="form-submit" disabled={submitting} style={submitting ? { opacity: 0.7 } : {}}>
                  {submitting ? '送信中...' : '説明会に申し込む →'}
                </button>
                <p className="form-note">※ 申込後に確認メールが自動送信されます<br />※ 個人情報は本説明会の運営目的のみに使用します</p>
              </form>
            )}
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <div className="footer-inner">
            <div className="footer-brand">
              <div className="logo"><img src="/kamo-logo-main.jpg" alt="KAMOファンディング" style={{height:'28px',width:'auto'}} /></div>
              <p>共犯者を集め、夢を叶える場所。<br />鴨頭嘉人が推進する日本で最も熱いクラウドファンディングサービス。</p>
            </div>
            <div className="footer-links">
              <div><h5>プログラム</h5><ul><li><a href="#programs">紹介パートナー</a></li><li><a href="#programs">認定アドバイザー</a></li><li><a href="#programs">プロジェクトサポーター</a></li></ul></div>
              <div><h5>説明会</h5><ul><li><a href="#schedule">説明会構成</a></li><li><a href="#apply">お申込み</a></li><li><a href="/partners">パートナー登録</a></li><li><a href="/supporters">サポーター登録</a></li></ul></div>
              <div><h5>KAMO</h5><ul><li><a href="https://www.kamofunding.com/">公式サイト</a></li><li><a href="https://www.kamofunding.com/projects">プロジェクト一覧</a></li></ul></div>
            </div>
          </div>
          <div className="footer-bottom">&copy; 2026 KAMO FUNDING. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}
