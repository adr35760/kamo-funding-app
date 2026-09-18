/**
 * /ai-tool（AIクラファンページ作成ツール）の認証。
 *
 * 🔴 なぜ作り直したか（2026-09-18）:
 *   旧実装は `NEXT_PUBLIC_AI_TOOL_PASSWORD || 'kamo2026'` をブラウザ側で
 *   比較していた。`NEXT_PUBLIC_` はビルド時に**JSバンドルへ埋め込まれる**ため、
 *   誰でも配信ファイルを開けばパスワードが読めた（実際に本番の
 *   /_next/static/chunks/app/ai-tool/page-*.js から平文で読み出せた）。
 *   さらにパスワード判定が画面側だけだったので、`/api/ai/generate` と
 *   `/api/ai/submit` は**認証なしで直接叩ける**状態だった
 *   （= OpenAI 課金の踏み台にされる／DBに任意の行を入れられる）。
 *
 * 新しい作り:
 *   - パスワードは**サーバー専用の環境変数** `AI_TOOL_PASSWORD`（NEXT_PUBLIC_ を付けない）
 *   - 照合はサーバーで行い、成功したら **httpOnly の署名付きCookie**を発行する
 *   - `/api/ai/*` は middleware でこのCookieを検証する（画面を迂回した直撃を防ぐ）
 *
 * 移行期間の扱い:
 *   `AI_TOOL_PASSWORD` が未設定の間は旧パスワード `KAMO` を受け付ける
 *   （設定前にツールが止まると受講者の作業が止まるため）。ただし旧値は
 *   すでに公開済みなので、環境変数の設定をもって無効化する。
 */

export const AI_TOOL_COOKIE = 'kamo_ai_tool';

/** 認証済みCookieの有効期間（秒）。作業が長いので12時間 */
export const AI_TOOL_TTL_SECONDS = 12 * 60 * 60;

/** 移行期間だけ受け付ける旧パスワード（すでに公開済み＝暫定値） */
const LEGACY_PASSWORD = 'KAMO';

export function expectedAiToolPassword(): { password: string; isLegacy: boolean } {
  const configured = normalize(process.env.AI_TOOL_PASSWORD);
  if (configured) return { password: configured, isLegacy: false };
  return { password: LEGACY_PASSWORD, isLegacy: true };
}

/**
 * Cookie署名の鍵。専用の `AI_TOOL_COOKIE_SECRET` があればそれを使い、
 * 無ければパスワードから導出する（パスワードを変えると既存Cookieが失効する＝望ましい）。
 */
function signingSecret(): string {
  const dedicated = normalize(process.env.AI_TOOL_COOKIE_SECRET);
  if (dedicated) return dedicated;
  return `kamo-ai-tool:${expectedAiToolPassword().password}`;
}

/** Cookie値を作る: `<expiresAtMs>.<hex署名>` */
export async function createAiToolToken(now = Date.now()): Promise<string> {
  const expiresAt = now + AI_TOOL_TTL_SECONDS * 1000;
  const sig = await hmacHex(String(expiresAt));
  return `${expiresAt}.${sig}`;
}

/** Cookie値を検証する。改ざん・期限切れは false */
export async function verifyAiToolToken(
  value: string | undefined | null,
  now = Date.now()
): Promise<boolean> {
  if (!value) return false;
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return false;
  const expiresAtRaw = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < now) return false;
  const expected = await hmacHex(expiresAtRaw);
  return timingSafeEqualHex(sig, expected);
}

/** Edge / Node の両方で動く HMAC-SHA256（middleware は Edge ランタイム） */
async function hmacHex(message: string): Promise<string> {
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
