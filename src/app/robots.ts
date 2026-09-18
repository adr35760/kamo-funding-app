import type { MetadataRoute } from 'next';

/**
 * robots.txt（2026-09-18 追加）
 *
 * 管理画面・限定公開のAIツール・掲載申込フォーム・APIは
 * 検索エンジンに載せない。検索結果から入口が見つかること自体を減らす目的。
 * （認証の代わりではなく、認証と併用する）
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/ai-tool', '/apply-listing', '/api/'],
      },
    ],
  };
}
