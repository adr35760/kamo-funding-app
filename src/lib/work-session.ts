/**
 * `/api/work/*` のサーバー側セッション検証。
 *
 * 🔴 すべての `/api/work/*` はこれを最初に呼ぶ。
 *   middleware でも弾いているが、**APIごとにも必ず確認する**（二重にする）。
 *   過去に `/api/ai/*` が画面のパスワードだけで守られていて素通しだった事故があるため、
 *   「画面の出し分け」「middleware だけ」には頼らない。
 */

import { NextRequest, NextResponse } from 'next/server';
import { WORK_SESSION_COOKIE, timingSafeEqualHex, verifyWorkSession, type WorkSession } from './work-auth';

export function unauthorizedJson(message = 'ログインが必要です') {
  return NextResponse.json(
    { success: false, error: message, login: '/work/login' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } }
  );
}

export function forbiddenJson(message = 'この操作は管理者のみ行えます') {
  return NextResponse.json(
    { success: false, error: message },
    { status: 403, headers: { 'Cache-Control': 'no-store' } }
  );
}

/** セッションを取り出す。無効なら null */
export async function getWorkSession(request: NextRequest): Promise<WorkSession | null> {
  return verifyWorkSession(request.cookies.get(WORK_SESSION_COOKIE)?.value);
}

/**
 * ログイン必須のAPIの入口。
 * 使い方: `const auth = await requireWorkSession(request); if ('response' in auth) return auth.response;`
 */
export async function requireWorkSession(
  request: NextRequest
): Promise<{ session: WorkSession } | { response: NextResponse }> {
  const session = await getWorkSession(request);
  if (!session) return { response: unauthorizedJson() };
  return { session };
}

/** 管理者専用のAPIの入口 */
export async function requireWorkAdmin(
  request: NextRequest
): Promise<{ session: WorkSession } | { response: NextResponse }> {
  const session = await getWorkSession(request);
  if (!session) return { response: unauthorizedJson() };
  if (session.role !== 'admin') return { response: forbiddenJson() };
  return { session };
}

/**
 * 初回設定だけのための認証: 業務管理の admin **または**既存サイト管理者。
 *
 * 🔴 なぜ必要か（鶏と卵の問題）:
 *   `/work` のログインは「個人チャットにリンクを送る」方式なので、
 *   `work_users.chatwork_room_id` が未登録だと**誰一人ログインできない**。
 *   ところが room_id を登録する画面が `/work/admin`（=ログイン必須）にあると、
 *   永久に設定できない。実際いま本番は4名全員 room_id が NULL でこの状態。
 *
 *   そこで room_id 登録に限り、既存 `/admin` の管理者
 *   （Googleログイン、または移行期間のBasic認証）でも通す。
 *   - 既存の管理者認証は 2026-09-18 に整備済みで、t iku が日常的に使っている
 *   - 新しい抜け道を作らず、**既にある同等以上の認証**を再利用する
 *   - 対象は**設定系のみ**。タスク・日報・ダッシュボードには広げない
 *
 * 🔴 Basic認証のヘッダは middleware が検証済みだが、この関数は
 *   **APIからも直接呼ばれる**ので自分でも確認する（middleware 頼みにしない）。
 */
export async function requireWorkAdminOrSiteAdmin(
  request: NextRequest
): Promise<{ session: WorkSession | null; via: 'work' | 'site' } | { response: NextResponse }> {
  // 1. 業務管理の admin セッション
  const session = await getWorkSession(request);
  if (session?.role === 'admin') return { session, via: 'work' };

  // 2. 既存サイト管理者（Googleログインのセッション）
  const { ADMIN_SESSION_COOKIE, verifyAdminSession, isGoogleLoginConfigured } = await import(
    './admin-auth'
  );
  const adminSession = await verifyAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (adminSession) return { session: null, via: 'site' };

  // 3. 移行期間の Basic 認証（Googleログイン未設定のときだけ有効）
  if (!isGoogleLoginConfigured() && verifyBasicAuth(request)) {
    return { session: null, via: 'site' };
  }

  if (session) return { response: forbiddenJson() };
  return { response: unauthorizedJson() };
}

/**
 * Basic認証の検証。`middleware.ts` の実装と同じ判定を行う。
 * Googleログインが設定済みなら呼ばない（移行期間だけの経路）。
 */
function verifyBasicAuth(request: NextRequest): boolean {
  const expectedUser = normalizeSecret(process.env.ADMIN_USER) || 'admin';
  const expectedPassword = normalizeSecret(process.env.ADMIN_PASSWORD);
  if (!expectedPassword) return false;

  const header = request.headers.get('authorization');
  if (!header || !header.toLowerCase().startsWith('basic ')) return false;

  try {
    const decoded = atob(header.slice(6).trim());
    const sep = decoded.indexOf(':');
    if (sep === -1) return false;
    const user = decoded.slice(0, sep).trim();
    const password = decoded.slice(sep + 1);
    return timingSafeEqualHex(user, expectedUser) && timingSafeEqualHex(password, expectedPassword);
  } catch {
    return false;
  }
}

function normalizeSecret(value: string | undefined): string {
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
