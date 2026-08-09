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
  });
}
