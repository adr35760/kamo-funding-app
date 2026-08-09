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
      <body>{children}</body>
    </html>
  );
}
