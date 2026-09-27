/**
 * `/api/work/*` のサーバー側セッション検証。
 *
 * 🔴 すべての `/api/work/*` はこれを最初に呼ぶ。
 *   middleware でも弾いているが、**APIごとにも必ず確認する**（二重にする）。
 *   過去に `/api/ai/*` が画面のパスワードだけで守られていて素通しだった事故があるため、
 *   「画面の出し分け」「middleware だけ」には頼らない。
 */

import { NextRequest, NextResponse } from 'next/server';
import { WORK_SESSION_COOKIE, verifyWorkSession, type WorkSession } from './work-auth';

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
