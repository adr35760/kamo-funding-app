import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/admin/referrals — 紹介者一覧（紹介パートナー情報つき）
 * 認証: service role key（サーバーサイドのみ）
 *
 * migration-referral-terms.sql 未実行でも動くよう、
 * 拡張列つきのクエリが失敗したら基本列のみで再取得する。
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('partner_referrals')
      .select('*, partners(name, email, referral_code)')
      .order('created_at', { ascending: false });

    if (error) {
      // リレーション埋め込みが使えない場合は素のテーブルだけ返す
      const { data: plain, error: plainError } = await supabase
        .from('partner_referrals')
        .select('*')
        .order('created_at', { ascending: false });
      if (plainError) {
        return NextResponse.json({ referrals: [], error: plainError.message });
      }
      return NextResponse.json({ referrals: plain || [] });
    }

    return NextResponse.json({ referrals: data || [] });
  } catch {
    return NextResponse.json({ referrals: [] });
  }
}

/**
 * DELETE /api/admin/referrals?id=<id1,id2,...> — 紹介者レコードを削除（不可逆）
 */
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ ok: false, error: 'id が必要です' }, { status: 400 });
  }
  const ids = id.split(',').map(s => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ ok: false, error: 'id が必要です' }, { status: 400 });
  }
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('partner_referrals').delete().in('id', ids);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, deleted: ids.length });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    );
  }
}
