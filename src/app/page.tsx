import type { Metadata } from 'next';
import TopLandingPage from '@/components/TopLandingPage';
import { formatManYen } from '@/lib/top-lp-content';
import { CUMULATIVE_RAISED_ALL } from '@/lib/success-cases';
import { NUM_TASSEI_RATE } from '@/lib/seminar-info-content';

/**
 * トップページ（/）。
 *
 * 🔴 ここは**サーバーコンポーネント**。理由は `/` だけ title / description を
 *    差し替えるため（2026-10-27 PM指示）。
 *    layout.tsx の metadata は全ページ共通なので触らない。ページ側で metadata を
 *    持つと、そのページだけが上書きされる（Next.js の仕様）。
 *    画面本体は components/TopLandingPage.tsx（'use client'）に分離してある。
 *
 * 数値は必ず既存の定数から組み立てる（直書き禁止）:
 *   CUMULATIVE_RAISED_ALL = 1,687,515,999 → 16億8,752万円（万円未満切り上げ）
 *   NUM_TASSEI_RATE = 95%
 */

const RAISED_LABEL = formatManYen(CUMULATIVE_RAISED_ALL);

/** タブタイトル・検索結果・SNS共有で同じ文言を使う（1箇所で管理） */
const LP_TITLE = 'KAMOファンディング｜クラファン無料相談・挑戦を加速させる伴走支援';
// 検索結果で切れない長さ（約100字）に収める
const LP_DESCRIPTION =
  `クラファンに挑戦したい・挑戦者を紹介したい・アドバイザーとして働きたい・EXPOに出展したい——` +
  `4つの入り口から無料相談を受け付けています。累計調達額${RAISED_LABEL}・平均達成率${NUM_TASSEI_RATE}。` +
  `相談無料・最短24時間返信。`;

export const metadata: Metadata = {
  title: LP_TITLE,
  description: LP_DESCRIPTION,
  // SNS/LINEで共有したときのカードも同じ文言にする（layout.tsx に openGraph は無いので追加のみ・他ページ不変）
  openGraph: {
    title: LP_TITLE,
    description: LP_DESCRIPTION,
    type: 'website',
    locale: 'ja_JP',
  },
};

export default function Page() {
  return <TopLandingPage />;
}
