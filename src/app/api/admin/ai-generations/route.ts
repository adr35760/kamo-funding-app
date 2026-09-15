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
      // view=print はPDF出力ページ用。口座情報を**レスポンスに載せない**
      // （印刷ページのJSに口座が届く経路そのものを作らない）。
      const forPrint = request.nextUrl.searchParams.get('view') === 'print';
      const columns = forPrint
        ? 'id, title, subtitle, creator_name, organization, goal_amount, generation_mode, hearing_input, page, created_at'
        : '*';
      const { data, error } = await supabase
        .from('ai_generations')
        .select(columns)
        .eq('id', id)
        .single();
      if (error) return handleError(error);
      return NextResponse.json({ generation: data });
    }

    const { data, error } = await supabase
      .from('ai_generations')
      // 一覧では口座は下4桁マスクに使う分だけ取得する
      .select('id, title, subtitle, creator_name, organization, goal_amount, generation_mode, created_at, bank_account')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      // bank_account 列が未追加でも一覧は出す（口座なしで再取得）
      if (isMissingBankColumn(error)) {
        const retry = await supabase
          .from('ai_generations')
          .select('id, title, subtitle, creator_name, organization, goal_amount, generation_mode, created_at')
          .order('created_at', { ascending: false })
          .limit(200);
        if (retry.error) return handleError(retry.error);
        return NextResponse.json({ generations: retry.data ?? [], bankColumnMissing: true });
      }
      return handleError(error);
    }
    // 一覧に口座の全体は返さない（銀行名＋下4桁のみ）
    const generations = (data ?? []).map((row) => {
      const { bank_account: bank, ...rest } = row as Record<string, unknown> & {
        bank_account?: { bankName?: string; accountNumber?: string } | null;
      };
      return {
        ...rest,
        bank_masked: bank
          ? `${bank.bankName || '（銀行名なし）'} ****${String(bank.accountNumber ?? '').slice(-4)}`
          : null,
      };
    });
    return NextResponse.json({ generations });
  } catch (err) {
    console.error('API /admin/ai-generations error:', err);
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/ai-generations?id=<uuid>
 * AI生成結果を1件だけ削除する（不可逆操作）。
 *
 * 🔴 意図的に「1件ずつ」だけを受け付ける。
 * 過去に申込データの一括削除で実ユーザーの行を巻き込んだ事故があったため、
 * カンマ区切りの複数指定・条件一致削除は実装しない（id は厳密にUUID1件）。
 */
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ ok: false, error: 'id が必要です' }, { status: 400 });
  }
  // 複数指定・ワイルドカードを構造的に受け付けない
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id.trim())) {
    return NextResponse.json(
      { ok: false, error: 'id は1件のみ指定してください（複数削除は行えません）' },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    // 削除対象が実在するかを先に確認し、0件削除を「成功」と見せない
    const { data: target, error: findError } = await supabase
      .from('ai_generations')
      .select('id, title')
      .eq('id', id.trim())
      .maybeSingle();
    if (findError) {
      return NextResponse.json({ ok: false, error: findError.message }, { status: 500 });
    }
    if (!target) {
      return NextResponse.json(
        { ok: false, error: '対象の生成結果が見つかりませんでした（すでに削除済みの可能性があります）' },
        { status: 404 }
      );
    }

    const { error } = await supabase.from('ai_generations').delete().eq('id', id.trim());
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, deleted: 1, title: target.title ?? null });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : '削除に失敗しました' },
      { status: 500 }
    );
  }
}

/** bank_account 列が未追加（migration-ai-bank-account.sql 未実行）かを判定する */
function isMissingBankColumn(error: { code?: string; message?: string }): boolean {
  const msg = error.message || '';
  return (
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    (/bank_account/.test(msg) && /column|could not find|does not exist/i.test(msg))
  );
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
