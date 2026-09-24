/**
 * 宛先メールアドレスの検証と正規化。
 *
 * 🔴 なぜ必要か（2026-09-24 本番障害）:
 *   申込完了メールが「未着（送信失敗）」になり、理由は Resend の
 *   `Invalid \`to\` field. The email address needs to follow the
 *    email@example.com or Name <email@example.com> format.` だった。
 *
 *   原因は入力チェックが **`email.includes('@')` だけ**だったこと。
 *   これだと次がすべて通ってしまい、**申込は成立するのにメールだけ落ちる**:
 *     - 全角文字混じり（`ａｂｃ＠ｇｍａｉｌ．ｃｏｍ`）
 *     - 前後や途中の空白（`abc @gmail.com`）
 *     - ドメインにドットが無い（`abc@gmail`）
 *     - 末尾の読点・句点（`abc@gmail.com、`）
 *     - `@` が2つ、日本語が混入、など
 *
 *   申込者は「申し込めた」と思っているのに案内が届かない——最悪の失敗の形なので、
 *   **受付の時点で弾く**（かつ、直せるものは直してから保存する）。
 */

/** 全角英数記号を半角へ寄せ、空白・引用符・末尾の句読点を落とす */
export function normalizeEmail(raw: unknown): string {
  let s = String(raw ?? '');

  // 全角英数字・記号（！〜～）を半角へ。全角＠や全角ピリオドもここで直る
  s = s.replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  // 全角スペース → 半角
  s = s.replace(/\u3000/g, ' ');
  // ゼロ幅文字（コピペで混入する）を除去
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');
  // メールアドレスに空白は入らない。途中の空白も含めてすべて除去する
  s = s.replace(/\s+/g, '');
  // 引用符・山括弧で囲まれている場合は外す
  s = s.replace(/^["'<]+|[">']+$/g, '');
  // 末尾の日本語句読点・読点（コピペ時に付いてくる）
  s = s.replace(/[、。,.;；:：]+$/g, '');
  // mailto: 付き
  s = s.replace(/^mailto:/i, '');

  return s.toLowerCase();
}

/**
 * Resend が受け付ける形式かどうか。
 *
 * 厳密なRFC準拠は目指さない（正規なアドレスを誤って弾くほうが害が大きい）。
 * ここで見るのは「Resend に渡して確実に失敗するもの」だけ:
 *   - `@` がちょうど1つあること
 *   - ローカル部・ドメイン部が空でないこと
 *   - ドメインにドットがあり、TLDが2文字以上のASCIIであること
 *   - ASCII の範囲に収まっていること（日本語混入を弾く）
 */
export function isValidEmail(value: string): boolean {
  if (!value) return false;
  if (value.length > 254) return false;
  // ASCII 以外が残っていたら不正（全角は normalizeEmail で直っているはず）
  if (/[^\x20-\x7E]/.test(value)) return false;
  if (!/^[^\s@,]+@[^\s@,]+\.[A-Za-z]{2,}$/.test(value)) return false;

  const [local, domain] = value.split('@');

  // 🔴 ドットの位置の規則（2026-09-24 追加）。
  //   本番で弾かれた実例が `lisuppo.park.@gmail.com` ＝ **@の直前にドット**。
  //   形だけ見ると「@がありドメインにドットもある」ので前段の正規表現は通ってしまい、
  //   Resend に渡して初めて Invalid `to` field で落ちていた。
  //   先頭・末尾のドットと連続ドットは、ローカル部・ドメイン部とも不正。
  for (const part of [local, domain]) {
    if (part.startsWith('.') || part.endsWith('.')) return false;
    if (part.includes('..')) return false;
  }
  // ドメインにハイフンの位置違反（先頭・末尾）があるものも弾く
  if (domain.split('.').some(lbl => !lbl || lbl.startsWith('-') || lbl.endsWith('-'))) return false;

  return true;
}

/**
 * 受付時の入口チェック。正規化したアドレスか、日本語のエラーメッセージを返す。
 *
 * エラー文は**申込者にそのまま見せる**ので、
 * 「何が悪いか」ではなく「どう直せばよいか」が分かる言い方にする。
 */
export function parseEmail(raw: unknown): { ok: true; email: string } | { ok: false; error: string } {
  const email = normalizeEmail(raw);
  if (!email) {
    return { ok: false, error: 'メールアドレスを入力してください' };
  }
  if (!isValidEmail(email)) {
    return {
      ok: false,
      error:
        'メールアドレスの形式が正しくありません。半角英数字で、example@gmail.com の形で入力してください（全角文字・スペース・記号の入力ミスにご注意ください）',
    };
  }
  return { ok: true, email };
}
