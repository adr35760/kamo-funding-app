import './globals.css';
import '@/styles/kamo-icons.css';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import MetaPixelPageView from '@/components/MetaPixelPageView';
import { META_PIXEL_EXCLUDED_PREFIXES, META_PIXEL_ID } from '@/lib/meta-pixel';
import { SITE_ORIGIN } from '@/lib/site-url';

/**
 * Metaピクセルのベースコード（2026-11-26 t iku指示）。
 *
 * 🔴 依頼文のスニペットをそのまま使う（init → PageView → fbevents.js）。
 *    改変はピクセルIDの埋め込み（1箇所管理）だけ。
 * 🔴 置き場所は <head> の末尾（依頼どおり「</head> の直前」）。
 *    <noscript><img></noscript> は HTML 仕様上 head に置けないため <body> の先頭に置く。
 * 🔴 内部業務ページ（/admin・/work・/ai-tool）では **init も PageView もせず return**。
 *    判定はパスの先頭一致で、除外リストは src/lib/meta-pixel.ts の1箇所から渡す。
 *    fbevents.js の読み込み自体も行わないので、除外ページでは1件も飛ばない。
 */
const META_PIXEL_BASE_CODE = `
(function () {
  var path = window.location.pathname || '';
  var excluded = ${JSON.stringify(META_PIXEL_EXCLUDED_PREFIXES)};
  for (var i = 0; i < excluded.length; i++) {
    if (path.indexOf(excluded[i]) === 0) return;
  }
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '${META_PIXEL_ID}');
  fbq('track', 'PageView');
})();
`;

const META_PIXEL_NOSCRIPT = `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1" alt="" />`;

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
  /**
   * Meta広告のドメイン認証（2026-11-26 t iku指示）。
   * 🔴 content の値は1文字も変更しない（Metaが発行したトークン）。
   *    出力は <meta name="facebook-domain-verification" content="…" />。
   */
  verification: {
    other: {
      'facebook-domain-verification': '26dddyytuxrvjckb6hzkybvftgmckc',
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Montserrat:wght@700;800;900&display=swap" rel="stylesheet" />
        {/* Meta Pixel Code */}
        <script dangerouslySetInnerHTML={{ __html: META_PIXEL_BASE_CODE }} />
        {/* End Meta Pixel Code */}
      </head>
      <body>
        {/* Meta Pixel Code（noscript）— img は head に置けないため body 先頭 */}
        <noscript dangerouslySetInnerHTML={{ __html: META_PIXEL_NOSCRIPT }} />
        <MetaPixelPageView />
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}
