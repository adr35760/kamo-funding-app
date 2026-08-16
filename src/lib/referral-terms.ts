/**
 * 紹介料規約（暫定版）
 *
 * サイト内の既存記載（総支援金額(税抜)の2% / 募集終了時に明細発行 /
 * 終了月の翌々月末に指定口座へ入金）をベースに作成。
 * 確定版が用意され次第、この定数を差し替えれば
 * フォーム表示・確認メールの両方に反映される。
 */

export const REFERRAL_TERMS_VERSION = '1.1（暫定版）';

export const REFERRAL_TERMS_TITLE = 'KAMOファンディング 紹介料規約';

/** body の各項は文字列（=項）、または項＋号（items）の組で表現する */
export type TermsClause = string | { text: string; items: string[] };
export type TermsArticle = { heading: string; body: TermsClause[] };

/** 改定履歴 */
export const REFERRAL_TERMS_HISTORY: { version: string; date: string; summary: string }[] = [
  { version: '1.1（暫定版）', date: '2026-08-17', summary: '第2条に紹介成立の要件（初回掲載であること／紹介時点で鴨Bizメンバーでないこと）を追加' },
  { version: '1.0（暫定版）', date: '2026-08-17', summary: '初版' },
];

export const REFERRAL_TERMS: TermsArticle[] = [
  {
    heading: '第1条（目的）',
    body: [
      '本規約は、KAMOファンディング（以下「当社」）の紹介パートナー（以下「パートナー」）が、クラウドファンディング掲載の候補者（以下「紹介者」）を当社に紹介する場合の条件および紹介料の取扱いについて定めるものです。',
    ],
  },
  {
    heading: '第2条（紹介の成立）',
    body: [
      'パートナーは、当社が発行する固有の紹介コードを用いて紹介者を登録するものとします。',
      '紹介コード経由で登録された紹介は、システムにより自動的に当該パートナーの紹介として紐付けられます。',
      {
        text: '紹介は、紹介者が次の各号のいずれにも該当する場合に成立するものとします。',
        items: [
          'KAMOファンディングへ初めて掲載する方であること',
          '紹介時点において鴨Bizメンバーでないこと',
        ],
      },
      '同一の紹介者が複数のパートナーから登録された場合、先に登録された紹介を有効とします。',
    ],
  },
  {
    heading: '第3条（紹介料の額）',
    body: [
      '紹介料は、紹介者のクラウドファンディングプロジェクトにおける総支援金額（税抜）の2%とします。',
      '例：総支援金額100万円の場合は2万円、1,000万円の場合は20万円。',
      '対象金額は「支援総額 − 手数料 ＋ 税金」に基づき算出します。',
    ],
  },
  {
    heading: '第4条（紹介料の確定と明細）',
    body: [
      '紹介料は、紹介した企業のクラウドファンディング掲載が完了し、募集が終了した時点で確定します。',
      '確定時点で、当社はパートナーの登録メールアドレス宛に紹介料の明細を発行します。',
      '募集が成立しなかった場合、または掲載に至らなかった場合、紹介料は発生しません。',
    ],
  },
  {
    heading: '第5条（支払方法・時期）',
    body: [
      '当社は、確定した紹介料を、募集終了月の翌々月末までにパートナーが指定する金融機関口座へ振り込む方法により支払います。',
      '振込手数料は当社が負担します。',
      'パートナーが指定した口座情報に誤りがあった場合の再振込に係る費用は、パートナーの負担とします。',
    ],
  },
  {
    heading: '第6条（パートナーの遵守事項）',
    body: [
      'パートナーは、紹介にあたり虚偽または誇大な説明を行ってはなりません。',
      'パートナーは、当社の事前の承諾なく、当社の商標・ロゴ・名称を使用してはなりません。',
      'パートナーは、紹介者本人の同意を得たうえで紹介者の情報を登録するものとします。',
      '法令または公序良俗に反する方法での勧誘・営業行為を禁止します。',
    ],
  },
  {
    heading: '第7条（個人情報の取扱い）',
    body: [
      '当社は、登録された紹介者の情報を、本規約に基づく紹介業務および連絡の目的にのみ利用します。',
      'パートナーは、紹介者の情報を本規約の目的以外に利用または第三者へ提供してはなりません。',
    ],
  },
  {
    heading: '第8条（規約の変更）',
    body: [
      '当社は、必要に応じて本規約を変更することがあります。',
      '変更後の規約は、当社が別途定める場合を除き、当社ウェブサイトに掲示した時点から効力を生じます。',
    ],
  },
  {
    heading: '第9条（反社会的勢力の排除）',
    body: [
      'パートナーは、自己が反社会的勢力に該当しないことを表明し、将来にわたっても該当しないことを確約します。',
      'これに反することが判明した場合、当社は催告なく本規約に基づく関係を解除し、紹介料の支払いを拒むことができます。',
    ],
  },
];

/** プレーンテキスト表現（管理・控え用） */
export function referralTermsPlainText(): string {
  const lines = [`${REFERRAL_TERMS_TITLE}（version ${REFERRAL_TERMS_VERSION}）`, ''];
  for (const a of REFERRAL_TERMS) {
    lines.push(a.heading);
    a.body.forEach((b, i) => {
      if (typeof b === 'string') {
        lines.push(`  ${i + 1}. ${b}`);
      } else {
        lines.push(`  ${i + 1}. ${b.text}`);
        b.items.forEach((it, j) => lines.push(`     (${j + 1}) ${it}`));
      }
    });
    lines.push('');
  }
  return lines.join('\n');
}

/** メール本文用のHTML表現 */
export function referralTermsHtml(): string {
  const articles = REFERRAL_TERMS.map(
    (a) => `
      <div style="margin-bottom: 14px;">
        <p style="margin: 0 0 4px; font-weight: 700; color: #0B1D3A; font-size: 14px;">${a.heading}</p>
        <ol style="margin: 0; padding-left: 18px; font-size: 13px; color: #444; line-height: 1.7;">
          ${a.body.map((b) => typeof b === 'string'
            ? `<li>${b}</li>`
            : `<li>${b.text}<ol style="margin: 6px 0 0; padding-left: 18px; list-style: none;">${b.items.map((it, j) => `<li style="margin-bottom: 2px;">(${j + 1}) ${it}</li>`).join('')}</ol></li>`
          ).join('')}
        </ol>
      </div>`
  ).join('');
  return `
    <div style="margin-top: 20px; padding: 20px; background: #fff; border: 1px solid #E0E0E0; border-radius: 8px;">
      <p style="margin: 0 0 4px; font-weight: 900; font-size: 16px; color: #0B1D3A;">${REFERRAL_TERMS_TITLE}</p>
      <p style="margin: 0 0 16px; font-size: 12px; color: #999;">version ${REFERRAL_TERMS_VERSION}</p>
      ${articles}
    </div>`;
}
