import { NextRequest, NextResponse } from 'next/server';

/**
 * 管理画面のBasic認証
 *
 * 保護対象: /admin 配下、/api/admin/* 配下
 * 除外   : /api/cron/*（CRON_SECRETで別途認証済み）— matcherに含めていない
 *
 * 認証情報は環境変数で管理する（ソースには書かない）:
 *   ADMIN_USER     … 未設定なら 'admin'
 *   ADMIN_PASSWORD … 必須。未設定の場合は「安全側に倒して全アクセスを拒否」する
 */

function unauthorized(message = 'Authentication required') {
  return new NextResponse(message, {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="KAMO Admin", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  });
}

export function middleware(request: NextRequest) {
  // 環境変数の値に空白・改行・引用符が混入していても認証できるよう正規化する
  // （Vercelの入力欄でコピペすると末尾に改行や空白が入りがち）
  const expectedUser = normalizeSecret(process.env.ADMIN_USER) || 'admin';
  const expectedPassword = normalizeSecret(process.env.ADMIN_PASSWORD);

  // フェイルクローズ: パスワード未設定なら誰も入れない（個人情報を露出させない）
  if (!expectedPassword) {
    return new NextResponse(
      '管理画面は現在利用できません（ADMIN_PASSWORD が未設定です）。管理者にお問い合わせください。',
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const header = request.headers.get('authorization');
  if (!header || !header.toLowerCase().startsWith('basic ')) {
    return unauthorized();
  }

  let user = '';
  let password = '';
  try {
    const decoded = atob(header.slice(6).trim());
    const sep = decoded.indexOf(':'); // パスワードに「:」が含まれても壊れないよう最初の1つで分割
    if (sep === -1) return unauthorized();
    user = decoded.slice(0, sep);
    password = decoded.slice(sep + 1);
  } catch {
    return unauthorized();
  }

  // タイミング攻撃を避けるため、長さに依存しない比較を行う
  if (!safeEqual(user.trim(), expectedUser) || !safeEqual(password, expectedPassword)) {
    return unauthorized();
  }

  return NextResponse.next();
}

/**
 * 環境変数の値を正規化する。
 * - 前後の空白・改行（\n \r \t 全角スペース）を除去
 * - 値全体を囲む引用符（" '）を除去
 */
function normalizeSecret(value: string | undefined): string {
  if (!value) return '';
  let v = value.replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    v = v.slice(1, -1).replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');
  }
  return v;
}

/** 定数時間に近い文字列比較 */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

export const config = {
  // /api/cron/* は含めない（CRON_SECRETで認証しているため）
  matcher: ['/admin/:path*', '/admin', '/api/admin/:path*'],
};
