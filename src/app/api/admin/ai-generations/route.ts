import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/admin/ai-generations
 *   一覧: id, 送信日時, タイトル, 起案者, 組織, 目標金額, モード
 * GET /api/admin/ai-generations?id=<uuid>
 *   詳細: 生成結果の全文（page JSON・ヒアリング入力を含む）
 *
 * 保護: src/middleware.ts の Basic認証（matcher に /api/admin/:path* を含む）
 */
export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    const supabase = getSupabaseAdmin();

    if (id) {
      const { data, error } = await supabase
        .from('ai_generations')
        .select('*')
        .eq('id', id)
        .single();
      if (error) return handleError(error);
      return NextResponse.json({ generation: data });
    }

    const { data, error } = await supabase
      .from('ai_generations')
      .select('id, title, subtitle, creator_name, organization, goal_amount, generation_mode, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return handleError(error);
    return NextResponse.json({ generations: data ?? [] });
  } catch (err) {
    console.error('API /admin/ai-generations error:', err);
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 });
  }
}

function handleError(error: { code?: string; message?: string }) {
  // テーブル未作成（マイグレーション未実行）でも管理画面を壊さない
  if (isMissingTable(error)) {
    return NextResponse.json({
      generations: [],
      needsMigration: true,
      error:
        '保存先テーブルが未作成です。supabase/migration-ai-generations.sql を Supabase の SQL Editor で実行してください。',
    });
  }
  console.error('admin/ai-generations query error:', error);
  return NextResponse.json({ error: error.message ?? '取得に失敗しました' }, { status: 500 });
}

/**
 * ai_generations テーブルが存在しない（マイグレーション未実行）かを判定する。
 * PostgREST はスキーマキャッシュ由来の PGRST205 を返し、
 * 直接SQL経路では Postgres の 42P01 になるため両方を見る。
 */
function isMissingTable(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /ai_generations/.test(error.message || '') && /could not find the table|does not exist/i.test(error.message || '')
  );
}

export const dynamic = 'force-dynamic';
