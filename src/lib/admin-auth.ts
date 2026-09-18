/**
 * 管理画面の認証（2026-09-18 Googleログイン化）
 *
 * 🔴 なぜ変えたか:
 *   共有パスワード（Basic認証）には構造的な弱点が3つあった。
 *     ① 誰が入ったか記録が残らない（漏洩時に経路を追えない）
 *     ② 1人に渡すと全員に渡り、特定の人だけ止められない
 *     ③ 総当たり対策が無い（本番実測: 12回連続で止まらなかった）
 *   管理画面には申込者・パートナー・掲載申込・振込先口座の全てがあるため、
 *   「誰が」「いつ」入ったかを記録でき、個別に止められる方式に移す。
 *
 * 方式:
 *   Google の認可コードフロー。ログイン後、**許可メールアドレスの一覧**に
 *   載っている人だけを通す。セッションは httpOnly の署名付きCookie。
 *
 * 🔴 移行の安全策:
 *   Google の設定（GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / ADMIN_ALLOWED_EMAILS）が
 *   **揃うまでは従来のBasic認証で動く**。設定前に切り替えると
 *   事務局が管理画面に入れなくなるため、設定が揃った時点で自動的に
 *   Googleログインへ切り替わる作りにしている。
 */

export const ADMIN_SESSION_COOKIE = 'kamo_admin_session';

/** セッションの有効期間（秒）。事務作業の区切りを考えて8時間 */
export const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;

/** Googleログインが使える設定になっているか */
export function isGoogleLoginConfigured(): boolean {
  return Boolean(
    normalize(process.env.GOOGLE_CLIENT_ID) &&
      normalize(process.env.GOOGLE_CLIENT_SECRET) &&
      allowedAdminEmails().length > 0
  );
}

/**
 * 管理画面に入れるメールアドレスの一覧。
 * `ADMIN_ALLOWED_EMAILS` にカンマ区切りで設定する。
 * 大文字小文字は区別しない（Googleのアカウントは区別しない）。
 */
export function allowedAdminEmails(): string[] {
  const raw = normalize(process.env.ADMIN_ALLOWED_EMAILS);
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map(e => e.trim().toLowerCase())
    .filter(e => e.includes('@'));
}

export function isAllowedAdminEmail(email: string): boolean {
  const target = email.trim().toLowerCase();
  if (!target) return false;
  return allowedAdminEmails().includes(target);
}

/**
 * セッションCookieの値を作る: `<expiresAtMs>.<emailをURLエンコードした値>.<hex署名>`
 * メールアドレスを含めるのは、**誰が操作したかを記録に残す**ため。
 */
export async function createAdminSession(email: string, now = Date.now()): Promise<string> {
  const expiresAt = now + ADMIN_SESSION_TTL_SECONDS * 1000;
  const payload = `${expiresAt}.${encodeURIComponent(email.trim().toLowerCase())}`;
  return `${payload}.${await hmacHex(payload)}`;
}

/**
 * セッションCookieを検証し、有効ならメールアドレスを返す。
 * 改ざん・期限切れ・**許可一覧から外された人**は null。
 * （一覧から外した瞬間に、既に持っているCookieも無効になる）
 */
export async function verifyAdminSession(
  value: string | undefined | null,
  now = Date.now()
): Promise<{ email: string } | null> {
  if (!value) return null;
  const lastDot = value.lastIndexOf('.');
  if (lastDot <= 0) return null;
  const payload = value.slice(0, lastDot);
  const sig = value.slice(lastDot + 1);

  const expected = await hmacHex(payload);
  if (!timingSafeEqual(sig, expected)) return null;

  const sep = payload.indexOf('.');
  if (sep <= 0) return null;
  const expiresAt = Number(payload.slice(0, sep));
  if (!Number.isFinite(expiresAt) || expiresAt < now) return null;

  let email = '';
  try {
    email = decodeURIComponent(payload.slice(sep + 1));
  } catch {
    return null;
  }
  // 🔴 毎回、許可一覧を見直す。退会した人のCookieを生かしておかない。
  if (!isAllowedAdminEmail(email)) return null;
  return { email };
}

/** 署名鍵。専用の値があればそれを、無ければクライアントシークレットから導出する */
function signingSecret(): string {
  const dedicated = normalize(process.env.ADMIN_SESSION_SECRET);
  if (dedicated) return dedicated;
  const fallback = normalize(process.env.GOOGLE_CLIENT_SECRET) || normalize(process.env.ADMIN_PASSWORD);
  return `kamo-admin:${fallback}`;
}

/** Edge / Node の両方で動く HMAC-SHA256（middleware は Edge ランタイム） */
export async function hmacHex(message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(signingSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 長さに依存しない比較（タイミング攻撃対策） */
export function timingSafeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function normalize(value: string | undefined): string {
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
 * Googleに伝える戻り先URL。
 *
 * 🔴 Google側に登録した値と**1文字でも違うとエラー**になるので、
 *   `ADMIN_OAUTH_REDIRECT_URI` で明示できる逃げ道を用意している。
 *   未指定のときは `NEXT_PUBLIC_SITE_ORIGIN`、それも無ければ
 *   リクエストのオリジンから組み立てる。
 */
export function buildAdminRedirectUri(requestOrigin: string): string {
  const explicit = normalize(process.env.ADMIN_OAUTH_REDIRECT_URI);
  if (explicit) return explicit;
  const origin = normalize(process.env.NEXT_PUBLIC_SITE_ORIGIN) || requestOrigin;
  return `${origin.replace(/\/+$/, '')}/api/admin-auth/callback`;
}
