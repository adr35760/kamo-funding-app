import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkSession } from '@/lib/work-session';

/**
 * GET /api/work/categories — カテゴリ9種（固定・参照用）
 * ログイン必須。個人情報は含まないが、業務の内訳が分かるので認証の内側に置く。
 */
export async function GET(request: NextRequest) {
  const auth = await requireWorkSession(request);
  if ('response' in auth) return auth.response;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('work_categories')
      .select('id, name, sort_order')
      .order('sort_order');

    if (error) {
      console.error('work/categories error:', error.code);
      return NextResponse.json({ categories: [] }, { headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json(
      { success: true, categories: data ?? [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('API /work/categories error:', err);
    return NextResponse.json({ categories: [] }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
