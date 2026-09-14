/**
 * 第3回 掲載説明会（9/15）の **お誘いメール** を1件ずつ送るスクリプト。
 *
 * 対象: 第1回（8/18）または第2回（8/28）の申込者のうち、
 *       第3回（9/15）にまだ申し込んでいない方。メールアドレスで重複排除。
 *
 * 安全装置:
 *  - 既定は DRY RUN。実送信には  --send  を明示的に付ける必要がある。
 *  - --to <address> を付けると、そのアドレスにだけ1通送る（テスト送信用）。
 *  - registrations は **読むだけ**。reminder_sent / status など既存フラグを
 *    一切更新しない（当日リマインドの対象判定を壊さない）。
 *  - メールアドレスを小文字化して重複排除する（同一人物への二重送信を防ぐ）。
 *  - 1通ごとに成否を出力し、最後に 成功/失敗 の件数と失敗した宛先を出す。
 *    途中で失敗しても、どこまで送れたかが分かる。
 *
 * なぜ send-zoom-change-notice.mts を改造せず新規に作るか:
 *  あちらは9/15申込者へのZoom変更通知として実行済みで、**何を誰に送ったかの
 *  記録**としてそのまま残したい。抽出条件が違う送信を同じファイルに
 *  上書きすると、過去の送信内容が追えなくなる。
 *
 * 使い方:
 *   npx tsx scripts/send-seminar3-invite.mts                       # DRY RUN（対象一覧のみ）
 *   npx tsx scripts/send-seminar3-invite.mts --html                # DRY RUN + 本文HTMLを保存
 *   npx tsx scripts/send-seminar3-invite.mts --to a@b.com --send   # テスト送信1通
 *   npx tsx scripts/send-seminar3-invite.mts --send                # 本送信（要承認）
 */
import { writeFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { sendSeminarInviteEmail, seminarInviteSubject, seminarInviteHtml } from '../src/lib/email';
import { formatEventDateJa, formatEventDateFullJa } from '../src/lib/event-format';

/** 第3回 掲載説明会（9/15）— 案内する回。ここに申込済みの人は対象外 */
const TARGET_EVENT_ID = '94f5db1d-bc92-4cfd-bd14-fe9a3d463183';

/** お誘いの母集団 = 第1回（8/18）・第2回（8/28）の申込者 */
const SOURCE_EVENT_IDS = [
  '0ae42e1f-3bf0-4ca7-ae2f-28e8b64d2e37', // 第1回 8/18
  '851bfae5-b804-4fe8-95bc-a1e70689192e', // 第2回 8/28
];

const args = process.argv.slice(2);
const DO_SEND = args.includes('--send');
const DUMP_HTML = args.includes('--html');
const toIdx = args.indexOf('--to');
const TEST_TO = toIdx >= 0 ? args[toIdx + 1] : null;

function mask(email: string): string {
  const [u, d] = email.split('@');
  return `${u.slice(0, 2)}***@${d}`;
}

function normalize(email: unknown): string {
  return String(email ?? '').trim().toLowerCase();
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
    .eq('id', TARGET_EVENT_ID)
    .single();
  if (evErr || !ev) throw new Error('event not found: ' + evErr?.message);

  const eventTitle = ev.title as string;
  const eventDateJa = formatEventDateJa(ev.event_date as string, ev.duration_minutes as number | null);
  // 本文の「2026年9月15日（火）」は **event_date から算出**する。
  // 曜日を文面にベタ書きすると年が変わった瞬間に嘘になる（9/15は2026年は火、2025年は月）。
  const eventDateFullJa = formatEventDateFullJa(ev.event_date as string, ev.duration_minutes as number | null);
  console.log(`案内するイベント: ${eventTitle} / ${eventDateFullJa}`);
  console.log(`件名: ${seminarInviteSubject(eventDateJa)}`);

  if (DUMP_HTML) {
    const path = '/tmp/seminar3-invite-preview.html';
    writeFileSync(path, seminarInviteHtml({ name: '◯◯', eventTitle, eventDateFullJa }), 'utf-8');
    console.log(`本文HTMLを保存: ${path}`);
  }

  let recipients: Array<{ name: string; email: string }>;

  if (TEST_TO) {
    recipients = [{ name: 'テスト', email: TEST_TO }];
    console.log(`テスト送信モード: ${TEST_TO} に1通のみ`);
  } else {
    // 第1回・第2回の申込者（母集団）
    const { data: src, error: srcErr } = await supabase
      .from('registrations')
      .select('name, email, event_id, status')
      .in('event_id', SOURCE_EVENT_IDS)
      .eq('status', 'registered');
    if (srcErr) throw new Error('source query failed: ' + srcErr.message);

    // 第3回に申込済みのアドレス（除外セット）
    const { data: already, error: alErr } = await supabase
      .from('registrations')
      .select('email')
      .eq('event_id', TARGET_EVENT_ID);
    if (alErr) throw new Error('target query failed: ' + alErr.message);
    const alreadyApplied = new Set((already ?? []).map(r => normalize(r.email)));

    const seen = new Set<string>();
    recipients = [];
    let skippedApplied = 0;
    let skippedDup = 0;
    for (const r of src ?? []) {
      const key = normalize(r.email);
      if (!key.includes('@')) continue;
      if (alreadyApplied.has(key)) { skippedApplied++; continue; }
      if (seen.has(key)) { skippedDup++; continue; }
      seen.add(key);
      recipients.push({ name: String(r.name), email: String(r.email).trim() });
    }
    console.log(
      `母集団 ${src?.length ?? 0}行 → 第3回申込済みで除外 ${skippedApplied}件 / ` +
      `アドレス重複で除外 ${skippedDup}件 → 対象 ${recipients.length}名`
    );
  }

  if (!DO_SEND) {
    console.log('DRY RUN — 1通も送信していません。実送信は --send を付けてください。');
    recipients.forEach((r, i) => console.log(`  ${i + 1}. ${r.name} ${mask(r.email)}`));
    return;
  }

  let ok = 0;
  const failed: string[] = [];
  for (const [i, r] of recipients.entries()) {
    const res = await sendSeminarInviteEmail(r.name, r.email, eventTitle, eventDateJa, eventDateFullJa);
    if (res.success) {
      ok++;
      console.log(`  [${i + 1}/${recipients.length}] OK   ${r.name} ${mask(r.email)}`);
    } else {
      failed.push(`${r.name} ${mask(r.email)}`);
      console.log(`  [${i + 1}/${recipients.length}] FAIL ${r.name} ${mask(r.email)} — ${res.error}`);
    }
  }
  console.log(`\n送信結果: 成功 ${ok}件 / 失敗 ${failed.length}件 / 対象 ${recipients.length}件`);
  if (failed.length) console.log('失敗した宛先:', failed.join(', '));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
