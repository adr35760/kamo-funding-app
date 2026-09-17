import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/admin/listing-applications
 *   一覧: 受付日時・会社名・担当者・プロジェクト名・種類・目標金額・口座（下4桁）・状況
 * GET /api/admin/listing-applications?id=<uuid>
 *   詳細: 申込書の全項目（口座情報の全体を含む）
 * DELETE /api/admin/listing-applications?id=<uuid>
 *   1件削除（不可逆）
 * PATCH /api/admin/listing-applications?id=<uuid>  body: { status }
 *   処理状況の更新
 *
 * 保護: src/middleware.ts の Basic認証（matcher に /api/admin/:path* を含む）
 */
export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    const supabase = getSupabaseAdmin();

    if (id) {
      const { data, error } = await supabase
        .from('listing_applications')
        .select('*')
        .eq('id', id)
        .single();
      if (error) return handleError(error);
      return NextResponse.json({ application: data });
    }

    const { data, error } = await supabase
      .from('listing_applications')
      // 一覧では口座番号は下4桁マスクに使う分だけ取得する
      .select(
        'id, company_name, representative, contact_name, contact_email, contact_phone, ' +
          'project_name, project_type, goal_amount, bank_name, bank_account_number, status, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return handleError(error);

    // 一覧に口座番号の全体は返さない（銀行名＋下4桁のみ）
    const applications = (data ?? []).map(row => {
      const { bank_name: bank, bank_account_number: num, ...rest } = row as unknown as Record<
        string,
        unknown
      > & { bank_name?: string | null; bank_account_number?: string | null };
      return {
        ...rest,
        bank_masked:
          bank || num
            ? `${bank || '（銀行名なし）'} ${num ? `****${String(num).slice(-4)}` : '（口座番号なし）'}`
            : null,
      };
    });
    return NextResponse.json({ applications });
  } catch (err) {
    console.error('API /admin/listing-applications error:', err);
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 });
  }
}

/**
 * 処理状況を更新する。
 * 申込内容そのものは書き換えない（申告された原本を保つ）。
 */
export async function PATCH(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id || !UUID_RE.test(id.trim())) {
    return NextResponse.json({ ok: false, error: 'id は1件のみ指定してください' }, { status: 400 });
  }

  let status: unknown;
  try {
    ({ status } = await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'リクエストが不正です' }, { status: 400 });
  }
  const ALLOWED = ['new', 'in_review', 'approved', 'rejected'];
  if (typeof status !== 'string' || !ALLOWED.includes(status)) {
    return NextResponse.json({ ok: false, error: '状況の値が不正です' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('listing_applications')
      .update({ status })
      .eq('id', id.trim());
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, status });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : '更新に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/listing-applications?id=<uuid>
 * 掲載申込を1件だけ削除する（不可逆操作）。
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
      .from('listing_applications')
      .select('id, company_name')
      .eq('id', id.trim())
      .maybeSingle();
    if (findError) {
      return NextResponse.json({ ok: false, error: findError.message }, { status: 500 });
    }
    if (!target) {
      return NextResponse.json(
        {
          ok: false,
          error: '対象の申込が見つかりませんでした（すでに削除済みの可能性があります）',
        },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from('listing_applications')
      .delete()
      .eq('id', id.trim());
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, deleted: 1, company_name: target.company_name ?? null });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : '削除に失敗しました' },
      { status: 500 }
    );
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function handleError(error: { code?: string; message?: string }) {
  // テーブル未作成（マイグレーション未実行）でも管理画面を壊さない
  if (isMissingTable(error)) {
    return NextResponse.json({
      applications: [],
      needsMigration: true,
      error:
        '保存先テーブルが未作成です。supabase/migration-listing-applications.sql を Supabase の SQL Editor で実行してください。',
    });
  }
  console.error('admin/listing-applications query error:', error);
  return NextResponse.json({ error: error.message ?? '取得に失敗しました' }, { status: 500 });
}

function isMissingTable(error: { code?: string; message?: string }): boolean {
  const msg = error.message || '';
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    (/listing_applications/.test(msg) && /could not find the table|does not exist/i.test(msg))
  );
}

export const dynamic = 'force-dynamic';
