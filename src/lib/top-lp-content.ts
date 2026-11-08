/**
 * トップページ（LP）の文言・数値・カード定義。
 *
 * 🔴 LP実装仕様書 v1.1（t ikuさん）§3.2 / §4 / §5 / §7 の文言を**そのまま**置く。
 *    ここを直せばページ全体に反映される（JSX側にコピーを直書きしない）。
 *
 * 🔴 数値は必ず既存の定数を参照する（直書き禁止）:
 *    - 累計調達額 → success-cases.ts の CUMULATIVE_RAISED_ALL
 *    - 平均達成率 → seminar-info-content.ts の NUM_TASSEI_RATE
 *    - 紹介料率   → reward-calc.ts の REWARD_CONFIG.REFERRAL_REWARD_RATE
 *
 * 🔴 未確定のものは数字を作らない（§6 / §12）。伴走プロジェクト数は根拠が無いため
 *    表示しない（2026-11-08 t iku指示「確認済みの値のみ」）。
 */

import { CUMULATIVE_RAISED_ALL } from './success-cases';
import { NUM_TASSEI_RATE } from './seminar-info-content';
import { REWARD_CONFIG } from './reward-calc';
import { CONSULT_CATEGORIES, type ConsultCategory } from './consult-shared';

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
/**
 * 2026-11-08 t iku指示（新事業方針）:
 *   メインコピー・サブコピー・説明文・主CTA・補助CTAをHTMLで表示する。
 *   文言は依頼文のまま（一字も変えない）。
 */
export const LP_HERO = {
  /**
   * KVから**文字が焼き込まれている左側を除いた右側**を切り出した写真。
   * ヒーローはHTMLのコピーを主役にするため、画像は写真だけを使う
   * （元のKV `kv.jpg` は他の用途のために残す）。
   */
  image: '/lp/kv-hero.jpg',
  imageAlt: 'KAMOファンディングの担当者',
  title: '挑戦を、加速させろ。',
  sub: 'あなたのできることを、応援される事業へ。',
  description:
    '新しい商品やサービスを、クラウドファンディングで最初のお客様に届ける。KAMOファンディングは、企画づくりから先行販売、ファンづくりまで、あなたの挑戦に伴走します。',
  cta: '新しい商品・サービスの売り方を相談する',
  /** 補助ボタン（掲載説明会LPへ） */
  subCta: '掲載説明会を見る',
  subCtaHref: '/lp',
  note: '相談無料／最短24時間返信',
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
  /** '#consult' は同一ページ内の相談フォームへ */
  href: string;
  /** フォームへ送る場合、相談区分を初期選択する */
  consult?: ConsultCategory;
}

export const LP_CARDS: LpCard[] = [
  {
    id: 1,
    badge: '①',
    image: '/lp/card1.jpg',
    heading: 'クラファンに挑戦したい',
    body: '企画・ページ制作・集客まで、約4ヶ月間プロが伴走。目標達成100%を一緒に狙います。',
    footnote: '※プロジェクト例・支援者データを説明会で公開',
    cta: '相談する（無料）',
    note: '相談無料・最短24時間返信',
    href: '#consult',
    consult: CONSULT_CATEGORIES[0],
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

// ===== Z4 信頼性 =====
export const LP_TRUST = {
  rateLabel: NUM_TASSEI_RATE,
  rateNote: '掲載プロジェクトの平均達成率',
  raisedLabel: formatManYen(CUMULATIVE_RAISED_ALL),
  raisedNote: '関与プロジェクトの累計支援総額',
  /**
   * 2026-11-08 t iku指示: 実績数値には定義を添え、確認済みの値だけを載せる。
   *   未確定の「伴走プロジェクト数」は表示しない（実績準備中も置かない）。
   *   数値は既存定数のみ（直書き禁止）。
   */
  source:
    '累計調達額は、KAMOファンディングが関与したプロジェクトの累計支援総額です（万円未満切り上げ）。平均達成率は、掲載プロジェクトの目標達成率の平均です。',
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
  heading: '無料相談のお申し込み',
  lead: '下記フォームにご入力ください。担当者より、最短24時間以内にご連絡します。',
  submit: 'この内容で送信する',
  submitting: '送信中…',
  consent: 'プライバシーポリシーに同意します',
  doneHeading: 'お申し込みありがとうございます',
  doneBody:
    '内容を受け付けました。確認メールをお送りしましたので、ご確認ください。担当者より、最短24時間以内にご連絡します。',
} as const;
