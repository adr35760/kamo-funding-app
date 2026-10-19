import { NextRequest, NextResponse } from 'next/server';
import { requireWorkSession } from '@/lib/work-session';
import { FIXED_ITEMS, INCENTIVE_RATES } from '@/lib/work-pay';

/**
 * GET /api/work/rates — 固定給の7業務とインセンティブ単価表
 *
 * 制度の定義はコード側（src/lib/work-pay.ts）に持つ。DBには入れない。
 * 料率は会社の決定なので、変更履歴が残るコードで管理する。
 */
export async function GET(request: NextRequest) {
  const auth = await requireWorkSession(request);
  if ('response' in auth) return auth.response;

  return NextResponse.json(
    { success: true, fixed_items: FIXED_ITEMS, incentive_rates: INCENTIVE_RATES },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export const dynamic = 'force-dynamic';
