import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendApplyConfirmationEmail } from '@/lib/email';

/**
 * POST /api/apply
 * 
 * Designer LPのフォームから申込を受け付けるエンドポイント。
 * フォームの action="/api/apply" に対応。
 * 
 * Body: { name, email, company, event_id, source, challenge }
 * Response: { success: true, registration_id: "..." }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 入力バリデーション
    const { name, email, event_id, company, source, challenge } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'お名前は必須です' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: '有効なメールアドレスを入力してください' },
        { status: 400 }
      );
    }

    if (!event_id || typeof event_id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'イベントを選択してください' },
        { status: 400 }
      );
    }

    // Supabaseに申込をINSERT
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('registrations')
      .insert({
        event_id,
        name: name.trim(),
        email: email.trim(),
        company: company?.trim() || null,
        referrer_source: source || null,
        challenge_description: challenge?.trim() || null,
        status: 'registered',
      })
      .select('id')
      .single();

    if (error) {
      // 重複エラー（同一イベントに重複申込）
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'このイベントには既に申込済みです' },
          { status: 409 }
        );
      }
      console.error('Registration insert error:', error);
      return NextResponse.json(
        { success: false, error: '申込処理中にエラーが発生しました' },
        { status: 500 }
      );
    }

    // 確認メール送信
    sendApplyConfirmationEmail(email.trim(), name.trim()).catch(() => {});

    return NextResponse.json({
      success: true,
      registration_id: data.id,
    });
  } catch (err) {
    console.error('API /apply error:', err);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
