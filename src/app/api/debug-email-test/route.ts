import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

export async function GET() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'KAMOファンディング <info@local-creation.com>';
  
  if (!apiKey) {
    return NextResponse.json({ hasKey: false, error: 'RESEND_API_KEY not set' });
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: 'kamo-domain-test@yopmail.com',
      subject: '【テスト】KAMOファンディング — ドメイン認証後メール送信テスト',
      html: '<p>これはテストメールです。KAMOファンディング from info@local-creation.com</p>',
    });

    if (error) {
      return NextResponse.json({ hasKey: true, keyPrefix: apiKey.substring(0, 8) + '...', fromEmail, sendError: error.message });
    }

    return NextResponse.json({ hasKey: true, keyPrefix: apiKey.substring(0, 8) + '...', fromEmail, sendSuccess: true, emailId: data?.id });
  } catch (err) {
    return NextResponse.json({ hasKey: true, exception: err instanceof Error ? err.message : String(err) });
  }
}
