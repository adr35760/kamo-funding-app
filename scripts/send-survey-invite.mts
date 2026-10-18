/**
 * 掲載説明会後アンケートの **ご案内メール** を1件ずつ送るスクリプト。
 *
 * 対象: 指定した掲載説明会（info_session）に申し込んだ方（status='registered'）。
 *       --event を省略した場合は「直近の終了済み info_session」を使う。
 *
 * 安全装置:
 *  - 既定は DRY RUN。実送信には --send を明示的に付ける必要がある。
 *  - --to <address> を付けると、そのアドレスにだけ1通送る（テスト送信用）。
 *  - registrations は **読むだけ**。reminder_sent / status など既存フラグを
 *    一切更新しない（当日リマインド・FAQの対象判定を壊さない）。
 *  - メールアドレスを小文字化して重複排除する（同一人物への二重送信を防ぐ）。
 *  - email_logs（template_type='survey'）に「送信済み」がある申込は**送らない**。
 *    これが二重送信を防ぐ記録になる（過去に送った人へ再送しない）。
 *  - 宛先が0人なら1通も送らない。
 *  - 🔴 survey_responses テーブルが未作成なら --send を拒否する
 *    （回答ページが保存できない状態で案内を送ると、回答が失われる）。
 *    どうしても送る場合のみ --force を付ける。
 *
 * 使い方:
 *   npx tsx --env-file=.env scripts/send-survey-invite.mts                     # DRY RUN（直近終了回）
 *   npx tsx --env-file=.env scripts/send-survey-invite.mts --event <uuid>      # DRY RUN（回を指定）
 *   npx tsx --env-file=.env scripts/send-survey-invite.mts --html              # DRY RUN + 本文HTML保存
 *   npx tsx --env-file=.env scripts/send-survey-invite.mts --to a@b.com --send # テスト送信1通
 *   npx tsx --env-file=.env scripts/send-survey-invite.mts --event <uuid> --send  # 本送信（要承認）
 */
import { writeFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { sendSurveyInviteEmail, surveyInviteHtml, surveyUrlFor, SURVEY_INVITE_SUBJECT } from '../src/lib/email';
import { formatEventDateFullJa } from '../src/lib/event-format';
import { getEventEndTime } from '../src/lib/event-visibility';

const args = process.argv.slice(2);
const DO_SEND = args.includes('--send');
const DUMP_HTML = args.includes('--html');
const FORCE = args.includes('--force');
const toIdx = args.indexOf('--to');
const TEST_TO = toIdx >= 0 ? args[toIdx + 1] : null;
const eventIdx = args.indexOf('--event');
const EVENT_ARG = eventIdx >= 0 ? args[eventIdx + 1] : null;

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

  // ---- 対象イベントの解決 ----
  let ev: { id: string; title: string; event_date: string; duration_minutes: number | null } | null = null;
  if (EVENT_ARG) {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, event_date, duration_minutes, type')
      .eq('id', EVENT_ARG)
      .maybeSingle();
    if (error || !data) throw new Error(`指定イベントが見つかりません: ${EVENT_ARG} ${error?.message ?? ''}`);
    ev = data;
  } else {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, event_date, duration_minutes, type')
      .eq('type', 'info_session')
      .order('event_date', { ascending: false })
      .limit(50);
    if (error) throw new Error('events query failed: ' + error.message);
    const now = Date.now();
    ev = (data ?? []).find((e) => getEventEndTime(e).getTime() <= now) ?? null;
    if (!ev) throw new Error('終了済みの掲載説明会が見つかりません（--event で指定してください）');
  }

  const eventTitle = ev.title;
  const eventDateFullJa = formatEventDateFullJa(ev.event_date, ev.duration_minutes);
  const surveyUrl = surveyUrlFor(ev.id);
  console.log(`対象イベント: ${eventTitle} / ${eventDateFullJa}`);
  console.log(`回答ページ: ${surveyUrl}`);
  console.log(`件名: ${SURVEY_INVITE_SUBJECT}`);

  // ---- survey_responses の存在確認（未作成なら保存できない＝送ってはいけない） ----
  let tableReady = true;
  {
    const { error } = await supabase.from('survey_responses').select('id').limit(1);
    if (error && (error.code === '42P01' || error.code === 'PGRST205')) {
      tableReady = false;
    }
  }
  if (!tableReady) {
    console.log(
      '\n🔴 survey_responses テーブルが未作成です。この状態で案内を送ると、回答ページは開けても保存できません。\n' +
        '   Supabase の SQL Editor で「【アンケート】survey_responses_これを実行してください.sql」を実行してから送信してください。'
    );
    if (DO_SEND && !FORCE) {
      console.log('→ --send を中止しました（どうしても送る場合のみ --force を付けてください）。');
      return;
    }
  }

  if (DUMP_HTML) {
    const path = '/tmp/survey-invite-preview.html';
    writeFileSync(
      path,
      surveyInviteHtml({ name: '◯◯', eventTitle, eventDateFullJa, surveyUrl }),
      'utf-8'
    );
    console.log(`本文HTMLを保存: ${path}`);
  }

  // ---- 宛先の組み立て ----
  let recipients: Array<{ name: string; email: string; registrationId: string }>;

  if (TEST_TO) {
    recipients = [{ name: 'テスト', email: TEST_TO, registrationId: '' }];
    console.log(`テスト送信モード: ${TEST_TO} に1通のみ`);
  } else {
    const { data: regs, error: regErr } = await supabase
      .from('registrations')
      .select('id, name, email, status')
      .eq('event_id', ev.id);
    if (regErr) throw new Error('registrations query failed: ' + regErr.message);

    const active = (regs ?? []).filter((r) => r.status === 'registered');

    // 二重送信防止: この回で既に 'sent' のアンケート案内ログがある申込を除外
    const ids = active.map((r) => r.id as string);
    const alreadySent = new Set<string>();
    if (ids.length > 0) {
      const { data: logs, error: logErr } = await supabase
        .from('email_logs')
        .select('registration_id, template_type, status')
        .in('registration_id', ids)
        .eq('template_type', 'survey')
        .eq('status', 'sent');
      if (logErr) throw new Error('email_logs query failed: ' + logErr.message);
      for (const l of logs ?? []) alreadySent.add(l.registration_id as string);
    }

    const seen = new Set<string>();
    recipients = [];
    let skippedSent = 0;
    let skippedDup = 0;
    for (const r of active) {
      if (alreadySent.has(r.id as string)) { skippedSent++; continue; }
      const key = normalize(r.email);
      if (!key.includes('@')) continue;
      if (seen.has(key)) { skippedDup++; continue; }
      seen.add(key);
      recipients.push({ name: String(r.name), email: String(r.email).trim(), registrationId: r.id as string });
    }
    console.log(
      `申込 ${regs?.length ?? 0}行 → 有効(registered) ${active.length}件 / ` +
        `送信済みで除外 ${skippedSent}件 / アドレス重複で除外 ${skippedDup}件 → 対象 ${recipients.length}名`
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
    const res = await sendSurveyInviteEmail(r.name, r.email, eventTitle, eventDateFullJa, surveyUrl);
    // 成否を email_logs に記録する（記録の失敗は送信処理に影響させない）
    if (r.registrationId) {
      const { error: logErr } = await supabase.from('email_logs').insert({
        registration_id: r.registrationId,
        template_type: 'survey',
        status: res.success ? 'sent' : 'failed',
        error_message: res.success ? null : (res.error ?? 'unknown error').slice(0, 500),
        sent_at: new Date().toISOString(),
      });
      if (logErr) console.error(`  （ログ記録に失敗: ${logErr.message}）`);
    }
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
