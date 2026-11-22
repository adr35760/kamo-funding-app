/**
 * トップページ（LP）の文言・数値・カード定義。
 *
 * 🔴 LP実装仕様書 v1.1（t ikuさん）§3.2 / §4 / §5 / §7 の文言を**そのまま**置く。
 *    ここを直せばページ全体に反映される（JSX側にコピーを直書きしない）。
 *
 * 🔴 数値は必ず既存の定数を参照する（直書き禁止）:
 *    - トップの実績数値（577件／約19.5億円／93.7%） → site-stats.ts
 *      （3ページ共通の StatsBanner と LP_TRUST が共有する唯一の情報源）
 *    - 紹介料率   → reward-calc.ts の REWARD_CONFIG.REFERRAL_REWARD_RATE
 *
 * 🔴 未確定のものは数字を作らない（§6 / §12）。伴走プロジェクト数は根拠が無いため
 *    表示しない（2026-11-08 t iku指示「確認済みの値のみ」）。
 */

import { CONSULT_URL, CONSULT_MINUTES } from './seminar-info-content';
import { REWARD_CONFIG } from './reward-calc';
import {
  SUPPORTED_PROJECTS_LABEL,
  TOTAL_RAISED_LABEL,
  ACHIEVEMENT_RATE_LABEL,
  STATS_PERIOD_NOTE,
  STATS_DEFINITION,
} from './site-stats';
import {
  PLATFORM_FEE_LABEL,
  PLATFORM_FEE_TAX_LABEL,
  PLATFORM_FEE_SHORT,
  PAYMENT_FEE_INCLUDED_NOTE,
  SUPPORT_PERIOD_LABEL,
} from './site-fees';

/** 万円未満を切り上げた「◯億◯,◯◯◯万円」表記（既存の実績表記と同じ切り上げ方針） */
export function formatManYen(amount: number): string {
  const man = Math.ceil(amount / 10_000);
  const oku = Math.floor(man / 10_000);
  const rest = man % 10_000;
  if (oku > 0 && rest > 0) return `${oku}億${rest.toLocaleString('ja-JP')}万円`;
  if (oku > 0) return `${oku}億円`;
  return `${man.toLocaleString('ja-JP')}万円`;
}

/** 紹介料率の表示（0.02 → 2%） */
function formatPercent(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}

// ===== Z1 ファーストビュー =====
export const LP_HERO = {
  /**
   * 2026-11-19 t iku指示: FVの左側コピーを全面差し替え。
   *   焼き込み見出しは画像から除去し、テキストはすべてHTMLで表示する。
   */
  image: '/lp/kv-hero-20261120.jpg',
  imageAlt: 'KAMOファンディングの担当者',
  eyebrow: '新商品・出版・店舗開業を、クラファンで実現したい方へ',
  title: 'その企画、クラファンでどう実現する？',
  sub: `目標金額・リターン・公開までの準備を、${CONSULT_MINUTES}分の無料相談で整理します。`,
  description:
    '資金だけでなく、あなたの企画を応援してくれるお客様とのつながりをつくるために。KAMOファンディングの担当者が企画を伺い、実施に向けた準備と費用の見通しをご案内します。',
  cta: `自分の企画を無料で相談する｜${CONSULT_MINUTES}分`,
  /** 2026-11-22 t iku指示: 本文側の相談CTAはすべてカレンダー予約に統一（CONSULT_URLのみ参照） */
  ctaHref: CONSULT_URL,
  /** 補助導線（説明会LPへ） */
  subCtaLead: '全体像を知りたい方へ',
  subCta: '無料説明会の日程を見る',
  subCtaHref: '/lp',
  // 2026-11-22 t iku回答: 手数料は公開（20%に決済手数料5%を含む）。有償サポートは個別見積もり
  note: `※相談は無料です。掲載手数料は${PLATFORM_FEE_SHORT}。有償サポートは個別にお見積もりします。`,
} as const;

// ===== Z1.5 3ステップ（クラファン→商品化→メンター支援） =====
export const LP_STEPS = {
  heading: 'クラファンから、その先の事業成長へ',
  /** 依頼文の3ステップをそのまま置く。future=true のものは「今後の構想」（提供開始前） */
  items: [
    {
      no: '01',
      title: 'クラファンで、最初のお客様と出会う',
      body:
        '新しい商品やサービスを先行販売し、売上をつくりながら、お客様の反応を確かめます。',
      future: false,
    },
    {
      no: '02',
      title: 'スキルや経験を、継続して販売する',
      body:
        '講座・個別相談・研修などを商品にし、販売ページ、予約、決済、顧客管理をオンラインで扱える仕組みを整えます。',
      future: true,
    },
    {
      no: '03',
      title: 'メンターとともに、事業を育てる',
      body:
        '約20社のメンター企業との連携を通じて、商品改善・集客・法人営業など、その時点の課題に合った専門家につなぎます。',
      future: true,
    },
  ],
  /** 提供前の機能と、いま相談できる内容を区別するための注記（PM補筆） */
  futureTag: '今後の構想',
  note:
    '「今後の構想」と記載した機能・支援は提供開始前です。現在ご相談いただける内容は、下記の4つの入り口からご確認ください。',
  /** 3ステップ直後に置く無料相談ボタン（文言はFVの主CTAと同じ） */
  cta: '新しい商品・サービスの売り方を相談する',
} as const;

// ===== Z2 共感 =====
export const LP_EMPATHY = {
  heading: 'その挑戦、一人で抱えていませんか。',
  body:
    '資金は足りない。売り方はわからない。最初のファンも、まだいない。クラウドファンディングは「資金調達」ではなく「最初のファンづくり」です。でも、ページづくり・集客・宣言まで、やることは山積み。',
  lead: 'だから、私たちは「挑戦そのもの」に寄り添う4つの入り口を用意しました。',
} as const;

// ===== Z3 分岐ハブ（4カード） =====
export interface LpCard {
  /** 入り口番号（1〜4）。計測の entrance と一致させる */
  id: 1 | 2 | 3 | 4;
  /** 番号バッジ（①②③④） */
  badge: string;
  image: string;
  heading: string;
  body: string;
  cta: string;
  note: string;
  /** カード下部の小さな注記（本文2文の制約を守るため本文とは分ける） */
  footnote?: string;
  /** 相談の入り口はすべてカレンダー予約（CONSULT_URL）／それ以外は各ページ */
  href: string;
}

export const LP_CARDS: LpCard[] = [
  {
    id: 1,
    badge: '①',
    image: '/lp/card1.jpg',
    heading: 'クラファンに挑戦したい',
    // 2026-11-22 t iku指示: 「目標達成100%を一緒に狙います」を差し替え
    // （約4か月の支援範囲は契約内容との一致を t iku 確認中。月数の表現は変えない）
    body: `企画設計からリターン、ページ制作、集客まで。目標達成に向けて、${SUPPORT_PERIOD_LABEL}間伴走します。`,
    footnote: '※プロジェクト例・支援者データを説明会で公開',
    cta: '相談する（無料）',
    note: '相談無料・最短24時間返信',
    // 2026-11-22 t iku指示: 個別相談の入口はカレンダー予約に一本化（フォームは下部に残す）
    href: CONSULT_URL,
  },
  {
    id: 2,
    badge: '②',
    image: '/lp/card2.jpg',
    heading: '挑戦者を紹介したい',
    body:
      '知り合いの挑戦を、そのまま応援に。案件をご紹介いただき成立すると、紹介料をお支払いします。リピート案件も対象。',
    cta: '紹介パートナー登録',
    note: `紹介料${formatPercent(REWARD_CONFIG.REFERRAL_REWARD_RATE)}・リピート還元あり`,
    href: '/partners',
  },
  {
    id: 3,
    badge: '③',
    image: '/lp/card3.jpg',
    heading: 'アドバイザーで働きたい',
    body:
      'クラファンの知識を、あなたの働き方に。認定講座の修了後、副業・独立どちらでも活躍できます。',
    cta: '講座説明会を予約',
    note: 'オンライン開催・60分',
    // TODO(t iku確定待ち): 本来は講座説明会の予約カレンダーURL。現在は暫定で既存の告知ページ。
    href: '/partner-session-announce',
  },
  {
    id: 4,
    badge: '④',
    // 2026-11-08 t iku指示: ④はFOEX公式のバナー画像に差し替え
    image: '/lp/card4-expo.jpg',
    heading: 'スタートアップEXPOに出展したい',
    body:
      // 2026-11-08 t iku指示: 外部サイトへ直接送るため、資料送付を約束する文言を外す
      '製品を届けたい決裁者が、会場に集まる。出展の概要・スケジュール・費用は、公式サイトでご確認いただけます。',
    cta: 'スタートアップEXPOを見る',
    // 2026-11-08 t iku指示: ④は公式サイト（FOEX STARTUP）へ直接送る。
    note: '公式サイトが開きます',
    href: 'https://foex.online/startup/',
  },
];

// ===== 実績数値（2026-11-21 t iku指定） =====
/**
 * 🔴 実績数値は src/lib/site-stats.ts が唯一の情報源。
 *    トップのバナー（StatsBanner）・下部の実績欄（LP_TRUST）・メタdescription は
 *    すべてそこを参照する（このファイルにも各ページにも数値を直書きしない）。
 *    旧値（16億8,752万円／95%）はトップでは使わない。
 */
export {
  SUPPORTED_PROJECTS,
  TOTAL_RAISED_ALL,
  ACHIEVEMENT_RATE,
  RAISED_BREAKDOWN,
  SUPPORTED_PROJECTS_LABEL,
  TOTAL_RAISED_LABEL,
  ACHIEVEMENT_RATE_LABEL,
  formatOkuYen,
} from './site-stats';

// ===== Z4 信頼性 =====
export const LP_TRUST = {
  /** 2026-11-21 t iku指示: 下部の実績欄も新数値（577件／約19.5億円／93.7%）に統一 */
  countLabel: SUPPORTED_PROJECTS_LABEL,
  countNote: '5年間の支援実績（両サービス合計）',
  rateLabel: ACHIEVEMENT_RATE_LABEL,
  // 2026-11-22 t iku指示: 93.7%はKAMOファンディング単独。平均とは書かない
  rateNote: 'KAMOファンディングの目標達成率',
  raisedLabel: TOTAL_RAISED_LABEL,
  raisedNote: '両サービスの累計支援総額',
  /**
   * 2026-11-08 t iku指示: 実績数値には定義を添え、確認済みの値だけを載せる。
   *   未確定の「伴走プロジェクト数」は表示しない（実績準備中も置かない）。
   * 2026-11-21 t iku指示: 集計期間（直近5年間）を明記。内訳の説明はバナー側にだけ足す。
   * 2026-11-22 t iku指示: バナーと同じ注記（両サービス合算・内訳・KAMO単独の93.7%）に統一。
   */
  source: `${STATS_PERIOD_NOTE}${STATS_DEFINITION}`,
} as const;

// ===== Z3.5 成功事例への案内（2026-11-22 t iku指示: 実績の直後に追加） =====
/**
 * 事例の本文・画像・金額は src/lib/success-cases.ts が正。
 * ここでは「どの事例を、どの分野名で出すか」だけを持つ（数値は直書きしない）。
 */
export const LP_SUCCESS = {
  heading: '成功事例',
  /** 2行に分けて読ませる（1行だと日本語が不自然な位置で折り返すため） */
  leadLines: [
    '新商品、店舗開業、出版。',
    'あなたに近い挑戦の記録から、実現までの道のりを見てください。',
  ],
  lead: '新商品、店舗開業、出版。あなたに近い挑戦の記録から、実現までの道のりを見てください。',
  cta: '成功事例を見る',
  href: '/success',
  /** 2026-11-22 t iku指示: 事例の下に相談ボタンを置き、カレンダー予約へ統一 */
  consultCta: '自分の企画も無料で相談する',
  consultNote: `オンライン・${CONSULT_MINUTES}分・相談無料`,
  items: [
    { slug: 'tenmeikaika', label: '新商品' },
    { slug: 'akahoshi', label: '店舗開業' },
    { slug: 'nakajima01', label: '出版' },
  ],
} as const;

// ===== Z3.6 支援内容・掲載までの流れ・費用（2026-11-22 t iku承認） =====
/**
 * 🔴 掲載手数料・期間は src/lib/site-fees.ts の定数から組み立てる（直書き禁止）。
 *    手数料は利用規約 第4条と一致（総支援金額の20%・税別・その他の費用は無料）。
 *    有償サポートは「支援内容に応じて個別にお見積もり」。
 *    決済手数料5%は掲載手数料20%に含まれる（別途上乗せの書き方はしない）。
 */
export const LP_SUPPORT = {
  heading: '支援内容・掲載までの流れ・費用',
  lead: '掲載が決まったあとも、企画から公開、期間終了まで一緒に走ります。',
  servicesHeading: '支援内容',
  services: [
    {
      icon: 'kamo-icon-pen',
      title: '企画設計',
      body: '誰に何を届けるか、目標金額と期間を一緒に設計します。',
    },
    {
      icon: 'kamo-icon-gift',
      title: 'リターン設計',
      body: '支援してくれる人が選びやすいリターンを組み立てます。',
    },
    {
      icon: 'kamo-icon-monitor',
      title: 'ページ制作',
      body: '想いと企画が伝わるプロジェクトページを作ります。',
    },
    {
      icon: 'kamo-icon-megaphone',
      title: '集客',
      body: '公開前から、応援してくれる人を集める準備を進めます。',
    },
  ],
  servicesNote: `この4つを、公開までの${SUPPORT_PERIOD_LABEL}間いっしょに進めます。`,

  /** 費用ブロックの下に置く告知（2026-11-22 t iku指示・黒×金で装飾） */
  eventNote: {
    title: 'ビジネス交流会・鴨頭嘉人特別参加会',
    place: '池袋開催・懇親会は有料です',
  },
  /**
   * 2026-11-22 t iku指示: 主導線は個別相談が先。4ステップに並べ替える。
   * 🔴 説明会の所要時間（分数）は書かない（新形式の所要時間が未確定のため）。
   *    個別相談の分数は CONSULT_MINUTES を参照する。
   */
  flowHeading: '掲載までの流れ',
  flow: [
    {
      title: '無料個別相談',
      body: `企画内容・目標金額・必要な準備を、${CONSULT_MINUTES}分のオンライン相談で整理します。`,
    },
    {
      title: '無料掲載説明会',
      body: '掲載の仕組みと進め方を、オンラインの説明会でご案内します（参加費無料）。',
    },
    {
      title: '掲載申込・企画準備',
      body: '企画設計・リターン設計・ページ制作まで、公開に向けて一緒に進めます。',
    },
    {
      title: 'プロジェクト公開',
      body: '公開後も、期間終了まで伴走します。',
    },
  ],
  flowNote: '※正式掲載には無料掲載説明会への参加が必要です。',
  feeHeading: '費用',
  fees: [
    {
      label: '掲載手数料',
      value: `支援総額の${PLATFORM_FEE_LABEL}（${PLATFORM_FEE_TAX_LABEL}）`,
      note: `${PAYMENT_FEE_INCLUDED_NOTE}。プロジェクトの掲載時にかかり、手数料に対する消費税が別途かかります。`,
    },
    {
      label: 'その他の費用',
      value: '無料',
      note: '掲載にあたってのその他の費用はかかりません。',
    },
    {
      label: '有償サポート',
      value: '支援内容に応じて個別にお見積もり',
      note: '必要な場合のみ。無理におすすめはしません。',
    },
    {
      label: '無料相談・無料説明会',
      value: '参加費無料',
      note: '相談・説明会では費用はかかりません。',
    },
  ],
  /**
   * 2026-11-22 t iku指示: 費用の直後に置く唯一のCTA（これ以上セクションを増やさない）。
   * ボタンの行き先は 個別相談=カレンダー予約 / 説明会=日程。
   */
  ctaHeading: 'あなたの企画を、実現への一歩に。',
  ctaBody:
    'クラファンが初めてでも大丈夫です。企画内容や目標金額、必要な準備について、一緒に整理しましょう。',
  ctaConsult: '実現したい企画がある方',
  ctaConsultNote: 'オンライン・相談無料',
  ctaSeminar: 'まずは仕組みや進め方を知りたい方',
  ctaSeminarNote: 'オンライン・参加無料',
  ctaSeminarHref: '/seminar-info#schedule',
} as const;

// ===== Z5 最終CTA / Z6 追従CTA =====
/**
 * Z5 最終CTA。
 * 補足文の所要時間は仕様書§7が「30分」だが、実際の予約枠は CONSULT_MINUTES=45 のため
 * page.tsx 側で定数から組み立てる（PM判断 2026-10-27・t ikuさん確認中）。
 */
export const LP_FINAL = {
  cta: 'まずは無料相談から →',
} as const;

export const LP_FOLLOW = {
  pc: '無料相談を申し込む →',
  sp: '無料相談はこちら',
} as const;

// ===== 相談フォーム（§10）=====
export const LP_FORM = {
  /**
   * 2026-11-22 t iku指示: フォームは残し、位置づけを「予約前の質問窓口」に変える。
   * 送信処理（/api/consult）は変更しない。
   */
  heading: '日時を決める前に質問したい方はこちら',
  lead: '日時が決まっていなくても、まず質問だけ送れます。',
  submit: 'この内容で送信する',
  submitting: '送信中…',
  consent: 'プライバシーポリシーに同意します',
  doneHeading: 'お申し込みありがとうございます',
  doneBody:
    '内容を受け付けました。確認メールをお送りしましたので、ご確認ください。担当者より、最短24時間以内にご連絡します。',
} as const;
