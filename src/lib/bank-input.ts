/**
 * 支援金振込口座の入力正規化・検証（2026-09-29 t iku指示）。
 *   口座番号 = 半角数字・必須
 *   口座名義 = 半角カナ・必須
 *
 * 🔴 方針: 弾くより正規化する（t ikuの運用ルール）。
 *   全角数字・ひらがな・全角カタカナは「同じ読みのまま文字幅だけ」変換して受け取る。
 *   読みや綴りを変える変換（ローマ字→カナ等）はしない＝本人の申告を書き換えない。
 *   変換しても条件を満たさないときだけ、理由の分かる文言で止める。
 */

const FULL_KATA = 'ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴヵヶ';
const HALF_KATA = [
  'ｧ', 'ｱ', 'ｨ', 'ｲ', 'ｩ', 'ｳ', 'ｪ', 'ｴ', 'ｫ', 'ｵ',
  'ｶ', 'ｶﾞ', 'ｷ', 'ｷﾞ', 'ｸ', 'ｸﾞ', 'ｹ', 'ｹﾞ', 'ｺ', 'ｺﾞ',
  'ｻ', 'ｻﾞ', 'ｼ', 'ｼﾞ', 'ｽ', 'ｽﾞ', 'ｾ', 'ｾﾞ', 'ｿ', 'ｿﾞ',
  'ﾀ', 'ﾀﾞ', 'ﾁ', 'ﾁﾞ', 'ｯ', 'ﾂ', 'ﾂﾞ', 'ﾃ', 'ﾃﾞ', 'ﾄ', 'ﾄﾞ',
  'ﾅ', 'ﾆ', 'ﾇ', 'ﾈ', 'ﾉ',
  'ﾊ', 'ﾊﾞ', 'ﾊﾟ', 'ﾋ', 'ﾋﾞ', 'ﾋﾟ', 'ﾌ', 'ﾌﾞ', 'ﾌﾟ', 'ﾍ', 'ﾍﾞ', 'ﾍﾟ', 'ﾎ', 'ﾎﾞ', 'ﾎﾟ',
  'ﾏ', 'ﾐ', 'ﾑ', 'ﾒ', 'ﾓ', 'ｬ', 'ﾔ', 'ｭ', 'ﾕ', 'ｮ', 'ﾖ',
  'ﾗ', 'ﾘ', 'ﾙ', 'ﾚ', 'ﾛ', 'ﾜ', 'ﾜ', 'ｲ', 'ｴ', 'ｦ', 'ﾝ', 'ｳﾞ', 'ｶ', 'ｹ',
];
const SYMBOLS: Record<string, string> = {
  'ー': 'ｰ', '－': '-', '‐': '-', '−': '-', '（': '(', '）': ')', '．': '.', '／': '/', '　': ' ', '・': '.',
};

/** 口座番号: 全角数字→半角、空白・ハイフンを除去 */
export function normalizeAccountNumber(raw: string): string {
  return String(raw ?? '')
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s\-－‐−ー]/g, '');
}

/** 口座番号の検証。null = OK、文字列 = エラー文言 */
export function accountNumberError(value: string): string | null {
  if (!value) return '口座番号を入力してください';
  if (!/^\d+$/.test(value)) return '口座番号は半角数字のみで入力してください';
  if (value.length > 8) return '口座番号の桁数が多すぎます（通常7桁です）';
  return null;
}

/** 口座名義: ひらがな・全角カナ・全角記号を半角カナへ（読みは変えない） */
export function normalizeAccountHolder(raw: string): string {
  let s = String(raw ?? '').trim();
  // ひらがな → 全角カタカナ
  s = s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
  // 全角カタカナ → 半角カナ
  s = Array.from(s).map(c => {
    const i = FULL_KATA.indexOf(c);
    if (i >= 0) return HALF_KATA[i];
    if (SYMBOLS[c] !== undefined) return SYMBOLS[c];
    return c;
  }).join('');
  // 全角英数 → 半角、英字は大文字（銀行の口座名義の表記）
  s = s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  // 連続空白を1つに
  return s.replace(/\s+/g, ' ');
}

/** 半角カナとして受け付ける文字（銀行の口座名義で使われる範囲） */
const HOLDER_OK = /^[ｦ-ﾟ ()./\-]+$/;

/** 口座名義の検証。null = OK、文字列 = エラー文言 */
export function accountHolderError(value: string): string | null {
  if (!value) return '口座名義を入力してください';
  if (!HOLDER_OK.test(value)) {
    if (/[A-Za-z]/.test(value)) return '口座名義は半角カナで入力してください（ローマ字は使えません。例: ﾔﾏﾀﾞ ﾀﾛｳ）';
    if (/[一-龥々]/.test(value)) return '口座名義は漢字ではなく半角カナで入力してください（例: ﾔﾏﾀﾞ ﾀﾛｳ）';
    return '口座名義は半角カナで入力してください（例: ﾔﾏﾀﾞ ﾀﾛｳ）';
  }
  if (!/[ｦ-ﾝ]/.test(value)) return '口座名義は半角カナで入力してください（例: ﾔﾏﾀﾞ ﾀﾛｳ）';
  return null;
}
