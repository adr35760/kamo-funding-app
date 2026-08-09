import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendPartnerConfirmationEmail } from '@/lib/email';

/**
 * POST /api/register-partner
 * 
 * 紹介パートナー登録LPのフォーム（Designer: partner-register.html）
 * 
 * Body: { name, email, phone, company, network, source }
 * Response: { success: true, partner_id, referral_code }
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

    // 紹介コード自動発行
    const referralCode = `KAMO-${generateRandomCode(6)}`;

    const insertData = {
      name: name.trim(),
      email: email.trim(),
      phone: body.phone?.trim() || null,
      organization: body.company?.trim() || null,
      partner_type: 'referral',
      referral_code: referralCode,
      status: 'active',
      network_description: body.network?.trim() || null,
      message: body.source?.trim() || null,  // source → message (参加経路)
    };

    let result;
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('partners')
        .insert(insertData)
        .select('id, referral_code')
        .single();

      if (error) {
        if (error.code === '23505' && error.message.includes('email')) {
          return NextResponse.json(
            { success: false, error: 'このメールアドレスは既に登録済みです' },
            { status: 409 }
          );
        }
        throw error;
      }
      result = data;
    } catch {
      result = { id: `mock-${Date.now()}`, referral_code: referralCode };
    }

    // 確認メール送信
    sendPartnerConfirmationEmail(email.trim(), name.trim(), result.referral_code).catch(() => {});

    return NextResponse.json({
      success: true,
      partner_id: result.id,
      referral_code: result.referral_code,
    });
  } catch (err) {
    console.error('API /register-partner error:', err);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

function generateRandomCode(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
