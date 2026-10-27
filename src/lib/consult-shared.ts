/**
 * LP（トップページ）相談フォームの入力仕様。
 *
 * クライアント（フォーム）とサーバー（/api/consult）の**両方**がこの1ファイルを参照する。
 * 区分の一覧を片方だけ増やすと、画面に出るのにAPIが弾く（またはその逆）状態になるため、
 * 選択肢・上限・検証は必ずここに置く。
 *
 * 🔴 サーバー側でも必ず検証する。ブラウザの required / maxLength は開発者ツールで
 *    外せるので、片方だけに任せると「必須」の意味が無くなる。
 */

/** 相談区分（§10 ラジオ4択・t ikuさん指定の文言そのまま） */
export const CONSULT_CATEGORIES = [
  '挑戦したい',
  '紹介したい',
  'アドバイザーになりたい',
  'EXPOに出展したい',
] as const;

export type ConsultCategory = (typeof CONSULT_CATEGORIES)[number];

/** 挑戦・相談の概要の上限（§10 textarea 500字） */
export const CONSULT_SUMMARY_MAX = 500;

/** LPのフォームから送られてくる値（APIの入力） */
export interface ConsultInput {
  name: string;
  email: string;
  phone: string;
  category: string;
  summary: string;
  agree: boolean;
  /** どのカードから来たか（1〜4）。計測・優先度付け用。未指定可 */
  entrance?: number;
  /** 流入元（既定 'top-lp'） */
  source?: string;
}

export interface ConsultValue {
  name: string;
  email: string;
  phone: string;
  category: ConsultCategory;
  summary: string;
  agree: true;
  entrance: number | null;
  source: string;
}

/**
 * メールアドレスの形式チェック。
 * 厳密なRFC準拠は狙わない（弾きすぎて申込を落とすほうが損失）。
 * 全角＠や全角英数字はここでは弾かず、送信直前の正規化に委ねる。
 */
export function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isConsultCategory(value: string): value is ConsultCategory {
  return (CONSULT_CATEGORIES as readonly string[]).includes(value);
}

/**
 * 入力の検証。エラー文言はフォームの該当項目にそのまま出るので、
 * 「どの欄が悪いか」が分かる日本語で返す。
 */
export function validateConsult(
  body: Partial<ConsultInput>
): { ok: true; value: ConsultValue } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const category = String(body.category ?? '').trim();
  const summary = String(body.summary ?? '').trim();

  if (!name) errors.push('氏名を入力してください');
  if (name.length > 100) errors.push('氏名が長すぎます（100文字以内）');

  if (!email) errors.push('メールアドレスを入力してください');
  else if (!isEmailLike(email)) errors.push('メールアドレスの形式が正しくありません（半角英数字で example@example.com の形）');
  else if (email.length > 254) errors.push('メールアドレスが長すぎます');

  if (phone && phone.length > 30) errors.push('電話番号が長すぎます（30文字以内）');

  if (!category) errors.push('相談区分を選んでください');
  else if (!isConsultCategory(category)) errors.push('相談区分の値が正しくありません');

  if (!summary) errors.push('挑戦・相談の概要を入力してください');
  else if (summary.length > CONSULT_SUMMARY_MAX) {
    errors.push(`挑戦・相談の概要は${CONSULT_SUMMARY_MAX}文字以内で入力してください`);
  }

  if (body.agree !== true) errors.push('プライバシーポリシーへの同意が必要です');

  if (errors.length > 0) return { ok: false, errors };

  const entranceNum = Number(body.entrance);
  return {
    ok: true,
    value: {
      name,
      email,
      phone,
      category: category as ConsultCategory,
      summary,
      agree: true,
      entrance: Number.isInteger(entranceNum) && entranceNum >= 1 && entranceNum <= 4 ? entranceNum : null,
      source: String(body.source ?? 'top-lp').slice(0, 60),
    },
  };
}
