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
 * 🔴 未確定のものは数字を作らない（§6 / §12）。支援実績（伴走プロジェクト数）は
 *    「実績準備中」を表示し、実数が確定したら LP_TRUST.projectsLabel を差し替える。
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
export const LP_HERO = {
  /** KVは画像内にコピーが焼き込み済み。HTML側では大見出しを再表示しない（§3.2） */
  image: '/lp/kv.jpg',
  imageAlt: '挑戦を、加速させろ。クラファンのプロが伴走します',
  /** KV下段の上書きコピー（4つの入り口を最初に宣言する） */
  lead: ['挑戦者・紹介者・アドバイザー・出展企業——', 'すべての挑戦に、4つの入り口。'],
  cta: 'クラファン無料相談 →',
  note: '相談無料／最短24時間返信',
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
    cta: '無料相談フォームへ',
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
      'クラファンの知識を、あなたの働き方に。認定講座（第◯期・限定◯名）修了後、副業・独立どちらでも活躍できます。',
    cta: '講座説明会を予約',
    note: 'オンライン開催・60分',
    // TODO(t iku確定待ち): 本来は講座説明会の予約カレンダーURL。現在は暫定で既存の告知ページ。
    href: '/partner-session-announce',
  },
  {
    id: 4,
    badge: '④',
    image: '/lp/card4.jpg',
    heading: 'スタートアップEXPOに出展したい',
    body:
      '製品を届けたい決裁者が、会場に集まる。出展概要・ブース構成・費用をまとめた資料を無料でお届けします。',
    cta: '出展資料をダウンロード',
    // TODO(t iku確定待ち): 本来は資料DL＋メルマガ登録。資料PDF未受領のため暫定で相談フォーム（区分=EXPO）。
    note: '資料はPDF・全◯ページ',
    href: '#consult',
    consult: CONSULT_CATEGORIES[3],
  },
];

// ===== Z4 信頼性 =====
export const LP_TRUST = {
  projectsLabel: '実績準備中',
  projectsNote: '伴走プロジェクト数',
  rateLabel: NUM_TASSEI_RATE,
  rateNote: 'プロジェクト達成率',
  raisedLabel: formatManYen(CUMULATIVE_RAISED_ALL),
  raisedNote: '自社関与プロジェクトの合計',
  source:
    '累計調達額は自社関与プロジェクトの合計（万円未満切り上げ）。平均達成率は掲載プロジェクトの目標達成率の平均です。支援実績（伴走プロジェクト数）は集計中のため、確定まで表示しません。',
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
  pc: 'クラファン無料相談 →',
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
