/**
 * チャットワークへのメッセージ送信。
 *
 * 🔴 `CHATWORK_API_TOKEN` の値はまだ提供されていない（t iku が業務Bot用アカウントを作成中）。
 *   未設定のときは**送信せずに未設定であることを返す**。例外を投げない。
 *   ログイン処理が環境変数待ちで完全に止まってしまうのを避けるため。
 *
 * 🔴 トークンは `NEXT_PUBLIC_` を付けない環境変数から読む（配信JSに埋め込ませない）。
 */

const CHATWORK_API_BASE = 'https://api.chatwork.com/v2';

export function isChatworkConfigured(): boolean {
  return normalize(process.env.CHATWORK_API_TOKEN).length > 0;
}

export type ChatworkResult =
  | { ok: true; messageId: string | null }
  | { ok: false; reason: 'not_configured' | 'no_room' | 'api_error'; error?: string };

/**
 * 指定ルームにメッセージを送る。
 *
 * @param roomId 送信先のルームID。
 *   🔴 ログインリンクを送るときは**必ず個人チャット（1対1）のID**を渡すこと。
 *     通知用グループのIDを渡すと、グループを見られる全員が他人になりすませる。
 */
export async function sendChatworkMessage(
  roomId: string | null | undefined,
  body: string
): Promise<ChatworkResult> {
  const token = normalize(process.env.CHATWORK_API_TOKEN);
  if (!token) return { ok: false, reason: 'not_configured' };
  if (!roomId || !String(roomId).trim()) return { ok: false, reason: 'no_room' };

  try {
    const res = await fetch(`${CHATWORK_API_BASE}/rooms/${encodeURIComponent(String(roomId).trim())}/messages`, {
      method: 'POST',
      headers: {
        'X-ChatWorkToken': token,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ body }).toString(),
      cache: 'no-store',
    });

    if (!res.ok) {
      // 🔴 応答本文にトークンは含まれないが、念のため長さを切って返す
      const text = (await res.text().catch(() => '')).slice(0, 200);
      return { ok: false, reason: 'api_error', error: `status=${res.status} ${text}` };
    }
    const data = (await res.json().catch(() => null)) as { message_id?: string } | null;
    return { ok: true, messageId: data?.message_id ?? null };
  } catch (e) {
    return { ok: false, reason: 'api_error', error: e instanceof Error ? e.message : 'unknown' };
  }
}

/** ログインリンクの文面。誰宛か分かるように名前を先頭に置く */
export function buildLoginMessage(name: string, url: string, minutes: number): string {
  return [
    `[info][title]業務管理システム ログインリンク[/title]`,
    `${name} さん`,
    '',
    '下のリンクを開くとログインできます。',
    url,
    '',
    `※ このリンクは ${minutes}分で無効になります。1回しか使えません。`,
    '※ 心当たりがない場合は開かずに破棄してください。',
    '[/info]',
  ].join('\n');
}

function normalize(value: string | undefined): string {
  if (!value) return '';
  let v = value.replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');
  if (
    v.length >= 2 &&
    ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
  ) {
    v = v.slice(1, -1).replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');
  }
  return v;
}

/**
 * 業務Botから見えるルームの一覧（Chatwork API `GET /rooms`）。
 *
 * 🔴 ルームID登録UIのためにある。t iku に `#!rid●●●●` の数字を
 *   手で探させると必ず詰まるので、名前つきの候補を出して選ばせる。
 */
export interface ChatworkRoom {
  room_id: number;
  name: string;
  /** 'my' | 'direct' | 'group' */
  type: string;
}

export type ChatworkRoomsResult =
  | { ok: true; rooms: ChatworkRoom[] }
  | { ok: false; reason: 'not_configured' | 'api_error'; error?: string };

export async function listChatworkRooms(): Promise<ChatworkRoomsResult> {
  const token = normalize(process.env.CHATWORK_API_TOKEN);
  if (!token) return { ok: false, reason: 'not_configured' };

  try {
    const res = await fetch(`${CHATWORK_API_BASE}/rooms`, {
      method: 'GET',
      headers: { 'X-ChatWorkToken': token },
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = (await res.text().catch(() => '')).slice(0, 200);
      return { ok: false, reason: 'api_error', error: `status=${res.status} ${text}` };
    }
    const data = (await res.json().catch(() => null)) as ChatworkRoom[] | null;
    if (!Array.isArray(data)) return { ok: false, reason: 'api_error', error: 'unexpected response' };
    return {
      ok: true,
      rooms: data.map(r => ({
        room_id: Number(r.room_id),
        name: String(r.name ?? ''),
        type: String(r.type ?? ''),
      })),
    };
  } catch (e) {
    return { ok: false, reason: 'api_error', error: e instanceof Error ? e.message : 'unknown' };
  }
}

/**
 * 業務通知の本文。
 * 🔴 通知用グループに1本送る形なので、**誰宛かを先頭に必ず付ける**
 *   （全員が見るグループなので、宛名が無いと自分宛か判断できない）。
 */
export function buildGroupNotice(toName: string | null, lines: string[]): string {
  const head = toName ? `[${toName}さん] ` : '';
  const [first, ...rest] = lines;
  return [`${head}${first ?? ''}`, ...rest].join('\n');
}
