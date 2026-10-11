import { NextRequest, NextResponse } from 'next/server';
import { jstDateIso } from '@/lib/work-date';

/**
 * GET /api/work/cron/evening — 終業 21:00 JST（= 12:00 UTC）
 *
 * 🔴 タイムゾーン: Vercel Cron は **UTC**。21:00 JST = 12:00 UTC → `"0 12 * * *"`。
 *
 * 🔴 2026-10-09〜11 t iku 指示で、この cron が送っていた通知は**すべて停止**した。
 *   ・日報未提出リマインド（2026-10-09 停止）
 *   ・翌日の会議の予告（2026-10-11 停止）
 *   現在は何も送らない（エンドポイントは残す。復帰は git の履歴から）。
 */
export async function GET(request: NextRequest) {
  const authError = checkCronAuth(request);
  if (authError) return authError;

  return NextResponse.json(
    { ok: true, date: jstDateIso(), note: 'この cron の通知はすべて停止中（t iku 指示 2026-10-09〜11）' },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

function checkCronAuth(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && !cronSecret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET が設定されていません' }, { status: 401 });
  }
  if (cronSecret) {
    const auth = request.headers.get('authorization') || '';
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
  }
  return null;
}

export const dynamic = 'force-dynamic';
