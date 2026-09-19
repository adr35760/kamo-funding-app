import { NextRequest, NextResponse } from 'next/server';
import {
  allowedAdminEmails,
  isAllowedAdminEmail,
  isGoogleLoginConfigured,
  normalize,
} from '@/lib/admin-auth';

/**
 * GET /api/admin-auth/status — 設定の自己診断
 *
 * 🔴 なぜ作ったか（2026-09-18）:
 *   Googleログインが「準備できていません」と出たとき、**3つの環境変数のうち
 *   どれが足りないのかが分からず**、原因の切り分けができなかった。
 *   設定する人が自分で確認できるようにする。
 *
 * 🔴 値そのものは絶対に返さない。
 *   返すのは「設定されているか（true/false）」と、許可メールアドレスの**件数**、
 *   そして貼り間違いに気づける形式チェックの結果だけ。
 *   シークレットは長さすら出さない（設定の有無と先頭の形だけ）。
 */
export async function GET(request: NextRequest) {
  /**
   * 🔴 `?check=<メールアドレス>` で「そのアドレスが通るか」を直接試せる（2026-09-19 追加）。
   *   一覧の伏せ字表示だけでは、**目に見えない文字の混入**を見つけられなかった。
   *   自分のアドレスを入れて allowed:false が返れば、設定側の問題だと即断できる。
   *   返すのは true/false だけで、一覧の中身は漏らさない。
   */
  const check = request.nextUrl.searchParams.get('check');

  const clientId = normalize(process.env.GOOGLE_CLIENT_ID);
  const clientSecret = normalize(process.env.GOOGLE_CLIENT_SECRET);
  const emails = allowedAdminEmails();
  const rawEmails = normalize(process.env.ADMIN_ALLOWED_EMAILS);

  return NextResponse.json(
    {
      googleLoginReady: isGoogleLoginConfigured(),
      checks: {
        GOOGLE_CLIENT_ID: {
          set: Boolean(clientId),
          hint: clientId
            ? clientId.endsWith('.apps.googleusercontent.com')
              ? 'OK'
              : '形式が想定と違います。「.apps.googleusercontent.com」で終わる値か確認してください'
            : '未設定です',
        },
        GOOGLE_CLIENT_SECRET: {
          set: Boolean(clientSecret),
          hint: clientSecret
            ? clientSecret.startsWith('GOCSPX-')
              ? 'OK'
              : '形式が想定と違います。「GOCSPX-」で始まる値か確認してください（クライアントIDと入れ違っていませんか）'
            : '未設定です',
        },
        ADMIN_ALLOWED_EMAILS: {
          set: Boolean(rawEmails),
          count: emails.length,
          /**
           * 🔴 打ち間違いを見つけるための伏せ字表示（2026-09-19 追加）。
           *   「3件登録されているのに自分が入れない」とき、**どこが違うのか
           *   分からないと直せない**。かといって一覧をそのまま出すと
           *   運営メンバーの個人情報になるので、
           *   **先頭2文字＋伏せ字＋@以降**だけを見せる。
           *   例: adr35760@gmail.com → `ad******@gmail.com`
           *   これで「文字数が違う」「ドメインが違う」「そもそも入っていない」
           *   が自分で判別できる。
           */
          masked: emails.map(maskEmail),
          hint: !rawEmails
            ? '未設定です'
            : emails.length === 0
              ? '「@」を含むメールアドレスとして読み取れませんでした。書き方を確認してください'
              : `${emails.length}件のアドレスを認識しています`,
        },
      },
      ...(check
        ? {
            checkResult: {
              input: check,
              allowed: isAllowedAdminEmail(check),
              hint: isAllowedAdminEmail(check)
                ? 'このアドレスでログインできます'
                : 'このアドレスは許可一覧に入っていません。ADMIN_ALLOWED_EMAILS を確認し、Redeploy してください',
              /**
               * 🔴 「伏せ字は同じに見えるのに一致しない」を解くための差分表示。
               *   見た目が同じでも別物になる原因（見えない文字・よく似た別の字・
               *   文字数違い）を**位置だけ**で示す。アドレスの中身は出さない。
               */
              diff: diagnoseMismatch(check, allowedAdminEmails()),
            },
          }
        : {}),
      redirectUri: 'https://kamo-funding-app.vercel.app/api/admin-auth/callback',
      note:
        'googleLoginReady が false の間は、従来のパスワード方式で管理画面が使えます。3つすべて設定して Redeploy すると切り替わります。',
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

/**
 * 入力したアドレスと、許可一覧の中で**最も近いもの**を比べ、
 * どこが違うのかを文字を晒さずに説明する。
 */
function diagnoseMismatch(input: string, list: string[]): string {
  const target = input.trim().toLowerCase();
  if (list.length === 0) return '許可一覧が空です';

  // 前方一致の長さが最大のものを「近いもの」とみなす
  let best = list[0];
  let bestScore = -1;
  for (const e of list) {
    let i = 0;
    while (i < e.length && i < target.length && e[i] === target[i]) i++;
    if (i > bestScore) {
      bestScore = i;
      best = e;
    }
  }

  if (best === target) return '一致しています';

  if (bestScore === best.length && bestScore === target.length) {
    return '一致しています';
  }

  const parts: string[] = [];
  parts.push(`一番近い登録値との違い: 先頭から${bestScore}文字目までは同じです`);

  if (best.length !== target.length) {
    parts.push(
      `登録値の長さは${best.length}文字、入力は${target.length}文字です（差 ${Math.abs(best.length - target.length)}文字）`
    );
    if (best.length > target.length) {
      parts.push('登録値に余分な文字が入っている可能性があります（目に見えない文字の混入など）');
    } else {
      parts.push('登録値の文字が足りません（コピペの取りこぼしなど）');
    }
  } else {
    parts.push(`${bestScore + 1}文字目が違います（よく似た別の文字が入っている可能性があります）`);
  }

  return parts.join(' / ');
}

/** `adr35760@gmail.com` → `ad******@gmail.com` */
function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const head = local.slice(0, 2);
  return `${head}${'*'.repeat(Math.max(local.length - 2, 1))}${domain}`;
}

export const dynamic = 'force-dynamic';
