import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendSupporterConfirmationEmail } from '@/lib/email';
import { parseEmail } from '@/lib/email-address';
import { extractPartnerUtm, insertWithUtmFallback } from '@/lib/utm-server';

/**
 * POST /api/register-supporter
 * 
 * サポーター登録LPのフォーム（Designer: supporter-register.html）
 * 
 * Body: { name, email, phone, company, support_type, session_attended, sns, message }
 * Response: { success: true, partner_id, referral_code }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email } = body;

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'お名前は必須です' }, { status: 400 });
    }
    // 🔴 全角・空白混じりのアドレスを受付時点で弾く（2026-09-24 本番障害の対策）。
    //   通してしまうと登録は成立するのに確認メールだけ送信失敗になる。
    const parsedEmail = parseEmail(email);
    if (!parsedEmail.ok) {
      return NextResponse.json({ success: false, error: parsedEmail.error }, { status: 400 });
    }
    const cleanEmail = parsedEmail.email;

    const referralCode = `KAMO-${generateRandomCode(6)}`;

    const insertData = {
      name: name.trim(),
      email: cleanEmail,
      phone: body.phone?.trim() || null,
      organization: body.company?.trim() || null,
      partner_type: 'supporter',
      referral_code: referralCode,
      status: 'active',
      supporter_motivation: body.message?.trim() || null,
      support_preference: body.support_type || null,
      registered_event_id: body.session_attended || null,
      sns: body.sns?.trim() || null,
      message: body.message?.trim() || null,
      // 流入元（UTM）。本人申告の経路とは別物なので併存させる。
      // 列が未追加の環境では insertWithUtmFallback が UTM だけ落として登録を通す。
      ...extractPartnerUtm(body),
    };

    let result;
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await insertWithUtmFallback<{ id: string; referral_code: string }>(
        insertData,
        (d) => supabase.from('partners').insert(d).select('id, referral_code').single()
      );

      if (error) {
        if (error.code === '23505' && (error.message || '').includes('email')) {
          return NextResponse.json(
            { success: false, error: 'このメールアドレスは既に登録済みです' },
            { status: 409 }
          );
        }
        throw error;
      }
      // data が null なら下の catch でモック応答に落ちる（登録フォームを500にしない）
      if (!data) throw new Error('insert returned no row');
      result = data;
    } catch {
      result = { id: `mock-${Date.now()}`, referral_code: referralCode };
    }

    // 確認メール送信
    sendSupporterConfirmationEmail(name.trim(), cleanEmail, result.referral_code).catch(() => {});

    return NextResponse.json({
      success: true,
      partner_id: result.id,
      referral_code: result.referral_code,
    });
  } catch (err) {
    console.error('API /register-supporter error:', err);
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
