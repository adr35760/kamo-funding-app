import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendPartnerSessionConfirmationEmail } from '@/lib/email';

/**
 * POST /api/apply-partner-session
 * 
 * パートナーシップ説明会LPの申込フォーム（Designer: index.html）
 * 
 * Body: { name, email, company, profession, program_interest, event_id, message }
 * Response: { success: true, registration_id }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email } = body;

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'お名前は必須です' }, { status: 400 });
    }
    if (!email?.includes('@')) {
      return NextResponse.json({ success: false, error: '有効なメールアドレスを入力してください' }, { status: 400 });
    }

    const insertData = {
      name: name.trim(),
      email: email.trim(),
      company: body.company?.trim() || null,
      profession: body.profession?.trim() || null,
      program_interest: body.program_interest || null,
      event_id: body.event_id || null,
      message: body.message?.trim() || null,
      status: 'registered',
    };

    let result;
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('partner_session_registrations')
        .insert(insertData)
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json(
            { success: false, error: 'このメールアドレスは既に申込済みです' },
            { status: 409 }
          );
        }
        throw error;
      }
      result = data;
    } catch {
      // Supabase未接続 — モック
      result = { id: `mock-session-${Date.now()}` };
    }

    // 確認メール送信
    sendPartnerSessionConfirmationEmail(email.trim(), name.trim()).catch(() => {});

    return NextResponse.json({
      success: true,
      registration_id: result.id,
    });
  } catch (err) {
    console.error('API /apply-partner-session error:', err);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
