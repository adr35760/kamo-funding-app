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

    const rows = data || [];

    /**
     * 申込完了メールの送信状態を email_logs から導出して各行に付ける。
     *
     * なぜ registrations に列を持たせないか:
     *  - email_logs が送信記録の正規の置き場所として既に設計されている
     *  - 列追加のマイグレーションが不要で、既存データを触らずに済む
     *
     * 値の意味:
     *  - 'sent'    … 送信成功の記録あり
     *  - 'failed'  … 送信失敗の記録のみ（＝お客様にメールが届いていない）
     *  - 'unknown' … 記録が無い。この仕組みを入れる前の申込がここに入る。
     *                「失敗」ではないので、未着と断定しないよう区別している。
     */
    let emailStatusById = new Map<string, { status: string; error: string | null; at: string | null }>();
    try {
      const ids = rows.map(r => r.id as string);
      if (ids.length > 0) {
        const { data: logs } = await supabase
          .from('email_logs')
          .select('registration_id, status, error_message, sent_at')
          .eq('template_type', 'confirmation')
          .in('registration_id', ids)
          .order('sent_at', { ascending: true });
        // 同一申込に複数記録があるとき（再送した場合）は最後の結果を採用する
        for (const l of logs || []) {
          emailStatusById.set(l.registration_id as string, {
            status: l.status as string,
            error: (l.error_message as string) ?? null,
            at: (l.sent_at as string) ?? null,
          });
        }
      }
    } catch {
      // email_logs が無い環境では状態を付けない（一覧自体は必ず返す）
      emailStatusById = new Map();
    }

    const withStatus = rows.map(r => {
      const hit = emailStatusById.get(r.id as string);
      return {
        ...r,
        confirmation_email_status: hit ? hit.status : 'unknown',
        confirmation_email_error: hit ? hit.error : null,
        confirmation_email_at: hit ? hit.at : null,
      };
    });

    return NextResponse.json({ registrations: withStatus });
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
