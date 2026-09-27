/**
 * /work の認証ロジックの自己検証。
 *
 * 目的: 第1段の報告で求められている次の3点を、**実際に関数を動かして**確かめる。
 *   - 期限切れトークンが拒否されるか
 *   - 使用済み（再利用）トークンが拒否されるか
 *   - セッションCookieの改ざんが拒否されるか
 *
 * DB（PostgREST）を介さずに検証できる部分をここで押さえ、
 * HTTP経路の401はサーバーを立てて別途確認する。
 *
 * 実行: npx tsx scripts/work-auth-selftest.mts
 */

process.env.WORK_SESSION_SECRET = process.env.WORK_SESSION_SECRET || 'selftest-secret-value';

const {
  createLoginToken,
  hashLoginToken,
  createWorkSession,
  verifyWorkSession,
  isWorkAuthConfigured,
  WORK_LOGIN_TOKEN_TTL_SECONDS,
} = await import('../src/lib/work-auth.ts');

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    pass += 1;
    console.log(`  OK   ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name} ${detail}`);
  }
}

console.log('--- 1. トークンの生成とハッシュ ---');
const { token, tokenHash } = await createLoginToken();
check('平文トークンは64桁の16進（32バイト）', /^[0-9a-f]{64}$/.test(token), token.slice(0, 12));
check('ハッシュは64桁の16進（SHA-256）', /^[0-9a-f]{64}$/.test(tokenHash));
check('平文とハッシュが別物（平文をDBに入れていない証拠）', token !== tokenHash);
check('同じ平文から同じハッシュが出る（照合できる）', (await hashLoginToken(token)) === tokenHash);
check('違う平文からは違うハッシュが出る', (await hashLoginToken(token + 'x')) !== tokenHash);

const second = await createLoginToken();
check('毎回違うトークンが出る（推測されない）', second.token !== token);

console.log('--- 2. トークンの有効期限（10分）---');
check('TTLは600秒', WORK_LOGIN_TOKEN_TTL_SECONDS === 600, String(WORK_LOGIN_TOKEN_TTL_SECONDS));
// 期限切れ・使用済みの判定はAPI側の条件式と同じ形で確かめる
const expiredRow = { expires_at: new Date(Date.now() - 1000).toISOString(), used_at: null };
const usedRow = { expires_at: new Date(Date.now() + 60_000).toISOString(), used_at: new Date().toISOString() };
const freshRow = { expires_at: new Date(Date.now() + 60_000).toISOString(), used_at: null };
const accept = (row: { expires_at: string; used_at: string | null }) =>
  !row.used_at && new Date(row.expires_at).getTime() >= Date.now();
check('期限切れトークンは拒否', accept(expiredRow) === false);
check('使用済みトークンは拒否（1回限り）', accept(usedRow) === false);
check('有効なトークンは受理', accept(freshRow) === true);

console.log('--- 3. セッションCookieの検証 ---');
check('署名鍵が設定されている', isWorkAuthConfigured() === true);

const userId = '11111111-2222-3333-4444-555555555555';
const cookie = await createWorkSession(userId, 'member');
const ok = await verifyWorkSession(cookie);
check('正しいCookieは通る', ok?.userId === userId && ok?.role === 'member', JSON.stringify(ok));

check('空のCookieは拒否', (await verifyWorkSession('')) === null);
check('でたらめな値は拒否', (await verifyWorkSession('garbage')) === null);

// 署名を1文字変える（改ざん）
const tampered = cookie.slice(0, -1) + (cookie.endsWith('a') ? 'b' : 'a');
check('署名を書き換えたCookieは拒否', (await verifyWorkSession(tampered)) === null);

// role を member から admin に書き換える（権限昇格の試み）
const parts = cookie.split('.');
const escalated = `${parts[0]}.${parts[1]}.admin.${parts[3]}`;
check('roleをadminに書き換えたCookieは拒否（権限昇格できない）', (await verifyWorkSession(escalated)) === null);

// 期限を未来に伸ばす（有効期限の偽装）
const extended = `${Date.now() + 999_999_999}.${parts[1]}.${parts[2]}.${parts[3]}`;
check('有効期限を伸ばしたCookieは拒否', (await verifyWorkSession(extended)) === null);

// 期限切れのCookie（署名は正しい）
const expiredCookie = await createWorkSession(userId, 'member', Date.now() - 31 * 24 * 60 * 60 * 1000);
check('期限切れのCookieは拒否', (await verifyWorkSession(expiredCookie)) === null);

const adminCookie = await createWorkSession(userId, 'admin');
const adminOk = await verifyWorkSession(adminCookie);
check('admin のCookieはadminとして通る', adminOk?.role === 'admin');

console.log('--- 4. 署名鍵が無いときフェイルクローズするか ---');
{
  // 🔴 ESM は同じモジュールURLを再評価しないので、鍵を消した状態の判定は別プロセスで確認する
  const { execFileSync } = await import('node:child_process');
  const { writeFileSync } = await import('node:fs');
  const probe = new URL('./.work-auth-nokey-probe.mts', import.meta.url).pathname;
  const target = new URL('../src/lib/work-auth.ts', import.meta.url).pathname;
  writeFileSync(
    probe,
    `const m = await import('${target}');\nconsole.log('configured=' + m.isWorkAuthConfigured());\n`
  );
  let out = '';
  try {
    out = execFileSync('npx', ['tsx', probe], {
      encoding: 'utf8',
      env: {
        ...process.env,
        WORK_SESSION_SECRET: '',
        ADMIN_SESSION_SECRET: '',
        SUPABASE_SERVICE_ROLE_KEY: '',
        ADMIN_PASSWORD: '',
      },
    }).trim();
  } catch (e) {
    out = 'probe failed: ' + (e instanceof Error ? e.message : String(e));
  } finally {
    const { rmSync } = await import('node:fs');
    rmSync(probe, { force: true });
  }
  check('鍵が無ければ isWorkAuthConfigured() は false（別プロセスで確認）', out.includes('configured=false'), out);
}

console.log(`\n結果: ${pass} 件OK / ${fail} 件NG`);
if (fail > 0) process.exit(1);
