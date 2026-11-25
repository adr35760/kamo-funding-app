import { NextRequest, NextResponse } from 'next/server';
import { sendContactConfirmationEmail, sendContactAdminNotification } from '@/lib/email';
import { validateContact, type ContactInput } from '@/lib/contact-shared';

/**
 * POST /api/contact
 *
 * 質問・問い合わせ・取材依頼（/contact）の送信先。
 *
 * 🔴 設計方針（/api/consult と同じ）:
 *   1. **サーバー側でも必須検証する**。ブラウザの required は外せるので、
 *      クライアントの検証だけでは「必須」の意味が無い。
 *   2. **DBは用意しない**。問い合わせは件数が読めず、テーブル未作成のまま
 *      本番で受けられなくなるリスクを取りたくない。控えメール（申込者）＋
 *      社内アラート（info@）のメール2系統だけで完結させる。
 *   3. 両方のメールが失敗した時だけエラーを返す（＝問い合わせが消えたことを
 *      黙って成功にしない）。
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let body: Partial<ContactInput>;
  try {
    body = (await request.json()) as Partial<ContactInput>;
  } catch {
    return NextResponse.json(
      { ok: false, errors: ['送信内容を読み取れませんでした。画面を再読み込みしてお試しください'] },
      { status: 400 }
    );
  }

  // 1) サーバー側の必須検証（クライアントと同じ規則を共有）
  const validated = validateContact(body);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, errors: validated.errors }, { status: 400 });
  }
  const value = validated.value;

  // 2) メール送信（控えメール＋社内アラート）
  const receivedAt = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const mailInput = {
    kind: value.kind,
    name: value.name,
    organization: value.organization,
    email: value.email,
    phone: value.phone,
    message: value.message,
  };

  const [confirmation, notification] = await Promise.all([
    sendContactConfirmationEmail(mailInput),
    sendContactAdminNotification(mailInput, receivedAt),
  ]);

  if (!confirmation.success) {
    console.error('[api/contact] 控えメール送信失敗:', confirmation.error);
  }
  if (!notification.success) {
    console.error('[api/contact] 社内アラート送信失敗:', notification.error);
  }

  if (!confirmation.success && !notification.success) {
    return NextResponse.json(
      {
        ok: false,
        errors: [
          '送信できませんでした。通信状況をご確認のうえ、もう一度お試しください。解決しない場合は info@local-creation.com へ直接メールをお送りください',
        ],
      },
      { status: 502 }
    );
  }

  // 控えメールだけ失敗した場合は「届いた」と伝えつつ、画面で直接メールの案内を出す
  return NextResponse.json({ ok: true, confirmationSent: confirmation.success });
}
