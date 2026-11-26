/**
 * 運営会社情報（/company）。
 *
 * 🔴 数字・固有名詞は**一次情報から転記**した。推測で書かない。
 *   - 株式会社東京カモガシラランド: 公式サイト kamogashira.com/company/ および
 *     kamogashira.com/business-overview/（2026-11-25 取得）
 *   - 合同会社LOCALCREATION: local-creation.com（2026-11-25 取得）と
 *     旧KAMOファンディングサイト kamofunding.com/company、特商法表記（legal-docs.ts）
 *
 * 確認済み（2026-11-26 t iku回答・食い違い解消）:
 *   - LOCALCREATION の電話番号は 078-576-1030 で確定（特商法表記 legal-docs.ts と一致）。
 *     旧サイト kamofunding.com の 078-576-0400 は誤記載として扱う。値の正はこの1箇所
 *     （AGENCY_COMPANY.tel）と legal-docs.ts の2箇所だけに持つ。
 *   - LOCALCREATION の設立年月日・資本金は一次情報が無いため載せていない。
 */

export interface CompanyBusiness {
  /** 事業名 */
  title: string;
  /** 1行の説明 */
  detail: string;
}

export interface CompanyProfile {
  name: string;
  /** 英語表記（任意） */
  nameEn?: string;
  /** 何の会社か（1行） */
  role: string;
  address: string;
  tel: string;
  /** 設立日（一次情報がある場合のみ） */
  established?: string;
  /** 資本金（一次情報がある場合のみ） */
  capital?: string;
  /** 代表・責任者（肩書つき。上から表示） */
  officers: { title: string; name: string }[];
  /** 事業内容 */
  businesses: CompanyBusiness[];
}

/** KAMOファンディングの運営会社 */
export const OPERATOR_COMPANY: CompanyProfile = {
  name: '株式会社東京カモガシラランド',
  nameEn: 'Tokyo Kamogashira Land Co., Ltd.',
  role: 'KAMOファンディングの運営会社',
  address: '〒171-0022 東京都豊島区南池袋1-26-6 The SH one ビル6階（Tokyo Education Gallery）',
  tel: '03-6912-8383',
  established: '2010年9月24日',
  capital: '26,000,000円',
  officers: [
    { title: '代表取締役', name: '鴨頭 嘉人' },
    { title: '運営責任者', name: '佐藤 弘樹' },
    { title: '運営責任者', name: '生島 正' },
  ],
  businesses: [
    {
      title: '教育・研修事業',
      detail:
        '「話し方の学校」「ビジネス脳トレ速読」の運営、企業・団体向けの研修・講演、経営者向けエグゼクティブコンサルティング',
    },
    {
      title: 'コミュニティ事業',
      detail: 'オンラインサロン「鴨Biz」の運営',
    },
    {
      title: '飲食事業',
      detail: 'YAKINIKUMAFIA IKEBUKURO の運営',
    },
    {
      title: 'フランチャイズ事業',
      detail: '学習・教育分野のノウハウを地域へ届けるフランチャイズ展開',
    },
    {
      title: 'メディア・プラットフォーム事業',
      detail: 'YouTube・音声・出版などの発信と、KAMOファンディングの運営',
    },
  ],
};

/** 運営業務の委託先 */
export const AGENCY_COMPANY: CompanyProfile = {
  name: '合同会社LOCALCREATION',
  role: 'KAMOファンディングの運営業務の委託先',
  address: '兵庫県神戸市兵庫区湊町4丁目2-12-211',
  tel: '078-576-1030',
  officers: [{ title: '代表', name: '生島 正' }],
  businesses: [
    {
      title: 'クラウドファンディング活用支援事業',
      detail:
        '起案者への掲載支援・コンサルティング。まちづくり・地域ビジネス・起業の資金調達を支援',
    },
    {
      title: 'セミナー・イベント事業',
      detail: 'クラウドファンディングに関する講演・セミナー・相談会の開催および共催',
    },
    {
      title: 'アドバイザー育成',
      detail: 'クラウドファンディングアドバイザー・コンサルタントの募集と育成',
    },
  ],
};

/** お問い合わせ先（サイト内の窓口に一本化する） */
export const COMPANY_CONTACT_EMAIL = 'info@local-creation.com';
