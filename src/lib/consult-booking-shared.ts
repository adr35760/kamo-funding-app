/**
 * 個別相談の予約前アンケート（/consult）の入力仕様。
 *
 * 画面（ConsultForm）とAPI（/api/consult-booking）の**両方**がこの1ファイルを参照する。
 * 選択肢・上限・検証を片方だけ変えると「画面では通るのにAPIが弾く」状態になるため、
 * 必ずここに置く。
 *
 * 2026-11-24 t iku指示の6項目（氏名・性別・年齢・メールアドレス・
 * 今考えているアイディアや企画・集めたい希望金額）を、すべて必須で受ける。
 */

/** 性別の選択肢（t iku指定の項目。回答しづらい人のために「その他」を置く） */
export const CONSULT_GENDERS = ['女性', '男性', 'その他'] as const;
export type ConsultGender = (typeof CONSULT_GENDERS)[number];

/** 年齢の許容範囲（契約年齢を下回る入力・打ち間違いを弾く） */
export const CONSULT_AGE_MIN = 18;
export const CONSULT_AGE_MAX = 120;

/** アイディア・企画の上限（LP相談フォームの500字より広く取る。長文の企画説明を落とさない） */
export const CONSULT_IDEA_MAX = 2000;

/** 希望金額の上限（「100万円」「300万〜500万円」等の自由記入を想定） */
export const CONSULT_AMOUNT_MAX = 100;

/** 画面から送られてくる値 */
export interface ConsultBookingInput {
  name: string;
  gender: string;
  age: string | number;
  email: string;
  idea: string;
  amount: string;
  agree: boolean;
  /** 流入元（既定 'consult'） */
  source?: string;
}

export interface ConsultBookingValue {
  name: string;
  gender: ConsultGender;
  age: number;
  email: string;
  idea: string;
  amount: string;
  agree: true;
  source: string;
}

export function isConsultGender(value: string): value is ConsultGender {
  return (CONSULT_GENDERS as readonly string[]).includes(value);
}

/** メールアドレスの形式チェック（相談フォームと同じ緩さ＝弾きすぎない） */
export function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * 入力の検証。エラー文言はフォーム上部にそのまま出るので、
 * 「どの欄を直せばよいか」が分かる日本語で返す。
 */
export function validateConsultBooking(
  body: Partial<ConsultBookingInput>
): { ok: true; value: ConsultBookingValue } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  const name = String(body.name ?? '').trim();
  const gender = String(body.gender ?? '').trim();
  const ageRaw = String(body.age ?? '').trim();
  const email = String(body.email ?? '').trim();
  const idea = String(body.idea ?? '').trim();
  const amount = String(body.amount ?? '').trim();
  const agree = body.agree === true;
  const source = String(body.source ?? '').trim() || 'consult';

  if (!name) errors.push('氏名を入力してください');
  if (name.length > 100) errors.push('氏名が長すぎます（100文字以内）');

  if (!gender) errors.push('性別を選択してください');
  else if (!isConsultGender(gender)) errors.push('性別は「女性・男性・その他」から選択してください');

  const age = Number(ageRaw);
  if (!ageRaw) errors.push('年齢を入力してください');
  else if (!Number.isInteger(age) || age < CONSULT_AGE_MIN || age > CONSULT_AGE_MAX) {
    errors.push(`年齢は${CONSULT_AGE_MIN}〜${CONSULT_AGE_MAX}の数字で入力してください`);
  }

  if (!email) errors.push('メールアドレスを入力してください');
  else if (email.length > 254) errors.push('メールアドレスが長すぎます');
  else if (!isEmailLike(email)) errors.push('メールアドレスの形式が正しくありません');

  if (!idea) errors.push('今考えているアイディアや企画を入力してください');
  if (idea.length > CONSULT_IDEA_MAX) {
    errors.push(`アイディアや企画は${CONSULT_IDEA_MAX}文字以内で入力してください`);
  }

  if (!amount) errors.push('集めたい希望金額を入力してください');
  if (amount.length > CONSULT_AMOUNT_MAX) {
    errors.push(`希望金額は${CONSULT_AMOUNT_MAX}文字以内で入力してください`);
  }

  if (!agree) errors.push('プライバシーポリシーへの同意が必要です');

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      gender: gender as ConsultGender,
      age,
      email,
      idea,
      amount,
      agree: true,
      source,
    },
  };
}
