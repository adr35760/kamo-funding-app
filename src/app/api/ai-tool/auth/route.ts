import { NextRequest, NextResponse } from 'next/server';
import {
  AI_TOOL_COOKIE,
  AI_TOOL_TTL_SECONDS,
  createAiToolToken,
  expectedAiToolPassword,
  timingSafeEqualHex,
  verifyAiToolToken,
} from '@/lib/ai-tool-auth';

/**
 * POST /api/ai-tool/auth — /ai-tool のパスワード照合
 *
 * 🔴 照合は**サーバーだけ**で行う。以前はブラウザ側で比較していたため、
 *   配信JSを開けばパスワードが読めた。ここでは正解値を返さず、
 *   成功時に httpOnly Cookie を発行するだけ。
 *
 * 総当たり対策: 同一IPからの失敗を数え、短時間に連続すると429で待たせる。
 */
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { success: false, error: '試行が多すぎます。1分ほど待ってからお試しください。' },
      { status: 429 }
    );
  }

  let password = '';
  try {
    const body = await request.json();
    password = typeof body?.password === 'string' ? body.password : '';
  } catch {
    password = '';
  }

  const { password: expected } = expectedAiToolPassword();
  if (!password || !timingSafeEqualHex(password.trim(), expected)) {
    recordFailure(ip);
    return NextResponse.json(
      { success: false, error: 'パスワードが正しくありません' },
      { status: 401 }
    );
  }

  clearFailures(ip);
  const res = NextResponse.json({ success: true });
  res.cookies.set(AI_TOOL_COOKIE, await createAiToolToken(), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: AI_TOOL_TTL_SECONDS,
  });
  return res;
}

/**
 * GET /api/ai-tool/auth — 既存Cookieが有効かを返す
 * （再読み込みのたびにパスワードを打たせないため）
 */
export async function GET(request: NextRequest) {
  const ok = await verifyAiToolToken(request.cookies.get(AI_TOOL_COOKIE)?.value);
  return NextResponse.json({ authenticated: ok });
}

/** IPごとの失敗回数。サーバーレスなのでインスタンス単位の簡易防御 */
const failures = new Map<string, { count: number; firstAt: number }>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;

function isRateLimited(ip: string): boolean {
  const rec = failures.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.firstAt > WINDOW_MS) {
    failures.delete(ip);
    return false;
  }
  return rec.count >= MAX_ATTEMPTS;
}

function recordFailure(ip: string) {
  const rec = failures.get(ip);
  if (!rec || Date.now() - rec.firstAt > WINDOW_MS) {
    failures.set(ip, { count: 1, firstAt: Date.now() });
    return;
  }
  rec.count += 1;
}

function clearFailures(ip: string) {
  failures.delete(ip);
}

export const dynamic = 'force-dynamic';
