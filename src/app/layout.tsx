import './globals.css';

export const metadata = {
  title: 'KAMOファンディング — 売上促進4本柱プロジェクト',
  description: '説明会・セミナー管理 + AIクラファン支援ツール',
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
      <body>{children}</body>
    </html>
  );
}
