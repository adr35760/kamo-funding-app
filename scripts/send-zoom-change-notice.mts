/**
 * 9/15 掲載説明会 申込者への「Zoom情報変更のご案内」を **1件ずつ** 送るスクリプト。
 *
 * 安全装置:
 *  - 既定は DRY RUN。実送信には  --send  を明示的に付ける必要がある。
 *  - --to <address> を付けると、そのアドレスにだけ1通送る（テスト送信用）。
 *  - registrations の status='registered' のみを対象にし、メールアドレスは
 *    小文字化して重複排除する（同一人物への二重送信を防ぐ）。
 *  - reminder_sent など既存フラグは**一切更新しない**（当日リマインドは通常どおり動く）。
 *  - 1通ごとに成否を出力し、最後に 成功/失敗 の件数を集計する。
 *    途中で失敗しても、どこまで送れたかが分かる。
 *
 * 使い方:
 *   npx tsx scripts/send-zoom-change-notice.mts                       # DRY RUN（件数のみ）
 *   npx tsx scripts/send-zoom-change-notice.mts --to a@b.com --send   # テスト送信1通
 *   npx tsx scripts/send-zoom-change-notice.mts --send                # 本送信（要承認）
 */
import { createClient } from '@supabase/supabase-js';
import { sendZoomChangeNoticeEmail } from '../src/lib/email';
import { formatEventDateJa } from '../src/lib/event-format';

const EVENT_ID = '94f5db1d-bc92-4cfd-bd14-fe9a3d463183'; // 第3回 掲載説明会（9/15）

const args = process.argv.slice(2);
const DO_SEND = args.includes('--send');
const toIdx = args.indexOf('--to');
const TEST_TO = toIdx >= 0 ? args[toIdx + 1] : null;

function mask(email: string): string {
  const [u, d] = email.split('@');
  return `${u.slice(0, 2)}***@${d}`;
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: ev, error: evErr } = await supabase
    .from('events')
    .select('title, event_date, duration_minutes')
    .eq('id', EVENT_ID)
    .single();
  if (evErr || !ev) throw new Error('event not found: ' + evErr?.message);

  const eventTitle = ev.title as string;
  const eventDateJa = formatEventDateJa(ev.event_date as string, ev.duration_minutes as number | null);
  console.log(`対象イベント: ${eventTitle} / ${eventDateJa}`);

  let recipients: Array<{ name: string; email: string }>;

  if (TEST_TO) {
    recipients = [{ name: 'テスト', email: TEST_TO }];
    console.log(`テスト送信モード: ${TEST_TO} に1通のみ`);
  } else {
    const { data: regs, error } = await supabase
      .from('registrations')
      .select('name, email, status')
      .eq('event_id', EVENT_ID)
      .eq('status', 'registered');
    if (error) throw new Error('registrations query failed: ' + error.message);

    const seen = new Set<string>();
    recipients = [];
    for (const r of regs ?? []) {
      const key = String(r.email).trim().toLowerCase();
      if (!key.includes('@')) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      recipients.push({ name: String(r.name), email: String(r.email).trim() });
    }
    console.log(`対象者: ${recipients.length}名（status=registered・メール重複排除後）`);
  }

  if (!DO_SEND) {
    console.log('DRY RUN — 1通も送信していません。実送信は --send を付けてください。');
    recipients.forEach((r, i) => console.log(`  ${i + 1}. ${mask(r.email)}`));
    return;
  }

  let ok = 0;
  const failed: string[] = [];
  for (const [i, r] of recipients.entries()) {
    const res = await sendZoomChangeNoticeEmail(r.name, r.email, eventTitle, eventDateJa);
    if (res.success) {
      ok++;
      console.log(`  [${i + 1}/${recipients.length}] OK   ${mask(r.email)}`);
    } else {
      failed.push(mask(r.email));
      console.log(`  [${i + 1}/${recipients.length}] FAIL ${mask(r.email)} — ${res.error}`);
    }
  }
  console.log(`\n送信結果: 成功 ${ok}件 / 失敗 ${failed.length}件 / 対象 ${recipients.length}件`);
  if (failed.length) console.log('失敗した宛先:', failed.join(', '));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
