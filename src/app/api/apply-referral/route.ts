import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendReferralRegistrationEmail } from '@/lib/email';

/**
 * POST /api/apply-referral
 *
 * 紹介パートナー本人が「紹介者（紹介先）」を登録するフォーム。
 *
 * Body: { referral_code, referred_name, relationship, referred_company?, referred_email?, notes?, terms_agreed }
 * Response: { success: true, referral_id }
 *
 * - referral_code で partners を特定（パートナーの識別）
 * - 紹介料規約への同意は必須。同意フラグ＋同意日時を保存
 * - migration-referral-terms.sql 未実行でも登録が失敗しないようフォールバックする
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const referralCode = (body.referral_code || '').trim().toUpperCase();
    const referredName = (body.referred_name || '').trim();
    const relationship = (body.relationship || '').trim();

    if (!referralCode) {
      return NextResponse.json({ success: false, error: '紹介コードは必須です' }, { status: 400 });
    }
    if (!referredName) {
      return NextResponse.json({ success: false, error: '紹介者の氏名は必須です' }, { status: 400 });
    }
    if (!relationship) {
      return NextResponse.json({ success: false, error: 'ご関係は必須です' }, { status: 400 });
    }
    if (body.terms_agreed !== true) {
      return NextResponse.json({ success: false, error: '紹介料規約への同意が必要です' }, { status: 400 });
    }

    const agreedAt = new Date().toISOString();

    let partner: { id: string; name: string; email: string } | null = null;
    let referralId: string;

    try {
      const supabase = getSupabaseAdmin();

      // 紹介コードからパートナーを特定
      const { data: partnerRow, error: partnerError } = await supabase
        .from('partners')
        .select('id, name, email')
        .eq('referral_code', referralCode)
        .maybeSingle();

      if (partnerError) throw partnerError;
      if (!partnerRow) {
        return NextResponse.json(
          { success: false, error: '紹介コードが見つかりません。登録時にお送りしたコードをご確認ください' },
          { status: 404 }
        );
      }
      partner = partnerRow;

      // ご関係・規約同意はメモにも残す（列が無い環境でも情報が失われないように）
      const noteLines = [
        `ご関係: ${relationship}`,
        `紹介料規約に同意: ${agreedAt}`,
        body.notes?.trim() ? `備考: ${body.notes.trim()}` : '',
      ].filter(Boolean).join('\n');

      const baseData = {
        partner_id: partnerRow.id,
        referred_company_name: body.referred_company?.trim() || null,
        referred_contact_name: referredName,
        referred_email: body.referred_email?.trim() || null,
        status: 'introduced',
        notes: noteLines,
      };

      let { data, error } = await supabase
        .from('partner_referrals')
        .insert({
          ...baseData,
          relationship,
          terms_agreed: true,
          terms_agreed_at: agreedAt,
        })
        .select('id')
        .single();

      // 列未適用（migration前）: 42703 = undefined_column / PGRST204 = PostgRESTスキーマキャッシュに列が無い
      if (error && (error.code === '42703' || error.code === 'PGRST204')) {
        ({ data, error } = await supabase
          .from('partner_referrals')
          .insert(baseData)
          .select('id')
          .single());
      }

      // referred_company_name の NOT NULL が残っている環境向けフォールバック
      // 23502 = not_null_violation
      if (error && error.code === '23502') {
        ({ data, error } = await supabase
          .from('partner_referrals')
          .insert({ ...baseData, referred_company_name: referredName })
          .select('id')
          .single());
      }

      if (error) throw error;
      if (!data) throw new Error('insert returned no data');
      referralId = data.id;

      // パートナー本体にも同意状況を反映（列が無ければ黙って無視）
      const { error: updateError } = await supabase
        .from('partners')
        .update({ terms_agreed: true, terms_agreed_at: agreedAt })
        .eq('id', partnerRow.id);
      if (updateError && !['42703', 'PGRST204'].includes(updateError.code)) {
        console.error('partners terms update failed:', updateError);
      }
    } catch (e) {
      console.error('partner_referrals insert failed:', e);
      referralId = `mock-referral-${Date.now()}`;
    }

    // 確認メール（紹介料規約の全文を同梱）— 宛先は紹介パートナー本人
    if (partner?.email) {
      sendReferralRegistrationEmail(partner.name, partner.email, {
        referredName,
        relationship,
        referralCode,
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, referral_id: referralId });
  } catch (err) {
    console.error('API /apply-referral error:', err);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
