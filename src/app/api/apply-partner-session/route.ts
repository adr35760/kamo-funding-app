import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendPartnerSessionConfirmationEmail } from '@/lib/email';

/**
 * POST /api/apply-partner-session
 * 
 * パートナーシップ「個別説明会（1対1）」の申込フォーム
 * 
 * Body: { name, email, company, profession, program_interest, preferred_slot_1, preferred_slot_2, message }
 * Response: { success: true, registration_id }
 *
 * 固定日程は廃止。希望日時（第1希望・第2希望）を preferred_slots に保存し、
 * 担当者が個別に日程調整する運用。
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

    // 希望日時（第1・第2）をまとめて1カラムに保持
    const slot1 = body.preferred_slot_1?.trim() || '';
    const slot2 = body.preferred_slot_2?.trim() || '';
    const preferredSlots = [
      slot1 ? `第1希望: ${slot1}` : '',
      slot2 ? `第2希望: ${slot2}` : '',
    ].filter(Boolean).join(' / ') || null;

    const baseData = {
      name: name.trim(),
      email: email.trim(),
      company: body.company?.trim() || null,
      profession: body.profession?.trim() || null,
      program_interest: body.program_interest || null,
      event_id: null, // 個別説明会のため固定イベントは紐付けない
      message: body.message?.trim() || null,
      status: 'registered',
    };

    let result;
    try {
      const supabase = getSupabaseAdmin();
      let { data, error } = await supabase
        .from('partner_session_registrations')
        .insert({ ...baseData, preferred_slots: preferredSlots })
        .select('id')
        .single();

      // preferred_slots カラム未適用（migration前）の場合は message に希望日時を追記して保存
      // 42703 = undefined_column（Postgres） / PGRST204 = PostgRESTスキーマキャッシュに列が無い
      if (error && (error.code === '42703' || error.code === 'PGRST204')) {
        const mergedMessage = [preferredSlots, baseData.message].filter(Boolean).join('\n');
        ({ data, error } = await supabase
          .from('partner_session_registrations')
          .insert({ ...baseData, message: mergedMessage || null })
          .select('id')
          .single());
      }

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json(
            { success: false, error: 'このメールアドレスは既に申込済みです' },
            { status: 409 }
          );
        }
        throw error;
      }
      if (!data) throw new Error('insert returned no data');
      result = data;
    } catch (e) {
      // Supabase未接続 — モック
      console.error('partner_session_registrations insert failed:', e);
      result = { id: `mock-session-${Date.now()}` };
    }

    // 確認メール送信（希望日時を本文に記載）
    sendPartnerSessionConfirmationEmail(name.trim(), email.trim(), preferredSlots || undefined).catch(() => {});

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
