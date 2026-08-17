import { Resend } from 'resend';
import { referralTermsHtml } from '@/lib/referral-terms';

/**
 * 確認メール送信ユーティリティ — Resend経由
 * ドメイン認証済みの info@local-creation.com から送信
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

/**
 * 受講オンラインURL（Zoom）— 全イベント共通の固定値（t iku提供）
 */
export const ZOOM_URL = 'https://us06web.zoom.us/j/6719620613?pwd=SHBlOFpzOWl4bzNFdUV5QUFXQlhNZz09';
export const ZOOM_MEETING_ID = '671 962 0613';
export const ZOOM_PASSCODE = '9Q7m0f';

/** メール本文に挿入する Zoom 情報ブロック */
function zoomBlockHtml(): string {
  return `
    <div style="margin: 16px 0; padding: 16px; background: #F4F8FF; border: 1px solid #CCE0FF; border-radius: 8px; font-size: 14px;">
      <p style="margin: 0 0 8px; font-weight: 700; color: #1A73E8;">📍 受講オンライン（Zoom）</p>
      <p style="margin: 0 0 4px;">URL: <a href="${ZOOM_URL}" style="color: #1A73E8; word-break: break-all;">${ZOOM_URL}</a></p>
      <p style="margin: 0 0 4px;">ミーティングID: <strong>${ZOOM_MEETING_ID}</strong></p>
      <p style="margin: 0;">パスコード: <strong>${ZOOM_PASSCODE}</strong></p>
    </div>
  `;
}

/** リアル開催回の会場案内ブロック（Zoom情報の代わり） */
function venueBlockHtml(): string {
  return `
    <div style="margin: 16px 0; padding: 16px; background: #FFFBF0; border: 1px solid #E6D9A8; border-radius: 8px; font-size: 14px;">
      <p style="margin: 0 0 8px; font-weight: 700; color: #8A6D1F;">📍 会場のご案内</p>
      <p style="margin: 0 0 4px;">セミナー会場: <strong>エデュケーションギャラリー</strong></p>
      <p style="margin: 0 0 8px;">懇親会会場: <strong>YAKINIKUMAFIA</strong></p>
      <p style="margin: 0; font-size: 13px; color: #666;">会場の詳しい住所・アクセス、当日の持ち物などは、開催が近づきましたら改めてご案内します。</p>
    </div>
  `;
}

/**
 * RESEND_FROM_EMAIL の形式チェック
 * 有効な形式: "email@example.com" または "Name <email@example.com>"
 * コピペで壊れた値（全角括弧・前後余分なスペース・引用符等）は無効とみなし、
 * 安全なデフォルトへフォールバックする。
 */
const DEFAULT_FROM_EMAIL = 'KAMOファンディング <info@local-creation.com>';

function resolveFromEmail(): string {
  const raw = (process.env.RESEND_FROM_EMAIL || '').trim().replace(/\u3000/g, ' ');
  if (!raw) return DEFAULT_FROM_EMAIL;
  // 全角 ＜＞ を半角に、両端の引用符を除去
  const cleaned = raw.replace(/[＜＞]/g, (m) => (m === '＜' ? '<' : '>')).replace(/^["']+|["']+$/g, '');
  const simple = /^[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+$/.test(cleaned);
  const named = /^[^<>{}\[\]]+\s*<[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+>$/.test(cleaned);
  return simple || named ? cleaned : DEFAULT_FROM_EMAIL;
}

const FROM_EMAIL = resolveFromEmail();

const resend = new Resend(RESEND_API_KEY);

interface EmailResult {
  success: boolean;
  error?: string;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<EmailResult> {
  if (!RESEND_API_KEY) {
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('Email send error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Email send error:', err);
    return { success: false, error: 'Failed to send email' };
  }
}

/**
 * 掲載説明会 申込完了メール
 * @param name お名前
 * @param email メールアドレス
 * @param eventTitle イベント名（例: 第1回 KAMOファンディング無料掲載説明会）
 * @param eventDateJa 開催日時の日本語表記（例: 8/18（火）19:30〜21:00）
 */
export async function sendApplyConfirmationEmail(
  name: string,
  email: string,
  eventTitle?: string,
  eventDateJa?: string,
  /** イベント種別。3=リアル開催（会場案内）、2=オンラインセミナー、その他=掲載説明会 */
  pillar?: number | null
): Promise<EmailResult> {
  const isReal = pillar === 3;
  const isOnlineSeminar = pillar === 2;
  const headingLabel = isReal
    ? 'リアルセミナー＆懇親会 申込完了'
    : isOnlineSeminar
      ? 'オンラインセミナー 申込完了'
      : '掲載説明会 申込完了';
  const bodyLabel = isReal
    ? 'リアルセミナー＆懇親会'
    : isOnlineSeminar
      ? 'オンラインセミナー'
      : '掲載説明会';
  const subject = eventTitle ? `【KAMOファンディング】${eventTitle} 申込完了` : `【KAMOファンディング】${bodyLabel} 申込完了`;
  const html = `
    <div style="font-family: 'Noto Sans JP', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #E60012; color: #fff; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">🔥 KAMOファンディング</h1>
        <p style="margin: 4px 0 0; font-size: 14px;">${headingLabel}</p>
      </div>
      <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #eee;">
        <p>${name}様</p>
        <p>${bodyLabel}への申込を受け付けました。ありがとうございます！</p>
        ${eventTitle ? `<p><strong>参加予定回：</strong>${eventTitle}</p>` : '<p>開催日程が確定次第、改めてご案内いたします。</p>'}
        ${eventDateJa ? `
        <div style="margin-top: 16px; padding: 16px; background: #FFF5F5; border-radius: 8px; font-size: 15px; border: 1px solid #FFD6D6;">
          <p style="margin: 0 0 4px; font-weight: 700; color: #E60012;">📅 開催日時</p>
          <p style="margin: 0; font-size: 18px; font-weight: 700;">${eventDateJa}</p>
        </div>` : ''}
        ${isReal ? `
        <p style="margin-top: 16px; padding: 16px; background: #FFFBF0; border-radius: 8px; font-size: 14px;">
          🏢 会場開催（セミナー＋懇親会）<br />
          💰 参加費・詳細は追ってご案内します
        </p>` : isOnlineSeminar ? `
        <p style="margin-top: 16px; padding: 16px; background: #F4F8FF; border-radius: 8px; font-size: 14px;">
          💻 オンライン（Zoom）で開催<br />
          💰 参加費・詳細は追ってご案内します
        </p>` : `
        <p style="margin-top: 16px; padding: 16px; background: #FFF5F5; border-radius: 8px; font-size: 14px;">
          💻 オンライン（Zoom）で開催<br />
          ⏱️ 約90分<br />
          💰 参加費無料
        </p>`}
        ${isReal ? venueBlockHtml() : zoomBlockHtml()}
        <p style="margin-top: 20px;">${isReal
          ? '当日は、開始時刻までに会場へお越しください。'
          : '当日、指定の日時までにZoomへアクセスしてください。'}</p>
        <p style="margin-top: 20px; font-size: 12px; color: #999;">
          KAMO FUNDING — 共犯者を集め、夢を叶える場所<br />
          https://kamo-funding-app.vercel.app/
        </p>
      </div>
    </div>
  `;
  return sendEmail(email, subject, html);
}

/**
 * 開催当日リマインドメール
 * @param name お名前
 * @param email メールアドレス
 * @param eventTitle イベント名
 * @param eventDateJa 開催日時の日本語表記（例: 8/18（火）19:30〜21:00）
 */
export async function sendReminderEmail(
  name: string,
  email: string,
  eventTitle: string,
  eventDateJa: string
): Promise<EmailResult> {
  const subject = `【KAMOファンディング】本日開催: ${eventTitle}`;
  const html = `
    <div style="font-family: 'Noto Sans JP', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #E60012; color: #fff; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">🔥 KAMOファンディング</h1>
        <p style="margin: 4px 0 0; font-size: 14px;">開催リマインド</p>
      </div>
      <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #eee;">
        <p>${name}様</p>
        <p>本日、ご参加予定の下記説明会が開催されます。</p>
        <div style="margin-top: 16px; padding: 16px; background: #FFF5F5; border-radius: 8px; border: 1px solid #FFD6D6;">
          <p style="margin: 0 0 4px; font-weight: 700; color: #E60012;">📅 開催日時</p>
          <p style="margin: 0 0 8px; font-size: 18px; font-weight: 700;">${eventDateJa}</p>
          <p style="margin: 0; font-size: 13px; color: #666;">${eventTitle}</p>
        </div>
        ${zoomBlockHtml()}
        <p style="margin-top: 20px;">それでは、お会いできるのを楽しみにしています！</p>
        <p style="margin-top: 20px; font-size: 12px; color: #999;">
          KAMO FUNDING — 共犯者を集め、夢を叶える場所<br />
          https://kamo-funding-app.vercel.app/
        </p>
      </div>
    </div>
  `;
  return sendEmail(email, subject, html);
}

/**
 * 紹介パートナー登録完了メール
 */
export async function sendPartnerConfirmationEmail(
  name: string,
  email: string,
  referralCode: string
): Promise<EmailResult> {
  const subject = '【KAMOファンディング】紹介パートナー登録完了 — 紹介コード発行';
  const html = `
    <div style="font-family: 'Noto Sans JP', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #27AE60; color: #fff; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">🤝 KAMOファンディング</h1>
        <p style="margin: 4px 0 0; font-size: 14px;">紹介パートナー登録完了</p>
      </div>
      <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #eee;">
        <p>${name}様</p>
        <p>紹介パートナーの登録が完了しました。ありがとうございます！</p>
        <div style="margin: 20px 0; padding: 20px; background: #fff; border: 2px solid #27AE60; border-radius: 8px; text-align: center;">
          <p style="font-size: 13px; color: #666; margin: 0 0 4px;">あなたの紹介コード</p>
          <p style="font-size: 28px; font-weight: bold; color: #27AE60; font-family: monospace; letter-spacing: 2px; margin: 0;">${referralCode}</p>
        </div>
        <p style="margin-top: 16px;">このコードを紹介先に共有してください。掲載時にこのコードを使うことで、紹介実績として自動的に記録されます。</p>
        <p style="margin-top: 16px; padding: 16px; background: #F0FFF0; border-radius: 8px; font-size: 14px;">
          <strong>次のステップ：</strong><br />
          1. 説明会に参加（必須）<br />
          2. 紹介先にKAMOファンディングを紹介<br />
          3. 紹介コードを共有<br />
          4. 掲載完了で報酬（対象額の約2%）
        </p>
        <p style="margin-top: 20px; font-size: 12px; color: #999;">
          KAMO FUNDING — 共犯者を集め、夢を叶える場所<br />
          https://kamo-funding-app.vercel.app/
        </p>
      </div>
    </div>
  `;
  return sendEmail(email, subject, html);
}

/**
 * サポーター登録完了メール
 */
export async function sendSupporterConfirmationEmail(
  name: string,
  email: string,
  referralCode: string
): Promise<EmailResult> {
  const subject = '【KAMOファンディング】プロジェクトサポーター登録完了';
  const html = `
    <div style="font-family: 'Noto Sans JP', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #D4A017; color: #fff; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">🌟 KAMOファンディング</h1>
        <p style="margin: 4px 0 0; font-size: 14px;">プロジェクトサポーター登録完了</p>
      </div>
      <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #eee;">
        <p>${name}様</p>
        <p>プロジェクトサポーターの登録が完了しました。ありがとうございます！</p>
        <div style="margin: 20px 0; padding: 20px; background: #fff; border: 2px solid #D4A017; border-radius: 8px; text-align: center;">
          <p style="font-size: 13px; color: #666; margin: 0 0 4px;">あなたの紹介コード</p>
          <p style="font-size: 28px; font-weight: bold; color: #D4A017; font-family: monospace; letter-spacing: 2px; margin: 0;">${referralCode}</p>
        </div>
        <p style="margin-top: 16px;">KAMOファンディングの「サポーターコミュニティ」へようこそ！</p>
        <p style="margin-top: 16px; padding: 16px; background: #FFFAF0; border-radius: 8px; font-size: 14px;">
          <strong>サポーターの役割：</strong><br />
          📋 事務局サポート（サムネ作成、リターン申請チェック等）<br />
          📱 SNS・ライブ配信サポート<br />
          🤝 KAMOファンパートナー（裏側作業）<br />
          🎉 イベントサポーター（当日の会場手配・受付等）
        </p>
        <p style="margin-top: 16px;">※説明会参加が必須です。開催日程をチェックしてください！</p>
        <p style="margin-top: 20px; font-size: 12px; color: #999;">
          KAMO FUNDING — 共犯者を集め、夢を叶える場所<br />
          https://kamo-funding-app.vercel.app/
        </p>
      </div>
    </div>
  `;
  return sendEmail(email, subject, html);
}

/**
 * パートナーシップ個別説明会（1対1） 申込完了メール
 * 固定日程・Zoom情報は記載せず、日程確定連絡時に個別案内する運用。
 * @param preferredSlots 申込時に入力された希望日時（第1希望 / 第2希望）
 */
export async function sendPartnerSessionConfirmationEmail(
  name: string,
  email: string,
  preferredSlots?: string
): Promise<EmailResult> {
  const subject = '【KAMOファンディング】パートナーシップ個別説明会 申込完了';
  const html = `
    <div style="font-family: 'Noto Sans JP', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #E60012; color: #fff; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">🤝 KAMOファンディング</h1>
        <p style="margin: 4px 0 0; font-size: 14px;">パートナーシップ個別説明会 申込完了</p>
      </div>
      <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #eee;">
        <p>${name}様</p>
        <p>パートナーシップ個別説明会（1対1）への申込を受け付けました。ありがとうございます！</p>
        <p style="margin-top: 16px; padding: 16px; background: #FFF5F5; border-radius: 8px; font-size: 14px;">
          🤝 1対1の個別説明会（オンライン・無料）<br />
          ⏱️ 所要時間の目安: 60分<br />
          💻 オンライン（Zoom）
        </p>
        ${preferredSlots ? `
        <div style="margin-top: 16px; padding: 16px; background: #F4F8FF; border: 1px solid #CCE0FF; border-radius: 8px; font-size: 14px;">
          <p style="margin: 0 0 4px; font-weight: 700; color: #1A73E8;">📅 ご希望日時</p>
          <p style="margin: 0;">${preferredSlots}</p>
        </div>` : ''}
        <p style="margin-top: 16px;">
          <strong>3つのプログラム：</strong><br />
          1. 紹介パートナー — 紹介するだけで対象額（総支援金額ー手数料ー消費税）の約2%<br />
          2. アドバイザー養成講座 — KAMO手数料の20%＋コンサルフィー<br />
          3. プロジェクトサポーター — PR・事務局で伴走サポート
        </p>
        <p style="margin-top: 20px; padding: 16px; background: #FFF9E6; border: 1px solid #FFE9A8; border-radius: 8px;">
          <strong>ご希望日時を確認のうえ、担当者より日程確定のご連絡をします。</strong><br />
          <span style="font-size: 13px; color: #666;">Zoomの参加URLは、日程確定のご連絡時にあわせてご案内いたします。</span>
        </p>
        <p style="margin-top: 20px; font-size: 12px; color: #999;">
          KAMO FUNDING — 共犯者を集め、夢を叶える場所<br />
          https://kamo-funding-app.vercel.app/
        </p>
      </div>
    </div>
  `;
  return sendEmail(email, subject, html);
}

/**
 * 紹介者登録の確認メール（宛先: 紹介パートナー本人）
 * 紹介料規約の全文を同梱する。
 */
export async function sendReferralRegistrationEmail(
  partnerName: string,
  partnerEmail: string,
  info: { referredName: string; relationship: string; referralCode: string }
): Promise<EmailResult> {
  const subject = '【KAMOファンディング】紹介者の登録完了／紹介料規約のご案内';
  const html = `
    <div style="font-family: 'Noto Sans JP', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #0B1D3A; color: #fff; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">🤝 KAMOファンディング</h1>
        <p style="margin: 4px 0 0; font-size: 14px; color: #D4AF37;">紹介者の登録が完了しました</p>
      </div>
      <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #eee;">
        <p>${partnerName}様</p>
        <p>紹介者のご登録ありがとうございます。以下の内容で受け付けました。</p>
        <div style="margin-top: 16px; padding: 16px; background: #fff; border: 1px solid #E6D9A8; border-radius: 8px; font-size: 14px;">
          <p style="margin: 0 0 6px;"><strong>紹介者氏名：</strong>${info.referredName}</p>
          <p style="margin: 0 0 6px;"><strong>ご関係：</strong>${info.relationship}</p>
          <p style="margin: 0;"><strong>紹介コード：</strong>${info.referralCode}</p>
        </div>
        <p style="margin-top: 16px; font-size: 14px;">
          この紹介は紹介コード経由であなたの紹介として記録されました。掲載が完了し募集が終了した時点で、
          対象額（総支援金額から手数料・手数料に係る消費税を控除した額）の<strong>2%</strong>が紹介料として確定し、登録メールアドレス宛に明細を発行のうえ、
          <strong>終了月の翌々月末</strong>に指定口座へお支払いします。
        </p>
        <p style="margin-top: 20px; font-size: 13px; color: #666;">
          ご登録時にご同意いただいた紹介料規約の全文を、控えとして以下に記載します。
        </p>
        ${referralTermsHtml()}
        <p style="margin-top: 20px; font-size: 12px; color: #999;">
          KAMO FUNDING — 共犯者を集め、夢を叶える場所<br />
          https://kamo-funding-app.vercel.app/
        </p>
      </div>
    </div>
  `;
  return sendEmail(partnerEmail, subject, html);
}
