/**
 * 業務通知の送信。
 *
 * 🔴 この層の最重要な性質: **通知の失敗で業務を止めない。**
 *   タスク完了・日報提出・タスク作成は、通知が飛ばなくても必ず成功させる。
 *   トークン未設定・room_id未登録・Chatwork障害はすべて「通知が出ないだけ」。
 *   例外は `login-request` だけ（リンクが届かなければログインが成立しないので、
 *   あちらは失敗扱いが正しい）。この関数は**絶対に throw しない**。
 *
 * 二重送信の防止:
 *   Cron は同じ日に複数回呼ばれ得る（手動実行・リトライ）。
 *   `dedupe_key` を `work_notifications` にユニーク（status='sent' のみ）で入れ、
 *   既に送信済みなら送らない。
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { buildGroupNotice, isChatworkConfigured, sendChatworkMessage } from './chatwork';

export type NotifyKind =
  | 'task_assigned'
  | 'due_tomorrow'
  | 'due_today'
  | 'overdue_digest'
  | 'report_submitted'
  | 'report_reminder'
  | 'meeting_reminder';

export interface NotifyOutcome {
  sent: boolean;
  reason?: 'not_configured' | 'no_room' | 'api_error' | 'duplicate';
}

/** 通知グループの room_id を設定テーブルから読む */
export async function getGroupRoomId(supabase: SupabaseClient): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('work_settings')
      .select('value')
      .eq('key', 'chatwork_group_room_id')
      .maybeSingle();
    if (error || !data?.value) return null;
    const v = String(data.value).trim();
    return v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

/**
 * 通知用グループへ1通送る。**失敗しても throw しない。**
 *
 * @param dedupeKey 同じ通知を二重に送らないための鍵。
 *   例: `overdue_digest:2026-09-28` / `task_assigned:<taskId>`
 */
export async function notifyGroup(
  supabase: SupabaseClient,
  args: {
    kind: NotifyKind;
    dedupeKey: string;
    toName: string | null;
    lines: string[];
  }
): Promise<NotifyOutcome> {
  const body = buildGroupNotice(args.toName, args.lines);

  try {
    // 既に送信済みなら何もしない
    const { data: existing } = await supabase
      .from('work_notifications')
      .select('id')
      .eq('dedupe_key', args.dedupeKey)
      .eq('status', 'sent')
      .maybeSingle();
    if (existing) return { sent: false, reason: 'duplicate' };

    if (!isChatworkConfigured()) {
      await logNotification(supabase, args.kind, args.dedupeKey, null, body, 'skipped', 'not_configured');
      return { sent: false, reason: 'not_configured' };
    }

    const roomId = await getGroupRoomId(supabase);
    if (!roomId) {
      await logNotification(supabase, args.kind, args.dedupeKey, null, body, 'skipped', 'group room_id not set');
      return { sent: false, reason: 'no_room' };
    }

    const res = await sendChatworkMessage(roomId, body);
    if (!res.ok) {
      await logNotification(supabase, args.kind, args.dedupeKey, roomId, body, 'failed', res.error ?? res.reason);
      return { sent: false, reason: res.reason === 'no_room' ? 'no_room' : 'api_error' };
    }

    await logNotification(supabase, args.kind, args.dedupeKey, roomId, body, 'sent', null);
    return { sent: true };
  } catch (e) {
    // 🔴 ここで例外を外に出さない。通知は補助機能。
    console.error('notifyGroup failed (業務は継続):', e instanceof Error ? e.message : e);
    return { sent: false, reason: 'api_error' };
  }
}

/** 送信ログ。ログの書き込み失敗も無視する（通知のために業務を止めない） */
async function logNotification(
  supabase: SupabaseClient,
  kind: NotifyKind,
  dedupeKey: string,
  roomId: string | null,
  body: string,
  status: 'sent' | 'failed' | 'skipped',
  error: string | null
): Promise<void> {
  try {
    await supabase.from('work_notifications').insert({
      kind,
      dedupe_key: dedupeKey,
      room_id: roomId,
      body: body.slice(0, 2000),
      status,
      error: error ? String(error).slice(0, 500) : null,
    });
  } catch {
    // 記録できなくても続行する
  }
}
