'use client';

import { useEffect, useState, Fragment } from 'react';
import Image from 'next/image';
import SiteHeader from '@/components/SiteHeader';
import '@/styles/kamo-icons.css';
import '@/styles/partner-register.css';
import LegalFooter from '@/components/LegalFooter';
import { captureUtm, getUtmPayload } from '@/lib/utm';
import { referralShareUrl } from '@/lib/referral-link';
import { buildReferralShareMessage, buildReferralShortMessage } from '@/lib/referral-message';
import {
  REFERRAL_RATE_LABEL,
  SUPPORT_FEE_RATE_LABEL,
  CONSULT_FEE_LABEL,
  TRAINING_FEE_LABEL,
  SUPPORT_CONSULT_URL,
} from '@/lib/partner-program';

/** ⑦ 流れ（表示順そのまま） */
const REFERRAL_FLOW = ['登録（無料）', '紹介コード発行', '説明会へご紹介', '掲載・募集終了', '報酬（終了月の翌々月末）'];
const SUPPORT_FLOW = ['ご相談', '面談', `サポーター研修（${TRAINING_FEE_LABEL}）`, '活動', '報酬'];

/**
 * /partners — 2種類のパートナー募集ページ
 *
 * 2026-10-27: 「紹介パートナー」単独の募集から、
 * ① 紹介パートナー（掲載候補のご紹介・対象額の2%）
 * ② サポートパートナー（企画〜集客の支援・KAMO手数料の20%＋コンサル料）
 * の2種類を並べた構成へ再編（CAMPFIRE のパートナーページの構成に寄せる）。
 *
 * 🔴 既存の登録フォーム・/api/register-partner・UTM計測・発行コードの表示は
 *    この再編でも一切変更しない（＝送信処理 handleSubmit と完了表示はそのまま）。
 * 🔴 金額・率は src/lib/partner-program.ts の定数だけを参照する（本文に直書きしない）。
 */
export default function PartnerRegisterPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  // 登録完了画面に出す専用リンクと文面（メールと同じ内容をその場でも渡す）
  const [issuedCode, setIssuedCode] = useState('');
  const [registeredName, setRegisteredName] = useState('');
  const [copied, setCopied] = useState('');

  // 流入元（UTM）をURLから読み取り、登録送信まで保持する
  // （スクロールや再描画で消えないよう sessionStorage に保存する）
  useEffect(() => {
    captureUtm();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    formData.forEach((v, k) => { data[k] = v as string; });
    const name = (data.name || '').trim();
    // 流入元（UTM）を登録データに添付する。取れていなければ何も付かない（登録は必ず通す）
    Object.assign(data, getUtmPayload());
    try {
      const res = await fetch('/api/register-partner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result.error || '登録に失敗しました');
      }
      // 専用リンク（/r/<code>）は発行されたコードから組み立てる。
      // 取れなかった場合でも完了表示は出す（登録自体は成立しているため）
      if (result.referral_code) {
        setIssuedCode(result.referral_code);
        setRegisteredName(name);
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

      {/* ① ヒーロー */}
      <section className="partner-hero">
        <div className="container">
          <div className="partner-hero-inner">
            <p className="partner-hero-badge">2つの関わり方から選べます</p>
            <h1><span className="partner-hero-h1-keep">KAMOファンディングは、</span><span className="partner-hero-h1-rest">パートナーを募集しています</span></h1>
            <p className="partner-hero-lead">
              挑戦する人のそばで、あなたのネットワークとスキルを活かす。2つの関わり方があります。
            </p>
            <div className="partner-hero-cta">
              <a href="#register" className="partner-cta-main">紹介パートナーに登録する（無料・即日コード発行）</a>
              <a
                href={SUPPORT_CONSULT_URL}
                className="partner-cta-sub"
                target="_blank"
                rel="noopener noreferrer"
              >
                サポートパートナーについて相談する
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ② なぜ募集するのか */}
      <section className="partner-section">
        <div className="container">
          <h2 className="partner-section-title">挑戦する人を、一人で戦わせない。</h2>
          <p className="partner-lead-text">
            KAMOファンディングは、クラウドファンディングを通じて挑戦をかたちにする支援をしています。しかし、すべての挑戦に私たちだけの力では届きません。紹介してくれる人、現場を支えてくれる人。その両方がいて、挑戦は前に進みます。
          </p>
        </div>
      </section>

      {/* ③ パートナーシッププログラムとは */}
      <section className="partner-section is-light">
        <div className="container">
          <h2 className="partner-section-title is-body">
            クラウドファンディングの掲載候補をご紹介いただいたり、プロジェクトの成功を支えていただいたりした方に、報酬をお支払いする制度です。
          </h2>
        </div>
      </section>

      {/* ④ 2種類のパートナー */}
      <section className="partner-section" id="types">
        <div className="container">
          <h2 className="partner-section-title">2種類のパートナー</h2>
          <div className="partner-cards">
            <article className="partner-card">
              <p className="partner-card-kind">紹介パートナー</p>
              <dl className="partner-card-list">
                <div className="partner-card-row">
                  <dt>やること</dt>
                  <dd>掲載説明会へのご紹介</dd>
                </div>
                <div className="partner-card-row is-reward">
                  <dt>報酬</dt>
                  <dd>
                    <span className="partner-reward-label">掲載に至った場合、対象額の</span>
                    <span className="partner-reward-rate">{REFERRAL_RATE_LABEL}</span>
                  </dd>
                </div>
                <div className="partner-card-row">
                  <dt>条件</dt>
                  <dd>登録無料・<strong>即日紹介コード発行</strong></dd>
                </div>
              </dl>
              <p className="partner-note">
                ※紹介料のお受け取りには、掲載説明会へのご参加（紹介報酬規程の承諾）が必要です
              </p>
              <a href="#register" className="partner-card-cta">紹介パートナーに登録する →</a>
              <details className="reward-detail">
                <summary>報酬の計算例と注意事項</summary>
                <p className="reward-notes">
                  対象額＝総支援金額ー手数料ー手数料に係る消費税。その2%が報酬です。<br />
                  計算例：総支援金額¥1,000,000→対象額¥780,000→紹介料約¥15,600／¥10,000,000→¥7,800,000→約¥156,000<br />
                  ※手数料20%・消費税10%で試算した参考値です<br />
                  ※募集終了時に明細を発行し、終了月の翌々月末に指定口座へお支払い
                </p>
              </details>
            </article>

            <article className="partner-card is-support">
              <p className="partner-card-kind">サポートパートナー</p>
              <dl className="partner-card-list">
                <div className="partner-card-row">
                  <dt>やること</dt>
                  <dd>掲載プロジェクトの成功を企画〜集客まで支援</dd>
                </div>
                <div className="partner-card-row is-reward">
                  <dt>報酬</dt>
                  <dd>
                    <span className="partner-reward-label">KAMO手数料の</span>
                    <span className="partner-reward-rate is-gold">{SUPPORT_FEE_RATE_LABEL}</span>
                    <span className="partner-reward-extra">
                      ＋コンサル料（{CONSULT_FEE_LABEL}）
                    </span>
                  </dd>
                </div>
                <div className="partner-card-row">
                  <dt>条件</dt>
                  <dd>面談ののち、サポーター研修（{TRAINING_FEE_LABEL}）</dd>
                </div>
              </dl>
              <p className="partner-note">
                ※面談を経て、サポーター研修（{TRAINING_FEE_LABEL}）を受講いただきます
              </p>
              <a
                href={SUPPORT_CONSULT_URL}
                className="partner-card-cta is-support"
                target="_blank"
                rel="noopener noreferrer"
              >
                サポートパートナーについて相談する →
              </a>
            </article>
          </div>
        </div>
      </section>

      {/* ⑤ メリット3つ */}
      <section className="partner-section is-light">
        <div className="container">
          <h2 className="partner-section-title">パートナーになるメリット</h2>
          <div className="partner-merit-grid">
            <div className="partner-merit-card">
              <h3><span className="kamo-icon kamo-icon-handshake sm" style={{ marginRight: '6px' }}></span>既存のお客様への付加価値</h3>
              <p>プロモーション・資金調達の手段として提案できる</p>
            </div>
            <div className="partner-merit-card">
              <h3><span className="kamo-icon kamo-icon-yen sm" style={{ marginRight: '6px' }}></span>紹介だけでも報酬が発生</h3>
              <p>掲載に至れば対象額の{REFERRAL_RATE_LABEL}</p>
            </div>
            <div className="partner-merit-card">
              <h3><span className="kamo-icon kamo-icon-flame sm" style={{ marginRight: '6px' }}></span>サポーターコミュニティに参加</h3>
              <p>鴨頭嘉人さんの交流会・専門家としての名前掲載</p>
            </div>
          </div>

          <div className="community-figure partner-community">
            <Image
              src="/partners-community.jpg"
              alt="KAMOファンディングのコミュニティメンバー"
              width={1400}
              height={963}
              sizes="(max-width: 768px) 100vw, 720px"
              className="community-image"
            />
            <p className="community-caption">全国から集まる KAMOファンディングのコミュニティメンバー</p>
          </div>
        </div>
      </section>

      {/* ⑥ 向いている方 */}
      <section className="partner-section">
        <div className="container">
          <h2 className="partner-section-title">向いている方</h2>
          <div className="partner-fit-grid">
            <div className="partner-fit-card">
              <h3>紹介パートナー</h3>
              <ul className="partner-fit-list">
                <li>クラウドファンディングの経験がある方</li>
                <li>業界・組合・地域のネットワークをお持ちの方</li>
                <li>相談を受けることがある方</li>
              </ul>
            </div>
            <div className="partner-fit-card is-support">
              <h3>サポートパートナー</h3>
              <ul className="partner-fit-list">
                <li>制作・マーケティング・コンサルティングをされている方</li>
                <li>地域支援の担い手（商工会議所・地域おこし協力隊など）</li>
                <li>現場で手を動かしたい方</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ⑦ 流れ */}
      <section className="partner-section is-light">
        <div className="container">
          <h2 className="partner-section-title">ご登録から報酬までの流れ</h2>
          <div className="partner-flow">
            <div className="partner-flow-row">
              <p className="partner-flow-kind">紹介パートナー</p>
              <div className="partner-flow-steps">
                {REFERRAL_FLOW.map((step, i) => (
                  <Fragment key={step}>
                    <span className="partner-flow-step">{step}</span>
                    {i < REFERRAL_FLOW.length - 1 && <span className="partner-flow-arrow" aria-hidden="true">→</span>}
                  </Fragment>
                ))}
              </div>
            </div>
            <div className="partner-flow-row is-support">
              <p className="partner-flow-kind">サポートパートナー</p>
              <div className="partner-flow-steps">
                {SUPPORT_FLOW.map((step, i) => (
                  <Fragment key={step}>
                    <span className="partner-flow-step">{step}</span>
                    {i < SUPPORT_FLOW.length - 1 && <span className="partner-flow-arrow" aria-hidden="true">→</span>}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ⑧ 登録フォーム（既存の紹介パートナー登録フォームをそのまま） */}
      <section className="form-section" id="register">
        <div className="container">
          <div className="form-card">
            <h2>紹介<span className="green">パートナー登録</span></h2>
            <p className="form-sub">登録は無料・即日で紹介コードを発行します。以下の情報をご入力ください。</p>
            <p className="form-note-top">※ 紹介料のお受け取りには、説明会への参加（紹介報酬規程の承諾）が必要です</p>
            {submitted ? (
              <div style={{ textAlign: 'center', padding: '40px 24px' }}>
                <div className="kamo-icon kamo-icon-check-lg" style={{ width: '48px', height: '48px', margin: '0 auto 16px' }}></div>
                <h3 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '8px' }}>登録完了！</h3>
                <p style={{ color: '#666', fontSize: '15px' }}>紹介コードと専用リンクをメールで送信しました。ご確認ください。</p>

                {issuedCode && (() => {
                  // メールと同じ文面をその場でも渡す（メールを探さずに配れるように）
                  const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
                  const shareUrl = referralShareUrl(issuedCode, origin);
                  const message = buildReferralShareMessage(registeredName, issuedCode, origin);
                  const shortMessage = buildReferralShortMessage(registeredName, issuedCode, origin);
                  const copy = async (text: string, key: string) => {
                    try {
                      await navigator.clipboard.writeText(text);
                      setCopied(key);
                      setTimeout(() => setCopied(''), 2000);
                    } catch {
                      window.prompt('以下をコピーしてください', text);
                    }
                  };
                  return (
                    <div style={{ textAlign: 'left', marginTop: '24px' }}>
                      <div style={{ padding: '16px', background: '#F0FFF0', border: '1px solid #C8E6C9', borderRadius: '8px', marginBottom: '12px' }}>
                        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 4px' }}>紹介コード</p>
                        <p style={{ fontSize: '22px', fontWeight: 900, color: '#27AE60', fontFamily: 'monospace', letterSpacing: '1px', margin: '0 0 12px' }}>{issuedCode}</p>
                        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 4px' }}>あなた専用の紹介リンク（これを送るだけでOK）</p>
                        <p style={{ fontSize: '13px', wordBreak: 'break-all', margin: '0 0 8px', fontWeight: 700 }}>{shareUrl}</p>
                        <button type="button" onClick={() => copy(shareUrl, 'url')}
                          style={{ padding: '10px 14px', minHeight: '44px', borderRadius: '6px', border: '1px solid #27AE60', background: '#fff', color: '#27AE60', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                          {copied === 'url' ? 'コピーしました' : 'リンクをコピー'}
                        </button>
                      </div>

                      <div style={{ padding: '16px', background: '#fafafa', border: '1px solid #eee', borderRadius: '8px', marginBottom: '12px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 6px' }}>そのまま送れる文面（メール・LINE向け）</p>
                        <pre style={{ margin: '0 0 8px', padding: '12px', background: '#fff', border: '1px solid #eee', borderRadius: '6px', fontSize: '12px', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit' }}>{message}</pre>
                        <button type="button" onClick={() => copy(message, 'msg')}
                          style={{ padding: '10px 14px', minHeight: '44px', borderRadius: '6px', border: '1px solid #27AE60', background: '#fff', color: '#27AE60', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                          {copied === 'msg' ? 'コピーしました' : '文面をコピー'}
                        </button>
                      </div>

                      <div style={{ padding: '16px', background: '#fafafa', border: '1px solid #eee', borderRadius: '8px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 6px' }}>短い文面（SNS・チャット向け）</p>
                        <pre style={{ margin: '0 0 8px', padding: '12px', background: '#fff', border: '1px solid #eee', borderRadius: '6px', fontSize: '12px', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit' }}>{shortMessage}</pre>
                        <button type="button" onClick={() => copy(shortMessage, 'short')}
                          style={{ padding: '10px 14px', minHeight: '44px', borderRadius: '6px', border: '1px solid #27AE60', background: '#fff', color: '#27AE60', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                          {copied === 'short' ? 'コピーしました' : '短い文面をコピー'}
                        </button>
                      </div>
                    </div>
                  );
                })()}
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
                {error && <p style={{ color: '#E60012', fontSize: '14px', marginBottom: '12px' }}>{error}</p>}
                <button type="submit" className="form-submit" disabled={submitting} style={submitting ? { opacity: 0.7 } : {}}>
                  {submitting ? '登録中...' : '登録する →'}
                </button>
                <p className="form-note">※ 登録後に確認メールと紹介コードが自動送信されます<br />※ 個人情報はパートナーシップ運営目的のみに使用します</p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* 既存パートナー（紹介済みの方）向けの導線 — /partners/referral へのリンクは残す */}
      <section className="partner-section is-referral-link">
        <div className="container">
          <div className="existing-partner-box">
            <p className="existing-partner-title">すでに紹介パートナーとして登録済みの方へ</p>
            <p className="existing-partner-lead">
              紹介コードをお持ちの方は、こちらから「紹介者登録」をお願いします。
            </p>
            <a href="/partners/referral" className="existing-partner-btn">
              紹介者を登録する →
            </a>
          </div>
        </div>
      </section>

      {!submitted && (
        <div className="sticky-cta">
          <div className="sticky-cta-inner">
            <span className="sticky-cta-text">登録は無料・即日で紹介コード発行</span>
            <a href="#register" className="sticky-cta-btn">無料で登録する →</a>
          </div>
        </div>
      )}

      <div className="footer">&copy; 2026 KAMO FUNDING. All rights reserved.<LegalFooter /></div>
    </>
  );
}
