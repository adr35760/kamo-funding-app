import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/admin/survey
 *
 * アンケート回答の集計用データを返す（管理画面「アンケート」タブ専用）。
 *  - responses: survey_responses の全行（新しい順・最大1000件）
 *  - events: 説明会名の表示に使う events（id / title / event_date）
 *
 * 保護: src/middleware.ts の /api/admin/* 認証（Googleログイン or Basic認証）。
 *
 * 🔴 取得に失敗したときは **空配列を返さない**（500で理由を返す）。
 *    空配列にすると画面が「回答0件」と断定し、集計が嘘になる。
 *    「テーブル未作成（マイグレーション未実行）」だけは専用フラグで区別する。
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data: responses, error: respError } = await supabase
      .from('survey_responses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (respError) {
      if (isMissingTable(respError)) {
        return NextResponse.json({
          responses: [],
          events: [],
          needsMigration: true,
          error:
            '保存先テーブルが未作成です。supabase/【アンケート】survey_responses_これを実行してください.sql を Supabase の SQL Editor で実行してください。',
        });
      }
      console.error('admin/survey responses query error:', respError);
      return NextResponse.json({ error: respError.message ?? '取得に失敗しました' }, { status: 500 });
    }

    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, title, event_date, duration_minutes, type')
      .order('event_date', { ascending: false })
      .limit(200);

    if (eventsError) {
      // 説明会名が出せないだけで、回答の集計自体は成立させる
      console.error('admin/survey events query error:', eventsError);
      return NextResponse.json({ responses: responses ?? [], events: [], eventsError: true });
    }

    return NextResponse.json({ responses: responses ?? [], events: events ?? [] });
  } catch (err) {
    console.error('API /admin/survey error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '取得に失敗しました' },
      { status: 500 }
    );
  }
}

function isMissingTable(error: { code?: string; message?: string }): boolean {
  const msg = error.message || '';
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    (/survey_responses/.test(msg) && /could not find the table|does not exist/i.test(msg))
  );
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
