import type { Metadata } from 'next';
import TopLandingPage from '@/components/TopLandingPage';
import { ACHIEVEMENT_RATE_LABEL, TOTAL_RAISED_LABEL } from '@/lib/top-lp-content';

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
 *   TOTAL_RAISED_LABEL = 約19.5億円 / ACHIEVEMENT_RATE_LABEL = 93.7%
 *   （2026-11-21 t iku指示。トップは 577件／約19.5億円／93.7% に統一）
 */

/** タブタイトル・検索結果・SNS共有で同じ文言を使う（1箇所で管理） */
const LP_TITLE = 'KAMOファンディング｜クラファンから、その先の事業成長へ';
// 検索結果で切れない長さ（約100字）に収める
const LP_DESCRIPTION =
  `新しい商品やサービスを、クラウドファンディングで最初のお客様へ。` +
  `企画づくりから先行販売、ファンづくりまで、KAMOファンディングが伴走します。` +
  `累計支援総額${TOTAL_RAISED_LABEL}（両サービス合計）・KAMOファンディングの目標達成率${ACHIEVEMENT_RATE_LABEL}。診断無料・最短24時間返信。`;

export const metadata: Metadata = {
  title: LP_TITLE,
  description: LP_DESCRIPTION,
  // SNS/LINEで共有したときのカードも同じ文言にする（layout.tsx に openGraph は無いので追加のみ・他ページ不変）
  openGraph: {
    title: LP_TITLE,
    description: LP_DESCRIPTION,
    type: 'website',
    url: '/',
    siteName: 'KAMOファンディング',
    locale: 'ja_JP',
    // 🔴 2026-11-26 t iku指示: リンクを貼ったときの画像がぼやけていた（画像指定が無く、
    //    小さいロゴが引き伸ばされていた）。t iku提供の登壇写真から1200×630を作り指定する。
    //    画像内の実績数字は現行のサイト表記と違うため、数字が入らない構図でトリミング（2026-11-26）。
    // 🔴 画像はwww付きの絶対URLで指定する（metadataBase は apex のままで、
    //    apex は www へ308転送するため、クローラーによっては画像取得に失敗する）
    images: [
      {
        url: 'https://www.crowdfunding.co.jp/og-top-stage.jpg',
        width: 1200,
        height: 630,
        alt: 'KAMOファンディング｜クラファンは、ファン集め。',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: LP_TITLE,
    description: LP_DESCRIPTION,
    images: ['https://www.crowdfunding.co.jp/og-top-stage.jpg'],
  },
};

export default function Page() {
  return <TopLandingPage />;
}
