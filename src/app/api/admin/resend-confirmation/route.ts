import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendApplyConfirmationEmail } from '@/lib/email';
import { formatEventDateJa } from '@/lib/event-format';
import { logEmailResult } from '@/lib/email-log';

/**
 * POST /api/admin/resend-confirmation
 * body: { registration_id: string, force?: boolean }
 *
 * 申込完了メールが届いていない人へ **手動で** 再送する。
 * middleware の /admin 配下ではないため、パスは /api/admin/* を
 * Basic認証の matcher に含めてある（middleware.ts 参照）。
 *
 * 設計方針:
 *  - 🔴 **自動リトライはしない。** 二重送信の温床になるため、
 *    管理者が明示的に押したときだけ送る。
 *  - 🔴 **二重送信ガード**: 既に送信成功（status='sent'）の記録がある申込には
 *    送らず 409 を返す。どうしても送る場合は force:true を要求する。
 *  - 送信結果は email_logs に追記するので、再送の履歴も残る。
 */
export async function POST(request: Request) {
  let body: { registration_id?: string; force?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'リクエスト形式が不正です' }, { status: 400 });
  }

  const registrationId = body.registration_id;
  const force = body.force === true;

  if (!registrationId || typeof registrationId !== 'string') {
    return NextResponse.json({ ok: false, error: 'registration_id が必要です' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // 申込を取得
    const { data: reg, error: regErr } = await supabase
      .from('registrations')
      .select('id, name, email, event_id, status')
      .eq('id', registrationId)
      .single();

    if (regErr || !reg) {
      return NextResponse.json({ ok: false, error: '申込が見つかりません' }, { status: 404 });
    }

    // 二重送信ガード: すでに送信成功の記録がある場合は止める
    if (!force) {
      const { data: sentLogs } = await supabase
        .from('email_logs')
        .select('id, sent_at')
        .eq('registration_id', registrationId)
        .eq('template_type', 'confirmation')
        .eq('status', 'sent')
        .limit(1);
      if (sentLogs && sentLogs.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            code: 'ALREADY_SENT',
            error: 'この申込には既に完了メールが送信されています。重複送信を防ぐため中止しました。',
            sent_at: sentLogs[0].sent_at,
          },
          { status: 409 }
        );
      }
    }

    // イベント情報（日時・会場/Zoomの出し分けに使う）
    let eventTitle: string | undefined;
    let eventDateJa: string | undefined;
    let eventPillar: number | null = null;
    // 生のISO日時。リアル回の「セミナー／懇親会」内訳をメールに出すために渡す
    let eventDateIso: string | null = null;
    const { data: ev } = await supabase
      .from('events')
      .select('title, event_date, duration_minutes, pillar')
      .eq('id', reg.event_id as string)
      .single();
    if (ev) {
      eventTitle = (ev.title as string) || undefined;
      eventDateJa = formatEventDateJa(ev.event_date as string, ev.duration_minutes as number | null);
      eventPillar = (ev.pillar as number) ?? null;
      eventDateIso = (ev.event_date as string) ?? null;
    }

    const result = await sendApplyConfirmationEmail(
      reg.name as string,
      reg.email as string,
      eventTitle,
      eventDateJa,
      eventPillar,
      eventDateIso
    );

    // 再送の結果も記録する（履歴が追える）
    await logEmailResult({
      registrationId: reg.id as string,
      templateType: 'confirmation',
      success: result.success,
      error: result.success ? undefined : result.error,
    });

    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: result.error || '再送に失敗しました' },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, resent: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : '再送に失敗しました' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
