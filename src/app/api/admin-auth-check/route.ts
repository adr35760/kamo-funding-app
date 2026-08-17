import { NextResponse } from 'next/server';

/**
 * GET /api/admin-auth-check
 *
 * 管理画面Basic認証の設定診断用エンドポイント。
 * **秘密の値は一切返さない**（長さ・種類・混入の有無などメタ情報のみ）。
 *
 * Basic認証で入れない原因を切り分けるために使う。
 * 原因が判明したら削除してよい。
 * 注意: middleware の matcher に含めないパスにしてある（/api/admin/* ではない）。
 */
export async function GET() {
  const rawUser = process.env.ADMIN_USER;
  const rawPassword = process.env.ADMIN_PASSWORD;

  const describe = (v: string | undefined) => {
    if (v === undefined) return { set: false };
    const trimmed = v.replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');
    return {
      set: true,
      length: v.length,
      lengthAfterTrim: trimmed.length,
      hasLeadingOrTrailingWhitespace: v !== trimmed,
      hasNewline: /[\r\n]/.test(v),
      hasFullWidthSpace: /\u3000/.test(v),
      isWrappedInQuotes:
        trimmed.length >= 2 &&
        ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
          (trimmed.startsWith("'") && trimmed.endsWith("'"))),
      hasNonAsciiChars: /[^\x20-\x7E]/.test(trimmed),
      // 値そのものは返さない。先頭1文字だけ種類の確認用に返す
      firstCharClass: trimmed
        ? /[A-Z]/.test(trimmed[0])
          ? 'uppercase'
          : /[a-z]/.test(trimmed[0])
            ? 'lowercase'
            : /[0-9]/.test(trimmed[0])
              ? 'digit'
              : 'other'
        : 'empty',
    };
  };

  return NextResponse.json(
    {
      environment: process.env.VERCEL_ENV || 'unknown',
      ADMIN_USER: describe(rawUser),
      ADMIN_PASSWORD: describe(rawPassword),
      effectiveUserWhenUnset: rawUser ? undefined : 'admin',
      note: '値そのものは返しません。set=false なら未設定、hasNewline / hasLeadingOrTrailingWhitespace / isWrappedInQuotes / hasFullWidthSpace が true なら値の混入が原因です。',
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
