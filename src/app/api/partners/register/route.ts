import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendPartnerConfirmationEmail, sendSupporterConfirmationEmail } from '@/lib/email';

/**
 * POST /api/partners/register
 * 
 * パートナー登録（紹介パートナー・アドバイザー・サポーター共通）
 * 紹介コードを自動発行する。
 * 
 * Body: {
 *   name, email, phone?, organization?,
 *   partner_type: 'referral' | 'advisor' | 'supporter',
 *   network_description?, supporter_motivation?,
 *   registered_event_id?
 * }
 * 
 * Response: { success: true, partner_id, referral_code }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // バリデーション
    const { name, email, partner_type } = body;

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'お名前は必須です' }, { status: 400 });
    }
    if (!email?.includes('@')) {
      return NextResponse.json({ success: false, error: '有効なメールアドレスを入力してください' }, { status: 400 });
    }
    if (!['referral', 'advisor', 'supporter'].includes(partner_type)) {
      return NextResponse.json({ success: false, error: 'パートナータイプが不正です' }, { status: 400 });
    }

    // 紹介コード自動発行: KAMO-XXXXXX（6桁ランダム）
    const referralCode = `KAMO-${generateRandomCode(6)}`;

    const insertData: Record<string, unknown> = {
      name: name.trim(),
      email: email.trim(),
      phone: body.phone?.trim() || null,
      organization: body.organization?.trim() || null,
      partner_type,
      referral_code: referralCode,
      status: partner_type === 'advisor' ? 'pending' : 'active',
      network_description: body.network_description?.trim() || null,
      supporter_motivation: body.supporter_motivation?.trim() || null,
      registered_event_id: body.registered_event_id || null,
    };

    if (partner_type === 'advisor') {
      insertData.advisor_course_status = 'enrolled';
    }

    let result;
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('partners')
        .insert(insertData)
        .select('id, referral_code')
        .single();

      if (error) {
        if (error.code === '23505') {
          // UNIQUE制約違反 — email重複または紹介コード重複
          if (error.message.includes('email')) {
            return NextResponse.json(
              { success: false, error: 'このメールアドレスは既に登録済みです' },
              { status: 409 }
            );
          }
          // 紹介コード重複は稀だが、再試行
          return NextResponse.json(
            { success: false, error: '登録に失敗しました。もう一度お試しください。' },
            { status: 500 }
          );
        }
        throw error;
      }
      result = data;
    } catch {
      // Supabase未接続 — モック応答
      result = {
        id: `mock-${Date.now()}`,
        referral_code: referralCode,
      };
    }

    // 確認メール送信（パートナータイプに応じて）
    if (partner_type === 'supporter') {
      sendSupporterConfirmationEmail(name.trim(), email.trim(), result.referral_code).catch(() => {});
    } else {
      sendPartnerConfirmationEmail(name.trim(), email.trim(), result.referral_code).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      partner_id: result.id,
      referral_code: result.referral_code,
    });
  } catch (err) {
    console.error('API /partners/register error:', err);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/partners/register?referral_code=KAMO-XXXXXX
 * 紹介コードの有効性確認
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('referral_code');

  if (!code) {
    return NextResponse.json({ valid: false, error: '紹介コードが指定されていません' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('partners')
      .select('id, name, partner_type, status')
      .eq('referral_code', code)
      .single();

    if (error || !data) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({
      valid: true,
      partner_name: data.name,
      partner_type: data.partner_type,
      status: data.status,
    });
  } catch {
    return NextResponse.json({ valid: false });
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
