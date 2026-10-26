/**
 * 紹介パートナーが配る「文面テンプレ」。
 *
 * 完了メール（sendPartnerConfirmationEmail）と、パートナー登録完了画面の両方で使う。
 * 🔴 同じ文面を2箇所に書かない（片方だけ直して食い違うのを防ぐ）。
 * 🔴 数値（支援実績・達成率）は seminar-info-content.ts を参照する。
 *    サイト側だけ更新されて、メールが古い数字を配る事故を防ぐ。
 */

import { NUM_JISSEKI, NUM_TASSEI_RATE } from './seminar-info-content';
import { referralShareUrl } from './referral-link';

/**
 * メール・LINEでそのまま送れる文面。
 * 共有リンクは行の途中で折り返さない（コピーした文字列が壊れないように）。
 */
export function buildReferralShareMessage(name: string, code: string, origin?: string): string {
  return [
    '件名：クラウドファンディング 無料説明会のご案内',
    '',
    `はじめまして、${name}です。`,
    '',
    'KAMOファンディングの掲載説明会（オンライン・無料）のご案内です。',
    'クラウドファンディングでの資金調達をご検討中でしたら、',
    '掲載の可否や目標金額・スケジュールの決め方を直接お伝えしています。',
    `（累計支援実績${NUM_JISSEKI}・達成率${NUM_TASSEI_RATE}の担当者が対応します）`,
    '',
    '▼ お申し込みはこちらのリンクから',
    referralShareUrl(code, origin),
    '',
    'ご興味ありそうな方がいらっしゃいましたら、ぜひおつなぎください。',
    '',
    `─ ${name}`,
  ].join('\n');
}

/** SNS・短いメッセージ向けの1文（コピペ用） */
export function buildReferralShortMessage(name: string, code: string, origin?: string): string {
  return (
    'クラファン掲載をお考えの方へ。KAMOファンディングの無料オンライン説明会（60分）で、' +
    `掲載の可否や目標金額の決め方が分かります（累計支援実績${NUM_JISSEKI}・達成率${NUM_TASSEI_RATE}）。` +
    `▼お申し込み ${referralShareUrl(code, origin)}`
  );
}
