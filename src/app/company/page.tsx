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
