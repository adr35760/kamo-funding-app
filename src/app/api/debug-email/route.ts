import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function GET() {
  const apiKey = process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({ 
      hasKey: false, 
      error: 'RESEND_API_KEY not set' 
    });
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: 'KAMOファンディング <onboarding@resend.dev>',
      to: 'kamo-delivery-test@yopmail.com',
      subject: '【テスト】KAMOファンディング — メール送信テスト',
      html: '<p>これはテストメールです。KAMOファンディング</p>',
    });

    if (error) {
      return NextResponse.json({ 
        hasKey: true, 
        keyPrefix: apiKey.substring(0, 8) + '...',
        sendError: error.message 
      });
    }

    return NextResponse.json({ 
      hasKey: true, 
      keyPrefix: apiKey.substring(0, 8) + '...',
      sendSuccess: true,
      emailId: data?.id,
    });
  } catch (err) {
    return NextResponse.json({ 
      hasKey: true, 
      keyPrefix: apiKey.substring(0, 8) + '...',
      exception: err instanceof Error ? err.message : String(err),
    });
  }
}
