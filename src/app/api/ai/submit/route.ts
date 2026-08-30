import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { CrowdfundingPage, HearingInput } from '@/lib/ai-prompts';

/**
 * POST /api/ai/submit
 *
 * AIツールの生成結果を KAMO 側（ai_generations テーブル）に保存する。
 *
 * 二重送信防止:
 *  - 生成結果 JSON のハッシュ（content_hash）に UNIQUE 制約を張っており、
 *    同一内容の再送は 23505 で弾かれる → duplicate: true を返す（エラーにしない）
 *  - クライアント側でもボタンを無効化する
 *
 * マイグレーション未実行時（テーブルなし）は 200 + needsMigration:true を返し、
 * 既存機能を壊さない。
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      page?: CrowdfundingPage;
      input?: Partial<HearingInput>;
      mode?: string;
    };
    const page = body.page;

    if (!page || !page.project || !page.project.title) {
      return NextResponse.json(
        { success: false, error: '送信する生成結果がありません' },
        { status: 400 }
      );
    }

    const contentHash = createHash('sha256')
      .update(JSON.stringify(page))
      .digest('hex');

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('ai_generations')
      .insert({
        title: page.project.title,
        subtitle: page.project.subtitle ?? null,
        creator_name: page.project.creator?.name ?? body.input?.creatorName ?? null,
        organization: page.project.creator?.organization ?? body.input?.organization ?? null,
        goal_amount: page.project.goal_amount ?? null,
        generation_mode: body.mode ?? null,
        hearing_input: body.input ?? null,
        page,
        content_hash: contentHash,
      })
      .select('id, created_at')
      .single();

    if (error) {
      // 一意制約違反 = 同じ内容が既に送信済み
      if (error.code === '23505') {
        return NextResponse.json({ success: true, duplicate: true });
      }
      // テーブル未作成（マイグレーション未実行）
      if (isMissingTable(error)) {
        return NextResponse.json({
          success: false,
          needsMigration: true,
          error:
            '保存先テーブルが未作成です。supabase/migration-ai-generations.sql を Supabase の SQL Editor で実行してください。',
        });
      }
      console.error('ai/submit insert error:', error);
      return NextResponse.json(
        { success: false, error: '送信に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: data?.id, created_at: data?.created_at });
  } catch (err) {
    console.error('API /ai/submit error:', err);
    return NextResponse.json(
      { success: false, error: '送信中にエラーが発生しました' },
      { status: 500 }
    );
  }
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
