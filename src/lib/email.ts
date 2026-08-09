import nodemailer from 'nodemailer';

/**
 * 確認メール送信ユーティリティ — XサーバーSMTP経由
 * Resendをフォールバックとして残す
 */

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || 'onboarding@resend.dev';

// SMTP transporter（lazy初期化）
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }
  return transporter;
}

interface EmailResult {
  success: boolean;
  error?: string;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<EmailResult> {
  const t = getTransporter();
  if (!t) {
    // SMTP未設定時はスキップ
    return { success: false, error: 'SMTP not configured' };
  }

  try {
    const info = await t.sendMail({
      from: `KAMOファンディング <${SMTP_FROM}>`,
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (err) {
    console.error('Email send error:', err);
    return { success: false, error: 'Failed to send email' };
  }
}

/**
 * 掲載説明会 申込完了メール
 */
export async function sendApplyConfirmationEmail(
  name: string,
  email: string,
  eventTitle?: string
): Promise<EmailResult> {
  const subject = '【KAMOファンディング】掲載説明会 申込完了';
  const html = `
    <div style="font-family: 'Noto Sans JP', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #E60012; color: #fff; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">🔥 KAMOファンディング</h1>
        <p style="margin: 4px 0 0; font-size: 14px;">掲載説明会 申込完了</p>
      </div>
      <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #eee;">
        <p>${name}様</p>
        <p>掲載説明会への申込を受け付けました。ありがとうございます！</p>
        ${eventTitle ? `<p><strong>参加予定回：</strong>${eventTitle}</p>` : '<p>開催日程が確定次第、改めてご案内いたします。</p>'}
        <p style="margin-top: 20px; padding: 16px; background: #FFF5F5; border-radius: 8px; font-size: 14px;">
          📅 開催日程は申込フォームの「参加希望回」で選択ください<br />
          💻 オンライン（Zoom）で開催<br />
          ⏱️ 約90分<br />
          💰 参加費無料
        </p>
        <p style="margin-top: 20px;">当日までに、ZoomのURLなど詳細をご案内いたします。</p>
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
          4. 掲載完了で報酬（総支援金額の約2%）
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
 * パートナーシップ説明会 申込完了メール
 */
export async function sendPartnerSessionConfirmationEmail(
  name: string,
  email: string
): Promise<EmailResult> {
  const subject = '【KAMOファンディング】パートナーシップ説明会 申込完了';
  const html = `
    <div style="font-family: 'Noto Sans JP', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #E60012; color: #fff; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">🤝 KAMOファンディング</h1>
        <p style="margin: 4px 0 0; font-size: 14px;">パートナーシップ説明会 申込完了</p>
      </div>
      <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #eee;">
        <p>${name}様</p>
        <p>パートナーシップ説明会への申込を受け付けました。ありがとうございます！</p>
        <p style="margin-top: 16px; padding: 16px; background: #FFF5F5; border-radius: 8px; font-size: 14px;">
          📢 アドバイザー・紹介パートナー・PJサポーターの合同説明会<br />
          ⏱️ 90分・オンライン・無料<br />
          💻 Zoomで開催
        </p>
        <p style="margin-top: 16px;">
          <strong>3つのプログラム：</strong><br />
          1. 紹介パートナー — 紹介するだけで総支援金額の約2%<br />
          2. アドバイザー養成講座 — KAMO手数料の20%＋コンサルフィー<br />
          3. プロジェクトサポーター — PR・事務局で伴走サポート
        </p>
        <p style="margin-top: 20px;">開催日程が確定次第、Zoom URL等の詳細をご案内いたします。</p>
        <p style="margin-top: 20px; font-size: 12px; color: #999;">
          KAMO FUNDING — 共犯者を集め、夢を叶える場所<br />
          https://kamo-funding-app.vercel.app/
        </p>
      </div>
    </div>
  `;
  return sendEmail(email, subject, html);
}
