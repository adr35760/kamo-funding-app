import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendConsultConfirmationEmail, sendConsultAdminNotification } from '@/lib/email';
import { validateConsult, type ConsultInput, type ConsultValue } from '@/lib/consult-shared';

/**
 * POST /api/consult
 *
 * トップページ（LP仕様書 v1.1 §10）の主要CV＝無料相談フォームの送信先。
 *
 * 🔴 設計方針（PM指定 2026-10-27）:
 *   1. **サーバー側でも必須検証する**。ブラウザの required は外せるので、
 *      クライアントの検証だけでは「必須」の意味が無い。
 *   2. **DBは任意**。`consult_requests` テーブルが未作成でも、メールは必ず送る。
 *      保存失敗でリードを落とさない（エラーはログに残す）。
 *   3. 送信は「サンキューメール（申込者）」＋「営業アラート」の2通。
 *      両方失敗した時だけエラーを返す（＝申込が消えたことを黙って成功にしない）。
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface SaveResult {
  saved: boolean;
  error?: string;
}

/**
 * consult_requests への保存。**失敗しても例外を投げない**。
 * テーブル未作成・環境変数未設定・接続障害のいずれも「保存できなかった」として扱い、
 * 呼び出し側はメール送信へ進む。
 */
async function saveConsultRequest(
  value: ConsultValue,
  meta: { userAgent: string; ip: string | null }
): Promise<SaveResult> {
  try {
    // getSupabaseAdmin() は環境変数が無いとクエリを投げる前に例外を投げる。
    // そのためクライアント生成自体を try の中に入れる（外に置くと 500 で全体が落ちる）。
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('consult_requests').insert({
      name: value.name,
      email: value.email,
      phone: value.phone || null,
      category: value.category,
      summary: value.summary,
      agree: true,
      source: value.source,
      entrance: value.entrance,
      user_agent: meta.userAgent.slice(0, 500),
      ip: meta.ip,
    });

    if (error) {
      console.error('[api/consult] DB保存に失敗（メール送信は継続）:', error.message);
      return { saved: false, error: error.message };
    }
    return { saved: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[api/consult] DB保存に失敗（メール送信は継続）:', message);
    return { saved: false, error: message };
  }
}

export async function POST(request: NextRequest) {
  let body: Partial<ConsultInput>;
  try {
    body = (await request.json()) as Partial<ConsultInput>;
  } catch {
    return NextResponse.json(
      { ok: false, errors: ['送信内容を読み取れませんでした。画面を再読み込みしてお試しください'] },
      { status: 400 }
    );
  }

  // 1) サーバー側の必須検証（クライアントと同じ規則を共有）
  const validated = validateConsult(body);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, errors: validated.errors }, { status: 400 });
  }
  const value = validated.value;

  // 2) DB保存（任意・失敗しても続行）
  const userAgent = request.headers.get('user-agent') || '';
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null;
  const save = await saveConsultRequest(value, { userAgent, ip });

  // 3) メール送信（サンキューメール＋営業アラート）
  const receivedAt = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const mailInput = {
    name: value.name,
    email: value.email,
    phone: value.phone,
    category: value.category,
    summary: value.summary,
    entrance: value.entrance,
    source: value.source,
  };

  const [confirmation, notification] = await Promise.all([
    sendConsultConfirmationEmail(mailInput),
    sendConsultAdminNotification(mailInput, receivedAt),
  ]);

  if (!confirmation.success) {
    console.error('[api/consult] サンキューメール送信失敗:', confirmation.error);
  }
  if (!notification.success) {
    console.error('[api/consult] 営業アラート送信失敗:', notification.error);
  }

  /**
   * 成功条件: 保存できた、またはどちらかのメールが送れた。
   * 3つすべて失敗した時だけエラーを返す（黙って成功にするとリードが消える）。
   */
  const delivered = save.saved || confirmation.success || notification.success;
  if (!delivered) {
    return NextResponse.json(
      {
        ok: false,
        errors: [
          '送信に失敗しました。お手数ですが、時間をおいてもう一度お試しください（解決しない場合は info@local-creation.com までご連絡ください）',
        ],
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    saved: save.saved,
    confirmationSent: confirmation.success,
    notificationSent: notification.success,
  });
}
