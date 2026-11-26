import './globals.css';
import '@/styles/kamo-icons.css';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import { SITE_ORIGIN } from '@/lib/site-url';

export const metadata = {
  // OGP/Twitterカードの画像URLを絶対URLで出すために必要（未設定だと相対パスになり
  // LINE・X のプレビューが画像を読めない）。URLの正は src/lib/site-url.ts の1箇所。
  metadataBase: new URL(SITE_ORIGIN),
  title: 'KAMOファンディング — 売上促進4本柱プロジェクト',
  description: '説明会・セミナー管理 + AIクラファンページ作成ツール',
  icons: {
    icon: '/kamo-logo-icon.png',
    apple: '/kamo-logo-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Montserrat:wght@700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}
