/**
 * 業務管理システム（/work）の認証。
 *
 * ログインの仕組み（PRD v1.2・t iku 決定 2026-09-27）:
 *   メールもGoogleも使わない。`/work/login` で**名前を選ぶだけ**。
 *   サーバーがワンタイムトークンを発行し、**その人のチャットワーク個人チャット（1対1）**
 *   にログインURLを送る。メンバー2名がGoogleアカウントを持っていないため。
 *
 * 🔴 セキュリティ上、絶対に崩してはいけない点:
 *   1. ログインリンクは**個人チャット限定**。通知用グループに送ると、
 *      グループを見られる全員が他人になりすませる。
 *   2. トークンは**ハッシュだけDBに保存**する（平文はDBに残さない）。
 *   3. 有効期限2時間・**1回使用で失効**。
 *   4. `/api/work/*` は**サーバー側でセッションを検証**する。画面の出し分けだけに頼らない
 *      （過去に `/api/ai/*` が素通しだった事故がある）。
 *   5. 鍵・トークンを `NEXT_PUBLIC_` の環境変数に入れない（配信JSに埋め込まれる）。
 *
 * セッションCookieの作りは既存の `admin-auth.ts` を踏襲する（HMAC署名・Edge対応）。
 * 新しい方式を増やさないため。
 */

export const WORK_SESSION_COOKIE = 'kamo_work_session';

/** セッションの有効期間。毎日使うものなので長め（PRD: 30日） */
export const WORK_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

/** ワンタイムトークンの有効期間（t iku指定 2026-09-29: 2時間） */
export const WORK_LOGIN_TOKEN_TTL_SECONDS = 2 * 60 * 60;

export type WorkRole = 'admin' | 'member';

export interface WorkSession {
  userId: string;
  role: WorkRole;
}

/**
 * ログイン用のワンタイムトークンを作る。
 * 返り値の `token` はURLに載せる平文、`tokenHash` がDBに保存する値。
 * 🔴 平文は**この関数の呼び出し元がURLを組むためだけ**に使い、DBやログに残さない。
 */
export async function createLoginToken(): Promise<{ token: string; tokenHash: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = toHex(bytes);
  return { token, tokenHash: await sha256Hex(token) };
}

/** 受け取ったトークン（平文）からDB照合用のハッシュを作る */
export async function hashLoginToken(token: string): Promise<string> {
  return sha256Hex(token);
}

/**
 * セッションCookieの値を作る: `<expiresAtMs>.<userId>.<role>.<hex署名>`
 * 役割を含めるのは、管理者操作の判定をDBに毎回問い合わせずに済ませるため。
 * （役割を変えたら再ログインが必要になるが、4名の運用では問題にならない）
 */
export async function createWorkSession(
  userId: string,
  role: WorkRole,
  now = Date.now()
): Promise<string> {
  const expiresAt = now + WORK_SESSION_TTL_SECONDS * 1000;
  const payload = `${expiresAt}.${userId}.${role}`;
  return `${payload}.${await hmacHex(payload)}`;
}

/**
 * セッションCookieを検証する。改ざん・期限切れ・形式不正はすべて null。
 * 🔴 middleware（Edge ランタイム）からも呼ぶので、Node 固有のAPIを使わない。
 */
export async function verifyWorkSession(
  value: string | undefined | null,
  now = Date.now()
): Promise<WorkSession | null> {
  if (!value) return null;
  const lastDot = value.lastIndexOf('.');
  if (lastDot <= 0) return null;

  const payload = value.slice(0, lastDot);
  const sig = value.slice(lastDot + 1);
  const expected = await hmacHex(payload);
  if (!timingSafeEqualHex(sig, expected)) return null;

  const parts = payload.split('.');
  if (parts.length !== 3) return null;
  const expiresAt = Number(parts[0]);
  if (!Number.isFinite(expiresAt) || expiresAt < now) return null;

  const userId = parts[1];
  const role = parts[2];
  if (!userId) return null;
  if (role !== 'admin' && role !== 'member') return null;

  return { userId, role };
}

/**
 * 署名鍵。専用の `WORK_SESSION_SECRET` があればそれを使う。
 * 無ければ既存の管理者用シークレットから導出する（設定漏れでも動くようにするため）。
 * 🔴 どれも無い場合は**固定文字列にフォールバックしない** — 署名の意味が消えるため、
 *   `isWorkAuthConfigured()` が false を返し、呼び出し側がログインを止める。
 */
function signingSecret(): string {
  const dedicated = normalize(process.env.WORK_SESSION_SECRET);
  if (dedicated) return dedicated;
  const fallback =
    normalize(process.env.ADMIN_SESSION_SECRET) ||
    normalize(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
    normalize(process.env.ADMIN_PASSWORD);
  return fallback ? `kamo-work:${fallback}` : '';
}

/**
 * 署名鍵が用意できているか。
 * false のときログインを通すと、誰でも偽のCookieを作れてしまう（フェイルクローズ）。
 */
export function isWorkAuthConfigured(): boolean {
  return signingSecret().length > 0;
}

/** Edge / Node の両方で動く HMAC-SHA256 */
async function hmacHex(message: string): Promise<string> {
  const secret = signingSecret();
  // 鍵が無い場合は検証不能。呼び出し側が isWorkAuthConfigured() で止める前提だが、
  // ここでも一致しない値を返して**通してしまわない**ようにする。
  if (!secret) return 'unconfigured';
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return toHex(new Uint8Array(sig));
}

async function sha256Hex(message: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(message));
  return toHex(new Uint8Array(digest));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 長さに依存しない比較（タイミング攻撃対策）。既存実装と同じ考え方 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
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
