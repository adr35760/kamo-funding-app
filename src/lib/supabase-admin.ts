import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client with service role key.
 * Creates a fresh client each call to avoid stale env var caching.
 * Used in API routes and server-side operations.
 * NEVER expose this client to the browser.
 */
export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase environment variables are not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  return createClient(url, key, {
    auth: { persistSession: false },
    // Next.js は fetch を差し替えており、GET レスポンスを既定で長期キャッシュする
    // （fetch-cache に revalidate=1年で保存される）。その結果、削除済みの行が
    // 管理画面に出続ける・新しい申込が反映されない、という事故が起きる。
    // 管理系のDB読み取りは常に最新でなければならないので no-store を強制する。
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  });
}
