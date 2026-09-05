import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendApplyConfirmationEmail } from '@/lib/email';
import { formatEventDateJa } from '@/lib/event-format';
import { isEventFinished } from '@/lib/event-visibility';
import { normalizeUtmValue } from '@/lib/utm';

/**
 * POST /api/apply
 * 
 * Designer LPのフォームから申込を受け付けるエンドポイント。
 * フォームの action="/api/apply" に対応。
 * 
 * Body: { name, email, company, event_id, source, challenge }
 * Response: { success: true, registration_id: "..." }
 */
/**
 * registrations に UTM列（utm_source / utm_medium / utm_campaign）が
 * 未追加かを判定する。PostgREST はスキーマキャッシュ由来の PGRST204、
 * 直接SQL経路では Postgres の 42703 を返すため両方を見る。
 */
function isMissingUtmColumn(error: { code?: string; message?: string }): boolean {
  const msg = error.message || '';
  return (
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    (/utm_(source|medium|campaign)/.test(msg) &&
      /column|could not find|does not exist/i.test(msg))
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 入力バリデーション
    const { name, email, event_id, company, source, challenge } = body;

    // 流入元（UTM）。サーバ側でも正規化する（クライアントを迂回した送信でも表記を揃える）。
    // 値が無ければ null。**UTMは申込の必須条件ではない**。
    const utm = {
      utm_source: normalizeUtmValue(body.utm_source),
      utm_medium: normalizeUtmValue(body.utm_medium),
      utm_campaign: normalizeUtmValue(body.utm_campaign),
    };

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

    // 開催終了済み／中止の回への申込を拒否
    // （サーバー側判定・フォームを迂回した直接送信も防ぐ）
    try {
      const { data: evCheck } = await supabaseAdmin
        .from('events')
        .select('event_date, duration_minutes, status')
        .eq('id', event_id)
        .single();
      // 中止・下書きの回は受け付けない。
      // これがないと、中止後もURL直叩きやキャッシュされた古いフォームから
      // 申込が通り、申込完了メールが届いてしまう（当日来場の事故になる）。
      const evStatus = evCheck?.status as string | undefined;
      if (evStatus === 'cancelled') {
        return NextResponse.json(
          { success: false, error: 'この回は開催中止となりました。別の日程をお選びください。' },
          { status: 409 }
        );
      }
      if (evStatus === 'draft') {
        return NextResponse.json(
          { success: false, error: 'この回はまだ受付を開始していません。' },
          { status: 409 }
        );
      }
      if (evCheck && isEventFinished({
        event_date: evCheck.event_date as string,
        duration_minutes: (evCheck.duration_minutes as number | null) ?? null,
      })) {
        return NextResponse.json(
          { success: false, error: 'この回は開催が終了しました。別の日程をお選びください。' },
          { status: 409 }
        );
      }
    } catch (e) {
      // 判定に失敗しても申込自体は妨げない（可用性優先）
      console.error('Finished-event check failed:', e);
    }

    // 定員チェック（capacity が設定されているイベントのみ）
    // capacity が NULL のイベントは上限なしとして扱う
    try {
      const { data: capEvent } = await supabaseAdmin
        .from('events')
        .select('capacity')
        .eq('id', event_id)
        .single();
      const capacity = (capEvent?.capacity as number | null) ?? null;
      if (capacity && capacity > 0) {
        const { count } = await supabaseAdmin
          .from('registrations')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', event_id)
          .eq('status', 'registered');
        if (typeof count === 'number' && count >= capacity) {
          return NextResponse.json(
            {
              success: false,
              error: '申し訳ありません。この回は定員に達したため受付を終了しました。別の回をご検討ください。',
            },
            { status: 409 }
          );
        }
      }
    } catch (e) {
      // 定員チェックに失敗しても申込自体は妨げない（可用性優先）
      console.error('Capacity check failed:', e);
    }

    // 申込レコードの基本項目（UTM列が無い環境でも必ず通る内容）
    const baseRow = {
      event_id,
      name: name.trim(),
      email: email.trim(),
      company: company?.trim() || null,
      // 既存の「参加経路」（本人申告のselect）。UTMとは別物なので併存させる
      referrer_source: source || null,
      challenge_description: challenge?.trim() || null,
      status: 'registered',
    };

    let { data, error } = await supabaseAdmin
      .from('registrations')
      .insert({ ...baseRow, ...utm })
      .select('id')
      .single();

    // 🔴 UTM列が未追加（マイグレーション未実行）の場合は、**UTMだけ捨てて申込を通す**。
    // ここは実ユーザーの申込フロー。列の有無で申込が落ちるのが最悪の事故なので必ず救済する。
    if (error && isMissingUtmColumn(error)) {
      console.warn('registrations: UTM columns missing — inserting without UTM');
      const retry = await supabaseAdmin
        .from('registrations')
        .insert(baseRow)
        .select('id')
        .single();
      data = retry.data;
      error = retry.error;
    }

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

    // 選択されたイベント情報を取得（開催日時をメールに記載するため）
    let eventTitle: string | undefined;
    let eventDateJa: string | undefined;
    let eventPillar: number | null = null;
    try {
      const { data: ev } = await supabaseAdmin
        .from('events')
        .select('title, event_date, duration_minutes, pillar')
        .eq('id', event_id)
        .single();
      if (ev) {
        eventTitle = (ev.title as string) || undefined;
        eventDateJa = formatEventDateJa(ev.event_date as string, ev.duration_minutes as number | null);
        eventPillar = (ev.pillar as number) ?? null;
      }
    } catch (e) {
      console.error('Event fetch for email failed:', e);
    }

    // 確認メール送信（エラーを返さないが、結果をログに出す）
    const emailResult = await sendApplyConfirmationEmail(name.trim(), email.trim(), eventTitle, eventDateJa, eventPillar);
    if (!emailResult.success) {
      console.error('Email send failed:', emailResult.error);
    }

    return NextResponse.json({
      success: true,
      registration_id: data?.id,
      email_sent: emailResult.success,
      email_error: emailResult.success ? undefined : emailResult.error,
    });
  } catch (err) {
    console.error('API /apply error:', err);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
