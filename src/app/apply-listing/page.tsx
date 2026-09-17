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
  // プロジェクト概要は300文字以上必須。残り文字数を出すため長さを保持する
  const [summaryLength, setSummaryLength] = useState(0);

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
          contactPhone: get('contactPhone'),
          contactEmail: get('contactEmail'),
          contactPostalCode: get('contactPostalCode'),
          contactAddress: get('contactAddress'),
          projectName: get('projectName'),
          projectSummary: get('projectSummary'),
          sellingItems: get('sellingItems'),
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
          {/* t iku 指定で2行固定。折り返し任せにせず <br> で改行位置を固定する
              （画面幅で3行・1行に変わると意図した見た目にならない） */}
          <p>
            お申し込みはこのページからそのまま送信できます。書類の印刷・返送は不要です。
            <br />
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
                        <label>
                          電話番号 <span className="required">必須</span>
                        </label>
                        <input type="tel" name="contactPhone" required placeholder="090-1234-5678" />
                      </div>
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
                    <div className="form-row is-postal">
                      <div className="form-group">
                        <label>
                          郵便番号 <span className="required">必須</span>
                        </label>
                        <input type="text" name="contactPostalCode" required placeholder="123-4567" />
                      </div>
                      <div className="form-group">
                        <label>
                          住所 <span className="required">必須</span>
                        </label>
                        <input
                          type="text"
                          name="contactAddress"
                          required
                          placeholder="会社と同じ場合は「同上」"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ===== プロジェクト ===== */}
                  <div className="apply-section">
                    <div className="apply-section-title">プロジェクト</div>
                    <div className="form-group">
                      <label>
                        プロジェクト名 <span className="required">必須</span>
                      </label>
                      <input
                        type="text"
                        name="projectName"
                        required
                        placeholder="〇〇で□□したい！"
                      />
                    </div>
                    <div className="form-group">
                      <label>
                        プロジェクトの概要 <span className="required">必須</span>
                        <span className="apply-count is-over">300文字以上</span>
                      </label>
                      <textarea
                        name="projectSummary"
                        required
                        minLength={300}
                        rows={8}
                        onChange={e => setSummaryLength(e.target.value.length)}
                        placeholder="どんなプロジェクトか、何のために資金を集めるのかを300文字以上でご記入ください"
                      ></textarea>
                      <p className={`apply-count-line${summaryLength > 0 && summaryLength < 300 ? ' is-short' : ''}`}>
                        {summaryLength > 0 && summaryLength < 300
                          ? `あと${300 - summaryLength}文字必要です（現在${summaryLength}文字）`
                          : `現在${summaryLength}文字`}
                      </p>
                    </div>
                    <div className="form-group">
                      <label>
                        主な販売予定品目 <span className="required">必須</span>
                      </label>
                      <textarea
                        name="sellingItems"
                        required
                        rows={3}
                        placeholder="例：自家製味噌、旬の野菜セット、収穫体験ツアー など"
                      ></textarea>
                    </div>
                    <div className="form-group">
                      <label>
                        種類 <span className="required">必須</span>
                      </label>
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
                              required
                              checked={projectType === t}
                              onChange={() => setProjectType(t)}
                            />
                            {t}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="form-group">
                      <label>
                        目標金額 <span className="required">必須</span>
                      </label>
                      <input type="text" name="goalAmount" required placeholder="1,500,000（円）" />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>
                          募集開始希望日 <span className="required">必須</span>
                        </label>
                        <input
                          type="text"
                          name="recruitStartHope"
                          required
                          placeholder="2026年11月1日 / 未定"
                        />
                      </div>
                      <div className="form-group">
                        <label>
                          募集終了希望日 <span className="required">必須</span>
                        </label>
                        <input
                          type="text"
                          name="recruitEndHope"
                          required
                          placeholder="2026年12月31日 / 未定"
                        />
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
                      支援金のお振込先です。🔴<strong>プロジェクト起案者さまの関連する口座のみ</strong>が振込対象口座となります。
                      それ以外の口座はお受けできません。
                    </p>
                    <div className="form-row">
                      <div className="form-group">
                        <label>
                          銀行名 <span className="required">必須</span>
                        </label>
                        <input type="text" name="bankName" required placeholder="〇〇銀行" />
                      </div>
                      <div className="form-group">
                        <label>
                          支店名 <span className="required">必須</span>
                        </label>
                        <input type="text" name="bankBranch" required placeholder="〇〇支店" />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>
                          預金種別 <span className="required">必須</span>
                        </label>
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
                                required
                                checked={accountType === t}
                                onChange={() => setAccountType(t)}
                              />
                              {t}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="form-group">
                        <label>
                          口座番号 <span className="required">必須</span>
                        </label>
                        <input
                          type="text"
                          name="bankAccountNumber"
                          required
                          placeholder="1234567"
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>
                        口座名義 <span className="required">必須</span>
                      </label>
                      <input
                        type="text"
                        name="bankAccountHolder"
                        required
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
                      掲載概要および販売品目によっては、<strong>掲載をお受けできない場合がございます。</strong>
                      不可の場合の理由についてはお答えできませんので、あらかじめご了承ください。
                    </li>
                    <li>
                      支援金のお振込先は、<strong>プロジェクト起案者さまの関連する口座のみ</strong>が対象です。
                    </li>
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
