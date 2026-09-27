/**
 * パートナー登録系APIの流入元（UTM）保存。
 *
 * 🔴 いちばん大事な性質: **UTMの保存に失敗しても登録は必ず成功させる。**
 *   `supabase/migration-utm-partners-2026-09-27.sql` が未実行の間、
 *   partners テーブルには utm_* 列が無い。そこへ utm_* を含む insert を投げると
 *   PostgREST は PGRST204 / 42703 を返して**登録そのものが落ちる**。
 *   登録フォームが500を返すのは最悪の結果なので、列欠落を検知したら
 *   **UTMだけ落として同じ行を入れ直す**（`api/ai/submit` の isMissingBankColumn と同じ考え方）。
 *
 * 保存するのは3列だけ:
 *   utm_source / utm_medium / utm_campaign
 *   クライアントは `referrer` も送ってくるが、**partners テーブルには referrer 列が無い**ため
 *   保存対象にしない（無い列を入れようとすると上記の欠落フォールバックが毎回走ってしまう）。
 *
 * 本人申告の経路（`source` / `message`）とは**別物**なので併存させる。片方に寄せない。
 */

import { normalizeUtmValue } from './utm';

/** partners テーブルに実際に存在するUTM列（migration-utm-partners-2026-09-27.sql と一致させる） */
export const PARTNER_UTM_COLUMNS = ['utm_source', 'utm_medium', 'utm_campaign'] as const;

export type PartnerUtm = Partial<Record<(typeof PARTNER_UTM_COLUMNS)[number], string>>;

/**
 * リクエストボディから保存対象のUTMだけを取り出し、正規化する。
 * 値が無い項目はキーごと省く（列が空のままになる）。
 */
export function extractPartnerUtm(body: Record<string, unknown>): PartnerUtm {
  const out: PartnerUtm = {};
  for (const key of PARTNER_UTM_COLUMNS) {
    const v = normalizeUtmValue(body?.[key]);
    if (v) out[key] = v;
  }
  return out;
}

/**
 * UTM列がまだ存在しないことによるエラーかを判定する。
 *
 * PostgREST はスキーマキャッシュ由来の PGRST204、
 * 直接SQL経路では Postgres の 42703（undefined_column）を返す。
 * メッセージに utm_ を含むケースも拾う（他の列欠落と誤判定しないため列名を見る）。
 */
export function isMissingUtmColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = error.message || '';
  if (error.code === 'PGRST204' || error.code === '42703') {
    // 列名が読み取れる場合は utm_ 由来か確かめる。読み取れなければ UTM を落として再試行する価値がある
    return !/column/i.test(msg) || /utm_/.test(msg) || !/"/.test(msg);
  }
  return /utm_(source|medium|campaign)/.test(msg) && /column|could not find/i.test(msg);
}

/** UTMのキーを取り除いたコピーを返す（再試行用） */
export function withoutUtm<T extends Record<string, unknown>>(data: T): T {
  const copy = { ...data } as Record<string, unknown>;
  for (const key of PARTNER_UTM_COLUMNS) delete copy[key];
  return copy as T;
}

/**
 * partners への insert を「UTM付きで試し、列が無ければUTM抜きで入れ直す」形で実行する。
 *
 * @param run insert を実行する関数。呼び出し側が select().single() まで含めて渡す。
 * @returns insert の結果。UTMを落として成功した場合は `utmDropped: true` が付く。
 */
export interface InsertOutcome<T> {
  data: T | null;
  error: { code?: string; message?: string } | null;
}

export async function insertWithUtmFallback<T>(
  insertData: Record<string, unknown>,
  // Supabase のクエリビルダは Promise ではなく thenable なので PromiseLike で受ける
  run: (data: Record<string, unknown>) => PromiseLike<InsertOutcome<T>>
): Promise<InsertOutcome<T> & { utmDropped: boolean }> {
  const first = await run(insertData);
  if (!first.error || !isMissingUtmColumn(first.error)) {
    return { data: first.data, error: first.error, utmDropped: false };
  }
  // 列が未追加。**登録を落とさない**ことを優先して、UTMだけ捨てて入れ直す。
  console.info('partners insert: utm columns missing — retrying without utm (migration-utm-partners-2026-09-27.sql 未実行)');
  const retry = await run(withoutUtm(insertData));
  return { data: retry.data, error: retry.error, utmDropped: true };
}
