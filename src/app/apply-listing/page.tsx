'use client';

import { useState } from 'react';
import '@/styles/supporter-register.css';
import '@/styles/listing-apply.css';
import SiteHeader from '@/components/SiteHeader';
import LegalFooter from '@/components/LegalFooter';

/**
 * 掲載申込フォーム（KAMOファンディング申込書のWeb版）。
 *
 * 入力項目は t iku 提供の申込書（KAMOファンディング申込書（最新）.docx）の
 * 表と1対1で対応させている。項目の増減は申込書の改訂に合わせる。
 *
 * 🔴 口座情報を入力させる画面。送信先は /api/apply-listing のみで、
 *   ページ側では一切保持・再送しない。
 */

const PROJECT_TYPES = ['目標達成型', '実行確約型'];
const SUPPORT_HOPES = ['希望する', '希望しない'];
const ACCOUNT_TYPES = ['普通', '当座'];

export default function ListingApplyPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  // ラジオは選択状態で枠色を変えるため値を持つ
  const [projectType, setProjectType] = useState('');
  const [supportHope, setSupportHope] = useState('');
  const [accountType, setAccountType] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? '').trim();

    try {
      const res = await fetch('/api/apply-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: get('companyName'),
          representative: get('representative'),
          companyPostalCode: get('companyPostalCode'),
          companyAddress: get('companyAddress'),
          contactName: get('contactName'),
          contactDepartment: get('contactDepartment'),
          contactPhone: get('contactPhone'),
          contactEmail: get('contactEmail'),
          contactPostalCode: get('contactPostalCode'),
          contactAddress: get('contactAddress'),
          projectName: get('projectName'),
          projectSummary: get('projectSummary'),
          projectType: get('projectType'),
          goalAmount: get('goalAmount'),
          recruitStartHope: get('recruitStartHope'),
          recruitEndHope: get('recruitEndHope'),
          supportHope: get('supportHope'),
          bankName: get('bankName'),
          bankBranch: get('bankBranch'),
          bankAccountType: get('bankAccountType'),
          bankAccountNumber: get('bankAccountNumber'),
          bankAccountHolder: get('bankAccountHolder'),
          remarks: get('remarks'),
          agency: get('agency'),
          agreedTerms: fd.get('agreedTerms') === 'on',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || '送信に失敗しました');
      }
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="listing-apply">
      <SiteHeader cta={{ href: '#apply', label: '入力へ進む' }} />

      <section className="hero">
        <div className="container">
          <div className="hero-badge">掲載のお申し込み</div>
          <h1>
            KAMOファンディングに<br />
            <span className="gold">プロジェクトを掲載する</span>
          </h1>
          <p>
            お申し込みはこのページからそのまま送信できます。書類の印刷・返送は不要です。
            ご入力いただいた内容をもとに、事務局からご連絡いたします。
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
                <p>
                  事務局で内容を確認し、担当者よりご入力のメールアドレスへご連絡いたします。
                  <br />
                  ページ作成・実施アドバイスサポートを「希望する」とされた方には、
                  Zoomでの無料面談のご案内を差し上げます。
                </p>
              </div>
            ) : (
              <>
                <h2>
                  掲載<span className="gold">申込書</span>
                </h2>
                <p className="form-sub">
                  目標達成型・実行確約型のどちらもこのフォームでお申し込みいただけます。
                </p>

                <form onSubmit={handleSubmit}>
                  {/* ===== 申込者（会社） ===== */}
                  <div className="apply-section">
                    <div className="apply-section-title">申込者（会社）</div>
                    <div className="form-group">
                      <label>
                        会社名 <span className="required">必須</span>
                      </label>
                      <input
                        type="text"
                        name="companyName"
                        required
                        placeholder="株式会社〇〇（個人の方はお名前をご記入ください）"
                      />
                    </div>
                    <div className="form-group">
                      <label>役職・氏名</label>
                      <input type="text" name="representative" placeholder="代表取締役 鴨頭 太郎" />
                    </div>
                    <div className="form-row is-postal">
                      <div className="form-group">
                        <label>郵便番号</label>
                        <input type="text" name="companyPostalCode" placeholder="123-4567" />
                      </div>
                      <div className="form-group">
                        <label>住所</label>
                        <input type="text" name="companyAddress" placeholder="東京都〇〇区〇〇 1-2-3" />
                      </div>
                    </div>
                  </div>

                  {/* ===== プロジェクト担当者 ===== */}
                  <div className="apply-section">
                    <div className="apply-section-title">プロジェクト担当者</div>
                    <p className="apply-section-note">
                      事務局からのご連絡はこちらの担当者さまへお送りします。
                    </p>
                    <div className="form-row">
                      <div className="form-group">
                        <label>
                          氏名 <span className="required">必須</span>
                        </label>
                        <input type="text" name="contactName" required placeholder="鴨頭 太郎" />
                      </div>
                      <div className="form-group">
                        <label>部署名</label>
                        <input type="text" name="contactDepartment" placeholder="広報部" />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>電話番号</label>
                        <input type="tel" name="contactPhone" placeholder="090-1234-5678" />
                      </div>
                      <div className="form-group">
                        <label>
                          メールアドレス <span className="required">必須</span>
                        </label>
                        <input
                          type="email"
                          name="contactEmail"
                          required
                          placeholder="example@email.com"
                        />
                      </div>
                    </div>
                    <div className="form-row is-postal">
                      <div className="form-group">
                        <label>郵便番号</label>
                        <input type="text" name="contactPostalCode" placeholder="123-4567" />
                      </div>
                      <div className="form-group">
                        <label>住所</label>
                        <input type="text" name="contactAddress" placeholder="会社と同じ場合は「同上」" />
                      </div>
                    </div>
                  </div>

                  {/* ===== プロジェクト ===== */}
                  <div className="apply-section">
                    <div className="apply-section-title">プロジェクト</div>
                    <div className="form-group">
                      <label>プロジェクト名</label>
                      <input
                        type="text"
                        name="projectName"
                        placeholder="決まっていない場合は空欄で構いません"
                      />
                    </div>
                    <div className="form-group">
                      <label>プロジェクトの概要</label>
                      <textarea
                        name="projectSummary"
                        placeholder="どんなプロジェクトか、何のために資金を集めるのかをご記入ください"
                      ></textarea>
                    </div>
                    <div className="form-group">
                      <label>種類</label>
                      <div className="apply-radios">
                        {PROJECT_TYPES.map(t => (
                          <label
                            key={t}
                            className={`apply-radio${projectType === t ? ' is-checked' : ''}`}
                          >
                            <input
                              type="radio"
                              name="projectType"
                              value={t}
                              checked={projectType === t}
                              onChange={() => setProjectType(t)}
                            />
                            {t}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="form-group">
                      <label>目標金額</label>
                      <input type="text" name="goalAmount" placeholder="1,500,000（円）" />
                      <p className="apply-section-note" style={{ margin: '8px 0 0' }}>
                        ※ EC型の場合は記載不要です。
                      </p>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>募集開始希望日</label>
                        <input type="text" name="recruitStartHope" placeholder="2026年11月1日 / 未定" />
                      </div>
                      <div className="form-group">
                        <label>募集終了希望日</label>
                        <input type="text" name="recruitEndHope" placeholder="2026年12月31日 / 未定" />
                      </div>
                    </div>
                  </div>

                  {/* ===== サポート希望 ===== */}
                  <div className="apply-section">
                    <div className="apply-section-title">ページ作成・実施アドバイスサポート</div>
                    <div className="form-group">
                      <div className="apply-radios">
                        {SUPPORT_HOPES.map(t => (
                          <label
                            key={t}
                            className={`apply-radio${supportHope === t ? ' is-checked' : ''}`}
                          >
                            <input
                              type="radio"
                              name="supportHope"
                              value={t}
                              checked={supportHope === t}
                              onChange={() => setSupportHope(t)}
                            />
                            {t}
                          </label>
                        ))}
                      </div>
                      <p className="apply-section-note" style={{ margin: '12px 0 0' }}>
                        ※ 希望される場合は後日Zoomでの無料面談を行いますので、そこでお決めいただいても構いません。
                      </p>
                    </div>
                  </div>

                  {/* ===== 振込先 ===== */}
                  <div className="apply-section">
                    <div className="apply-section-title">プロジェクト資金 振込先</div>
                    <p className="apply-section-note">
                      支援金のお振込先です。<strong>申込者さまご本人（個人・法人）の口座のみ</strong>お受けできます。
                      この時点でお決まりでなければ空欄で送信いただき、後日ご連絡いただいても構いません。
                    </p>
                    <div className="form-row">
                      <div className="form-group">
                        <label>銀行名</label>
                        <input type="text" name="bankName" placeholder="〇〇銀行" />
                      </div>
                      <div className="form-group">
                        <label>支店名</label>
                        <input type="text" name="bankBranch" placeholder="〇〇支店" />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>預金種別</label>
                        <div className="apply-radios">
                          {ACCOUNT_TYPES.map(t => (
                            <label
                              key={t}
                              className={`apply-radio${accountType === t ? ' is-checked' : ''}`}
                            >
                              <input
                                type="radio"
                                name="bankAccountType"
                                value={t}
                                checked={accountType === t}
                                onChange={() => setAccountType(t)}
                              />
                              {t}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="form-group">
                        <label>口座番号</label>
                        <input type="text" name="bankAccountNumber" placeholder="1234567" />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>口座名義</label>
                      <input
                        type="text"
                        name="bankAccountHolder"
                        placeholder="かもがしら たろう（半角小文字での入力も可）"
                      />
                    </div>
                  </div>

                  {/* ===== その他 ===== */}
                  <div className="apply-section">
                    <div className="apply-section-title">その他</div>
                    <div className="form-group">
                      <label>特記事項／特約事項</label>
                      <textarea
                        name="remarks"
                        placeholder="ご要望やご質問がありましたらご記入ください"
                      ></textarea>
                    </div>
                    <div className="form-group">
                      <label>代理店</label>
                      <input
                        type="text"
                        name="agency"
                        placeholder="ご紹介者・代理店がある場合にご記入ください"
                      />
                    </div>
                  </div>

                  {/* 規約同意 — 申込書の「規約に同意のうえ申し込みます」に対応 */}
                  <label className="apply-agree">
                    <input type="checkbox" name="agreedTerms" required />
                    <span>
                      <a href="/terms" target="_blank" rel="noopener noreferrer">
                        出品者向け規約
                      </a>
                      に同意のうえ、KAMOファンディングへの掲載を申し込みます。
                      <span className="required" style={{ marginLeft: 4 }}>
                        必須
                      </span>
                    </span>
                  </label>

                  {error && <p className="apply-error">{error}</p>}

                  <button
                    type="submit"
                    className="form-submit"
                    disabled={submitting}
                    style={submitting ? { opacity: 0.7 } : {}}
                  >
                    {submitting ? '送信中...' : '掲載を申し込む →'}
                  </button>
                  <p className="form-note">
                    ※ 送信後、事務局よりご入力のメールアドレスへご連絡いたします
                    <br />
                    ※ ご提供いただいた個人情報は、担当者へのご連絡等の目的にのみ使用します
                  </p>
                </form>

                {/* 申込書の【注意事項】【提出書類について】をそのまま掲載する */}
                <div className="apply-notice">
                  <h3>ご確認ください</h3>
                  <ul>
                    <li>
                      利用料金は、目標達成型・実行確約型ともに
                      <strong>収受されたプロジェクト代金総額の20％（税別）</strong>
                      です。いずれの場合も決済手数料（5.0％（税込））を含みます。
                    </li>
                    <li>
                      キャンセルが発生した場合、返金は出品者にて実施します。
                      また手数料のうち決済手数料は返却できず、出品者負担となります。
                    </li>
                    <li>
                      支援金のお振込は、<strong>終了月の翌々月の5日〜7日</strong>の間に登録口座へお振り込みします。
                    </li>
                    <li>入金口座は申込者の個人・法人口座のみの受付です。</li>
                  </ul>
                  <h3>提出書類について</h3>
                  <ul>
                    <li>
                      面談が無い場合は、本人確認書類（健康保険証の写し・免許証の写し）のご提出をお願いします。
                      <span className="is-strong">申請住所と相違があると受付できません。</span>
                      ご提出方法は事務局からのご連絡メールにてご案内します。
                    </li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="footer">
        &copy; 2026 KAMO FUNDING. All rights reserved.
        <LegalFooter />
      </div>
    </div>
  );
}
