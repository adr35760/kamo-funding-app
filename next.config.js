/** @type {import('next').NextConfig} */

/**
 * セキュリティヘッダ（2026-09-18 追加）
 *
 * ねらい:
 *  - `X-Frame-Options` … 他人のサイトに当サイトを埋め込んで、
 *    申込フォームの入力を横取りする手口（クリックジャッキング）を防ぐ
 *  - `Referrer-Policy` … 外部サイトへ遷移するときに、URLの中身を渡さない
 *  - `X-Content-Type-Options` … アップロード物を別の種類として実行させない
 *  - `Permissions-Policy` … カメラ・マイク・位置情報を一律で無効にする
 *    （当サイトは使わない）
 */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig = {
  reactStrictMode: true,
  // ビルド情報からバージョンを推測されないようにする
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // 管理画面・限定公開ツール・申込フォームは検索結果に出さない。
        // キャッシュにも残さない（共用PCの戻るボタンで個人情報が見えるのを防ぐ）
        source: '/:path(admin|ai-tool|apply-listing)',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Cache-Control', value: 'no-store, max-age=0, must-revalidate' },
        ],
      },
      {
        // APIの応答は一切キャッシュしない
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
    ];
  },
};

module.exports = nextConfig;
