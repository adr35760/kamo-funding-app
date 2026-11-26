import type { Metadata } from 'next';
import '@/styles/supporter-register.css';
import '@/styles/company.css';
import SiteHeader from '@/components/SiteHeader';
import LegalFooter from '@/components/LegalFooter';
import {
  AGENCY_COMPANY,
  COMPANY_CONTACT_EMAIL,
  OPERATOR_COMPANY,
} from '@/lib/company';

export const metadata: Metadata = {
  title: '運営会社｜KAMOファンディング',
  description:
    'KAMOファンディングの運営会社（株式会社東京カモガシラランド）と、運営業務の委託先（合同会社LOCALCREATION）の会社概要・事業内容を掲載しています。',
};

/**
 * 運営会社情報のページ（公開・認証なし）。
 *
 * 2026-11-25 t iku指示:「運営会社情報も掲載しなくていいですか？」「事業内容も載せてください」
 * → EC・決済を含むサイトで運営主体が分かるページが無かったため新設。
 *   全ページのフッター（components/LegalFooter.tsx）からリンクする。
 *
 * 🔴 数字・固有名詞は src/lib/company.ts の1箇所が正。ここに直接書かない。
 */
export default function CompanyPage() {
  const companies = [OPERATOR_COMPANY, AGENCY_COMPANY];
  return (
    <div className="company-page">
      <SiteHeader current="/company" />

      <section className="hero">
        <div className="container">
          <div className="hero-badge">運営会社</div>
          <h1>
            運営<span className="gold">会社情報</span>
          </h1>
          <p>
            KAMOファンディングは、株式会社東京カモガシラランドが運営し、
            <br />
            合同会社LOCALCREATIONが運営業務を受託しています。
          </p>
        </div>
      </section>

      <section className="company-body">
        <div className="container">
          {companies.map((c) => (
            <div className="company-card" key={c.name}>
              <p className="company-role">{c.role}</p>
              <h2>{c.name}</h2>
              {c.nameEn ? <p className="company-name-en">{c.nameEn}</p> : null}

              <table className="company-table">
                <tbody>
                  <tr>
                    <th scope="row">所在地</th>
                    <td>{c.address}</td>
                  </tr>
                  <tr>
                    <th scope="row">電話番号</th>
                    <td>{c.tel}</td>
                  </tr>
                  {c.established ? (
                    <tr>
                      <th scope="row">設立</th>
                      <td>{c.established}</td>
                    </tr>
                  ) : null}
                  {c.capital ? (
                    <tr>
                      <th scope="row">資本金</th>
                      <td>{c.capital}</td>
                    </tr>
                  ) : null}
                  {c.officers.map((o) => (
                    <tr key={`${c.name}-${o.title}-${o.name}`}>
                      <th scope="row">{o.title}</th>
                      <td>{o.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3 className="company-biz-title">事業内容</h3>
              <ul className="company-biz-list">
                {c.businesses.map((b) => (
                  <li key={`${c.name}-${b.title}`}>
                    <span className="company-biz-name">{b.title}</span>
                    <span className="company-biz-detail">{b.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="company-card profile-card">
            <div className="profile-head">
              <img
                src="/profile-ikushima.jpg"
                alt="合同会社LOCALCREATION 代表 生島 正"
                className="profile-photo"
                width={240}
                height={240}
              />
              <div className="profile-head-text">
                <p className="company-role">代表プロフィール</p>
                <h2>生島 正</h2>
                <p className="profile-kana">いくしま ただし</p>
                <p className="profile-title">
                  合同会社LOCALCREATION 代表
                  <br />
                  KAMOファンディング 運営責任者
                </p>
              </div>
            </div>

            <p className="profile-lead">
              「社会から応援されるプロジェクトを創出する」をミッションに、
              2014年からクラウドファンディングの活用支援に取り組んでいます。
              現在はYouTube講演家の鴨頭嘉人さんとともにKAMOファンディングを運営し、
              起案者の想いを伝わる企画に変え、支援が集まるまでの道のりを伴走しています。
            </p>

            <h3 className="company-biz-title">略歴</h3>
            <ul className="profile-history">
              <li>
                <span className="profile-year">2014年</span>
                地域クラウドファンディング「FAAVO兵庫」を立ち上げ、クラウドファンディングのアドバイス事業を開始
              </li>
              <li>
                <span className="profile-year">2016年</span>
                CAMPFIREと提携し「CAMPFIRE × LOCAL×HYOGO」を運営
              </li>
              <li>
                <span className="profile-year">2017年</span>
                神戸市中央区とまちづくりクラウドファンディング事業を開始
              </li>
              <li>
                <span className="profile-year">2024年</span>
                自身のクラウドファンディングで初の著書『最新版！クラウドファンディングの教科書』（鴨ブックス）を出版
              </li>
              <li>
                <span className="profile-year">現在</span>
                合同会社LOCALCREATION 代表としてKAMOファンディングの運営を担当
              </li>
            </ul>

            <h3 className="company-biz-title">発信・メディア</h3>
            <ul className="profile-media">
              <li>
                <a
                  href="https://www.youtube.com/@crowdfunding-sp"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  YouTube「クラウドファンディングの学校」
                </a>
                <span>
                  チャンネル登録者 約42万人。クラウドファンディングの基礎、集め方、企画の立て方を発信
                </span>
              </li>
              <li>
                <a href="https://voicy.jp/channel/959827" target="_blank" rel="noopener noreferrer">
                  Voicy「クラウドファンディングの学校」
                </a>
                <span>パーソナリティとして、明日から使える企画・言葉・導線の具体策を配信</span>
              </li>
            </ul>
          </div>

          <div className="company-contact">
            <h2>お問い合わせ</h2>
            <p>
              サービスについてのご質問、掲載・支援のご相談、取材・メディア掲載のご依頼は、
              お問い合わせフォームからお送りください。
            </p>
            <a className="company-contact-btn" href="/contact">
              質問・問い合わせ・取材依頼はこちら →
            </a>
            <p className="company-contact-note">
              メールでのご連絡先：<a href={`mailto:${COMPANY_CONTACT_EMAIL}`}>{COMPANY_CONTACT_EMAIL}</a>
            </p>
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
