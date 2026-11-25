/**
 * 質問・問い合わせ・取材依頼（/contact）の入力仕様。
 *
 * 画面（ContactForm）とAPI（/api/contact）の**両方**がこの1ファイルを参照する。
 * 選択肢・上限・検証を片方だけ変えると「画面では通るのにAPIが弾く」状態になるため、
 * 必ずここに置く（/consult と同じ方針）。
 *
 * 2026-11-25 t iku指示で新設。サイトには従来お問い合わせの受け口が無く、
 * メールアドレスの記載（特商法表記）しかなかった。
 */

/** 用件の選択肢。取材は件名・本文のテンプレートを出し分けるために独立させる */
export const CONTACT_KINDS = [
  'サービスについての質問',
  '掲載・支援のご相談',
  '取材・メディア掲載の依頼',
  'その他',
] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

/** 取材依頼の判定（画面の補足表示・メール件名の接頭辞に使う） */
export const CONTACT_PRESS_KIND: ContactKind = '取材・メディア掲載の依頼';

export const CONTACT_NAME_MAX = 100;
export const CONTACT_ORGANIZATION_MAX = 120;
export const CONTACT_PHONE_MAX = 30;
export const CONTACT_MESSAGE_MIN = 20;
export const CONTACT_MESSAGE_MAX = 2000;

/** 画面から送られてくる値 */
export interface ContactInput {
  kind: string;
  name: string;
  /** 会社名・媒体名（任意。取材依頼では入れてほしいが必須にはしない） */
  organization: string;
  email: string;
  /** 電話番号（任意） */
  phone: string;
  message: string;
  agree: boolean;
}

export interface ContactValue {
  kind: ContactKind;
  name: string;
  organization: string;
  email: string;
  phone: string;
  message: string;
  agree: true;
}

export function isContactKind(value: string): value is ContactKind {
  return (CONTACT_KINDS as readonly string[]).includes(value);
}

/** メールアドレスの形式チェック（他のフォームと同じ緩さ＝弾きすぎない） */
export function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * 入力の検証。エラー文言はフォーム上部にそのまま出るので、
 * 「どの欄を直せばよいか」が分かる日本語で返す。
 */
export function validateContact(
  body: Partial<ContactInput>
): { ok: true; value: ContactValue } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  const kind = String(body.kind ?? '').trim();
  const name = String(body.name ?? '').trim();
  const organization = String(body.organization ?? '').trim();
  const email = String(body.email ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const message = String(body.message ?? '').trim();
  const agree = body.agree === true;

  if (!kind) errors.push('お問い合わせの種類を選択してください');
  else if (!isContactKind(kind)) {
    errors.push(`お問い合わせの種類は「${CONTACT_KINDS.join('・')}」から選択してください`);
  }

  if (!name) errors.push('お名前を入力してください');
  else if (name.length > CONTACT_NAME_MAX) {
    errors.push(`お名前が長すぎます（${CONTACT_NAME_MAX}文字以内）`);
  }

  if (organization.length > CONTACT_ORGANIZATION_MAX) {
    errors.push(`会社名・媒体名が長すぎます（${CONTACT_ORGANIZATION_MAX}文字以内）`);
  }

  if (!email) errors.push('メールアドレスを入力してください');
  else if (email.length > 254) errors.push('メールアドレスが長すぎます');
  else if (!isEmailLike(email)) errors.push('メールアドレスの形式が正しくありません');

  if (phone.length > CONTACT_PHONE_MAX) {
    errors.push(`電話番号が長すぎます（${CONTACT_PHONE_MAX}文字以内）`);
  }

  if (!message) errors.push('お問い合わせ内容を入力してください');
  else if (message.length < CONTACT_MESSAGE_MIN) {
    errors.push(`お問い合わせ内容は${CONTACT_MESSAGE_MIN}文字以上でご記入ください`);
  } else if (message.length > CONTACT_MESSAGE_MAX) {
    errors.push(`お問い合わせ内容は${CONTACT_MESSAGE_MAX}文字以内でご記入ください`);
  }

  if (!agree) errors.push('プライバシーポリシーへの同意が必要です');

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      kind: kind as ContactKind,
      name,
      organization,
      email,
      phone,
      message,
      agree: true,
    },
  };
}
