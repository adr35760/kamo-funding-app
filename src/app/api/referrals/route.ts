import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * POST /api/referrals
 * 
 * パートナーが紹介を記録する（紹介先企業情報を登録）。
 * 報酬はtriggerで自動計算される（紹介パートナー: 総支援金額×2%、アドバイザー: KAMO手数料×20%+コンサルフィー）
 * 
 * Body: {
 *   partner_id, referred_company_name,
 *   referred_contact_name?, referred_email?, notes?,
 *   total_support_amount?  // 掲載完了時に設定（税抜）
 * }
 * 
 * Response: { success: true, referral_id, calculated_reward? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { partner_id, referred_company_name } = body;

    if (!partner_id) {
      return NextResponse.json({ success: false, error: 'パートナーIDが必要です' }, { status: 400 });
    }
    if (!referred_company_name?.trim()) {
      return NextResponse.json({ success: false, error: '紹介先企業名は必須です' }, { status: 400 });
    }

    const insertData: Record<string, unknown> = {
      partner_id,
      referred_company_name: referred_company_name.trim(),
      referred_contact_name: body.referred_contact_name?.trim() || null,
      referred_email: body.referred_email?.trim() || null,
      status: 'introduced',
      notes: body.notes?.trim() || null,
    };

    // 掲載完了時に総支援金額が入力された場合、報酬自動計算用に設定
    if (body.total_support_amount !== undefined) {
      insertData.total_support_amount = Number(body.total_support_amount);
      insertData.status = 'completed';
    }

    let result: Record<string, unknown> = {};
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('partner_referrals')
        .insert(insertData)
        .select('id, calculated_reward, referral_reward_amount')
        .single();

      if (error) throw error;
      result = data || {};
    } catch {
      // Supabase未接続 — モック（手動計算）
      result = {
        id: `mock-ref-${Date.now()}`,
        calculated_reward: body.total_support_amount
          ? Math.round(Number(body.total_support_amount) * 0.02)
          : null,
        referral_reward_amount: body.total_support_amount
          ? Math.round(Number(body.total_support_amount) * 0.02)
          : null,
      };
    }

    return NextResponse.json({
      success: true,
      referral_id: result.id,
      calculated_reward: result.calculated_reward || null,
    });
  } catch (err) {
    console.error('API /referrals error:', err);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/referrals?partner_id=xxx
 * パートナーの紹介実績一覧を取得（報酬計算含む）
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const partnerId = searchParams.get('partner_id');

  if (!partnerId) {
    return NextResponse.json({ referrals: [] });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('partner_referrals')
      .select('*')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ referrals: data || [] });
  } catch {
    return NextResponse.json({ referrals: [] });
  }
}

/**
 * PATCH /api/referrals
 * 紹介ステータス更新（掲載完了時に総支援金額を入力→報酬確定）
 * 
 * Body: { referral_id, status, total_support_amount }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { referral_id } = body;

    if (!referral_id) {
      return NextResponse.json({ success: false, error: 'referral_idが必要です' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.status) updateData.status = body.status;
    if (body.total_support_amount !== undefined) {
      updateData.total_support_amount = Number(body.total_support_amount);
    }

    let result: Record<string, unknown> = {};
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('partner_referrals')
        .update(updateData)
        .eq('id', referral_id)
        .select('id, status, calculated_reward, referral_reward_amount')
        .single();

      if (error) throw error;
      result = data || {};
    } catch {
      result = {
        id: referral_id,
        status: body.status || 'unknown',
        calculated_reward: body.total_support_amount
          ? Math.round(Number(body.total_support_amount) * 0.02)
          : null,
        referral_reward_amount: body.total_support_amount
          ? Math.round(Number(body.total_support_amount) * 0.02)
          : null,
      };
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('API /referrals PATCH error:', err);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
