import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { isEventFinished } from '@/lib/event-visibility';

/**
 * GET /api/admin/events — 管理画面用のイベント一覧
 *
 * 公開側の /api/events は「開催終了済み」を除外するが、
 * 管理画面は**当日の運営・フォロー連絡・実績集計**のため
 * **過去日程も含めて全件**返す必要がある。
 * そのため公開APIとは分離している。
 *
 * 認証: middleware の Basic 認証で /api/admin/* 全体を保護済み。
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: false });

    if (error) {
      return NextResponse.json({ events: [], error: error.message });
    }

    const events = (data || []).map((e: Record<string, unknown>) => ({
      ...e,
      finished: isEventFinished({
        event_date: e.event_date as string,
        duration_minutes: (e.duration_minutes as number | null) ?? null,
      }),
    }));

    return NextResponse.json({ events });
  } catch {
    return NextResponse.json({ events: [] });
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/admin/events — 管理画面からのイベント作成
 *
 * 🔴 なぜ追加したか（2026-09-18）:
 *   管理画面はこれまでブラウザから Supabase の REST API を直接叩いており、
 *   そのために `NEXT_PUBLIC_SUPABASE_ANON_KEY` を**画面のJSに埋め込んで**いた。
 *   NEXT_PUBLIC_ の値は配信ファイルに残るため、キーが第三者の手に渡り得る。
 *   `events` の RLS は「誰でもSELECT可」なので、漏れたキーで
 *   イベント一覧を直接読まれる状態だった。
 *   作成をサーバー経由に移し、鍵をブラウザへ出さないようにする。
 *
 * 認証: middleware の Basic 認証（/api/admin/*）。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const type = typeof body.type === 'string' ? body.type : '';
    const eventDate = typeof body.event_date === 'string' ? body.event_date : '';
    if (!title || !type || !eventDate) {
      return NextResponse.json(
        { ok: false, error: 'タイトル・種別・開催日時は必須です' },
        { status: 400 }
      );
    }

    const parsedDate = new Date(eventDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json({ ok: false, error: '開催日時の形式が不正です' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('events')
      .insert({
        title,
        type,
        pillar: body.pillar != null ? Number(body.pillar) : null,
        event_date: parsedDate.toISOString(),
        location: str(body.location),
        capacity: body.capacity ? Number(body.capacity) : null,
        streaming_url: str(body.streaming_url),
        streaming_platform: str(body.streaming_platform),
        status: 'upcoming',
      })
      .select('id')
      .single();

    if (error) {
      console.error('admin/events POST error:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (err) {
    console.error('admin/events POST exception:', err);
    return NextResponse.json({ ok: false, error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s : null;
}
