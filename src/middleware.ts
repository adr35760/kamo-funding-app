import { NextRequest, NextResponse } from 'next/server';
import { AI_TOOL_COOKIE, verifyAiToolToken } from '@/lib/ai-tool-auth';
import {
  ADMIN_SESSION_COOKIE,
  isGoogleLoginConfigured,
  verifyAdminSession,
} from '@/lib/admin-auth';
import { WORK_SESSION_COOKIE, verifyWorkSession } from '@/lib/work-auth';

/**
 * 管理画面・限定公開ツールの認証
 *
 * 保護対象: /admin 配下、/api/admin/* 配下、/api/ai/*、未使用の内部API
 * 除外   : /api/cron/*（CRON_SECRETで別途認証済み）— matcherに含めていない
 *          /admin/login と /api/admin-auth/*（ログインの入口なので通す）
 *
 * 🔴 管理画面の認証方式（2026-09-18 Googleログイン化）:
 *   Googleの設定が揃っていれば **Googleログイン**（許可メールアドレス方式）。
 *   揃っていない間は **従来のBasic認証**で動く。
 *   設定前に切り替えると事務局が入れなくなるため、自動で切り替わる作りにしている。
 *   移行が完全に終わったら ADMIN_PASSWORD を消してBasic認証を落とせる。
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /**
   * 🔴 ログインの入口は認証を通さない（ここを守ると誰もログインできない）。
   *   このページ・APIは個人情報を一切扱わない。
   */
  if (pathname === '/admin/login' || pathname.startsWith('/api/admin-auth/')) {
    return NextResponse.next();
  }

  /**
   * 🔴 業務管理システム（/work）の認証（2026-09-27 追加・第1段）
   *
   * 既存の /admin（Basic認証 / Googleログイン）とは**別系統**。
   * ログインはチャットワーク個人チャットに届くワンタイムリンクで、
   * セッションは署名Cookie（work-auth.ts）。既存の認証には一切手を入れていない。
   *
   * ログインの入口だけは通す（ここを塞ぐと誰もログインできない）:
   *   /work/login（名前を選ぶ画面）、/work/login/verify（リンクの着地点）
   *   /api/work/login-request、/api/work/login-verify
   *   /api/work/users?for=login（名前の選択肢。id と name だけ返す）
   */
  if (pathname === '/work/login' || pathname.startsWith('/work/login/')) {
    return NextResponse.next();
  }
  if (pathname === '/api/work/login-request' || pathname === '/api/work/login-verify') {
    return NextResponse.next();
  }
  if (pathname === '/api/work/users' && request.nextUrl.searchParams.get('for') === 'login') {
    return NextResponse.next();
  }
  /**
   * 🔴 Cron は Cookie を持たないので、セッション検証にかけると必ず落ちる。
   *   既存 `/api/cron/*` と同じく `CRON_SECRET`（Authorization ヘッダ）で
   *   各ルート自身が認証する。ここは素通しにするが**無認証ではない**。
   */
  if (pathname.startsWith('/api/work/cron/')) {
    return NextResponse.next();
  }
  /**
   * 🔴 初回設定の画面・API は既存サイト管理者でも通す必要がある（鶏と卵）。
   *   room_id が未登録だと誰も /work にログインできないため、
   *   ここを work セッション必須にすると永久に設定できない。
   *   認証は各API内の `requireWorkAdminOrSiteAdmin` が行う（素通しではない）。
   */
  if (
    pathname === '/work/setup' ||
    pathname === '/api/work/settings' ||
    pathname === '/api/work/chatwork-rooms' ||
    (pathname === '/api/work/users' && request.method === 'PATCH')
  ) {
    return NextResponse.next();
  }

  if (pathname === '/work' || pathname.startsWith('/work/') || pathname.startsWith('/api/work/')) {
    const session = await verifyWorkSession(request.cookies.get(WORK_SESSION_COOKIE)?.value);
    if (session) {
      // /work/admin 配下と管理者専用APIは role でさらに絞る。
      // （各APIでも requireWorkAdmin で二重に確認している）
      if (pathname.startsWith('/work/admin') && session.role !== 'admin') {
        const url = new URL('/work', request.nextUrl.origin);
        const res = NextResponse.redirect(url);
        res.headers.set('Cache-Control', 'no-store');
        return res;
      }
      return NextResponse.next();
    }
    // 未ログイン: API は 401、画面はログインへ送る
    if (pathname.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({ success: false, error: 'ログインが必要です', login: '/work/login' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        }
      );
    }
    const loginUrl = new URL('/work/login', request.nextUrl.origin);
    const res = NextResponse.redirect(loginUrl);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  /**
   * 🔴 /api/ai/* の保護（2026-09-18 追加）
   *
   * `/ai-tool` の画面はパスワードを出していたが、**APIは素通し**だった。
   * つまり画面を通らずに `/api/ai/generate` を直接叩けたので、
   *   - OpenAI の課金を第三者に使われる
   *   - `/api/ai/submit` で ai_generations に任意の行を入れられる
   * という状態だった。認証Cookieを持たないリクエストは 401 で止める。
   */
  /**
   * 🔴 公開されたままの内部APIを閉じる（2026-09-18 追加）
   *
   *   - `/api/referrals`      … partner_id を渡すと紹介先の会社名・担当者名・
   *                             メールアドレスが**認証なしで**一覧で返っていた。
   *                             POST/PATCH で任意の紹介実績を作成・改変もできた。
   *   - `/api/partners/register` の GET … 紹介コードを渡すとパートナーの氏名が返る。
   *
   *   どちらも**サイトのどのページからも呼ばれていない**（実装時の名残）。
   *   個人情報の出口を残す理由がないので、管理者のみに限定する。
   *   将来パートナー向けのマイページを作るときは、パートナー本人の
   *   ログインを用意してから開ける。
   */
  if (pathname === '/api/referrals' || pathname.startsWith('/api/referrals/')) {
    return requireAdmin(request);
  }
  if (pathname === '/api/partners/register' || pathname.startsWith('/api/partners/register/')) {
    // GET（紹介コードから氏名が引ける）だけを管理者限定にする。
    // POST はパートナー登録の受け口なので公開のまま通す。
    if (request.method === 'GET') return requireAdmin(request);
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/ai/')) {
    const ok = await verifyAiToolToken(request.cookies.get(AI_TOOL_COOKIE)?.value);
    if (!ok) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: 'このツールは限定公開です。ページを開き直してパスワードを入力してください。',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        }
      );
    }
    return NextResponse.next();
  }

  /**
   * 🔴 ここから下は /admin と /api/admin/* の認証。
   *
   * Googleログインが設定済みなら、そちらを正とする。
   * セッションCookieが無い／期限切れ／許可一覧から外された場合:
   *   - 画面（/admin）→ ログイン画面へ送る
   *   - API（/api/admin/*）→ 401（画面側が拒否を判別できるようにする）
   */
  if (isGoogleLoginConfigured()) {
    const session = await verifyAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
    if (session) return NextResponse.next();

    if (pathname.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({ error: 'ログインが必要です', login: '/admin/login' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        }
      );
    }
    const loginUrl = new URL('/admin/login', request.nextUrl.origin);
    const res = NextResponse.redirect(loginUrl);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  // ---- 以下は移行期間のBasic認証（Googleの設定が揃うまで） ----
  // 環境変数の値に空白・改行・引用符が混入していても認証できるよう正規化する
  // （Vercelの入力欄でコピペすると末尾に改行や空白が入りがち）
  const expectedUser = normalizeSecret(process.env.ADMIN_USER) || 'admin';
  const expectedPassword = normalizeSecret(process.env.ADMIN_PASSWORD);

  // フェイルクローズ: どちらの方式も設定が無ければ誰も入れない（個人情報を露出させない）
  if (!expectedPassword) {
    return new NextResponse(
      '管理画面は現在利用できません（認証が未設定です）。管理者にお問い合わせください。',
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

/**
 * Basic認証の判定だけを行い、通ればそのまま処理を続ける。
 * `/admin` と同じ資格情報を使う。
 */
function requireAdmin(request: NextRequest): NextResponse {
  const expectedUser = normalizeSecret(process.env.ADMIN_USER) || 'admin';
  const expectedPassword = normalizeSecret(process.env.ADMIN_PASSWORD);
  if (!expectedPassword) return unauthorized();

  const header = request.headers.get('authorization');
  if (!header || !header.toLowerCase().startsWith('basic ')) return unauthorized();

  try {
    const decoded = atob(header.slice(6).trim());
    const sep = decoded.indexOf(':');
    if (sep === -1) return unauthorized();
    const user = decoded.slice(0, sep).trim();
    const password = decoded.slice(sep + 1);
    if (!safeEqual(user, expectedUser) || !safeEqual(password, expectedPassword)) {
      return unauthorized();
    }
  } catch {
    return unauthorized();
  }
  return NextResponse.next();
}

export const config = {
  // /api/cron/* は含めない（CRON_SECRETで認証しているため）
  matcher: [
    // 🔴 /admin 配下は**すべて**通す（将来ページが増えても守り漏れが出ない）。
    //   ログインの入口 /admin/login だけは middleware の先頭で素通しにしている。
    //   matcher で列挙して除外する形にすると、新しく作ったページが
    //   保護されないまま公開される事故が起きるので、この形にしている。
    '/admin',
    '/admin/:path*',
    '/api/admin/:path*',
    // /ai-tool の生成・保存API。認証Cookieで保護する
    // （/api/ai-tool/auth 自身は含めない — そこがパスワードを受け取る入口）
    '/api/ai/:path*',
    // 使われていない内部API（個人情報の出口）。管理者のみに限定する
    '/api/referrals',
    '/api/partners/register',
    // 🔴 業務管理システム。/work 配下と /api/work/* を**すべて**通す。
    //   ログインの入口だけ middleware の先頭で素通しにしている（/admin と同じ考え方）。
    '/work',
    '/work/:path*',
    '/api/work/:path*',
  ],
};
