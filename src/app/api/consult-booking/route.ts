import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  sendConsultBookingConfirmationEmail,
  sendConsultBookingAdminNotification,
} from '@/lib/email';
import { validateConsultBooking, type ConsultBookingInput, type ConsultBookingValue } from '@/lib/consult-booking-shared';

/**
 * POST /api/consult-booking
 *
 * 個別相談の予約前アンケート（/consult）の送信先。
 * 2026-11-24 t iku指示: アンケート（6項目）を入力しないと予約スケジュールへ
 * 進めない作りにしたため、その入力をここで受け、保存とメール送信を行う。
 *
 * 🔴 既存の /api/consult（トップページの質問窓口）とは**別の入り口**として分ける。
 *    - 予約前アンケートは項目が違う（性別・年齢・希望金額を含む）
 *    - 送信後の案内が違う（予約カレンダーのリンクを返す）
 *
 * 設計方針は既存APIと揃える:
 *   1. 必須検証はサーバー側でも行う（ブラウザの required は外せる）
 *   2. DB保存は任意（consult_bookings 未作成でもメールは必ず送る）
 *   3. 送信は「申込者へのサンキュー（予約カレンダー付き）」＋「社内アラート」の2通。
 *      両方失敗した時だけエラーを返す。
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface SaveResult {
  saved: boolean;
  error?: string;
}

/** consult_bookings への保存。**失敗しても例外を投げない**（リードを落とさない） */
async function saveConsultBooking(
  value: ConsultBookingValue,
  meta: { userAgent: string; ip: string | null }
): Promise<SaveResult> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('consult_bookings').insert({
      name: value.name,
      gender: value.gender,
      age: value.age,
      email: value.email,
      idea: value.idea,
      amount: value.amount,
      source: value.source,
      user_agent: meta.userAgent.slice(0, 500),
      ip: meta.ip,
    });

    if (error) {
      console.error('[api/consult-booking] DB保存に失敗（メール送信は継続）:', error.message);
      return { saved: false, error: error.message };
    }
    return { saved: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[api/consult-booking] DB保存に失敗（メール送信は継続）:', message);
    return { saved: false, error: message };
  }
}

export async function POST(request: NextRequest) {
  let body: Partial<ConsultBookingInput>;
  try {
    body = (await request.json()) as Partial<ConsultBookingInput>;
  } catch {
    return NextResponse.json(
      { ok: false, errors: ['送信内容を読み取れませんでした。画面を再読み込みしてお試しください'] },
      { status: 400 }
    );
  }

  const validated = validateConsultBooking(body);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, errors: validated.errors }, { status: 400 });
  }
  const value = validated.value;

  const userAgent = request.headers.get('user-agent') || '';
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null;
  const save = await saveConsultBooking(value, { userAgent, ip });

  const receivedAt = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

  const [confirmation, notification] = await Promise.all([
    sendConsultBookingConfirmationEmail(value),
    sendConsultBookingAdminNotification(value, receivedAt),
  ]);

  if (!confirmation.success) {
    console.error('[api/consult-booking] サンキュー送信失敗:', confirmation.error);
  }
  if (!notification.success) {
    console.error('[api/consult-booking] 社内アラート送信失敗:', notification.error);
  }

  // 保存・サンキュー・アラートの3つすべて失敗した時だけエラー（黙って成功にしない）
  const delivered = save.saved || confirmation.success || notification.success;
  if (!delivered) {
    return NextResponse.json(
      { ok: false, errors: ['送信に失敗しました。時間をおいてもう一度お試しください'] },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
