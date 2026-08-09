import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/**
 * Browser-side Supabase client.
 * Lazily initialized so the app builds without env vars set.
 */
export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    _client = createClient(url, anonKey);
  }
  return _client;
}

// Keep backward-compatible export (but lazy)
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return getSupabase()[prop as keyof SupabaseClient];
  },
});
