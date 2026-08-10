import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/admin/registrations — 申込者一覧
 * DELETE /api/admin/registrations?id=<id> — 申込者を削除（不可逆）
 * 認証: service role key（サーバーサイドのみ）
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('registrations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ registrations: [], error: error.message });
    }
    return NextResponse.json({ registrations: data || [] });
  } catch {
    return NextResponse.json({ registrations: [] });
  }
}

/**
 * DELETE /api/admin/registrations?id=<id1,id2,id3>
 * 申込者情報を削除する（不可逆操作）
 * 単一も複数も対応: id はカンマ区切りで複数指定可能（例: ?id=aaa,bbb,ccc）
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
    const { error } = await supabase.from('registrations').delete().in('id', ids);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, deleted: ids.length });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : '削除に失敗しました' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
