import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendPartnerSessionConfirmationEmail, sendPartnerSessionAdminNotification } from '@/lib/email';
import { formatSlotJa } from '@/lib/event-format';

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
    // datetime-local の値（例 "2026-09-10T20:00"）は日本語表記に整形して保存・メール表示。
    // 旧テキスト入力の自由記述が来た場合はそのまま通す（formatSlotJa が非対応形式を素通しする）。
    const slot1 = formatSlotJa(body.preferred_slot_1?.trim() || '');
    const slot2 = formatSlotJa(body.preferred_slot_2?.trim() || '');
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

    // 確認メール送信（希望日時を本文に記載）— 従来どおり申込者宛
    sendPartnerSessionConfirmationEmail(name.trim(), email.trim(), preferredSlots || undefined).catch(() => {});

    // 運営宛の申込通知（対応漏れ防止）。
    // ★通知の失敗は申込処理を絶対に止めない：await せず、失敗はログのみ。
    sendPartnerSessionAdminNotification({
      name: name.trim(),
      email: email.trim(),
      company: body.company?.trim() || null,
      profession: body.profession?.trim() || null,
      programInterest: body.program_interest || null,
      preferredSlot1: slot1 || null,
      preferredSlot2: slot2 || null,
      message: body.message?.trim() || null,
      registrationId: result.id,
    })
      .then(r => {
        if (!r.success) {
          console.error('Admin notification failed (application still succeeded):', r.error);
        }
      })
      .catch(e => {
        console.error('Admin notification threw (application still succeeded):', e);
      });

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
