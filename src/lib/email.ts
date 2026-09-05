import { Resend } from 'resend';
import { referralTermsHtml } from '@/lib/referral-terms';
import {
  AI_SEMINAR,
  REAL_SEMINAR,
  PRICE_TAX_NOTE,
  pendingLabel,
  paymentInfoFor,
  PAYMENT_STORE_URL,
} from '@/lib/seminar-config';

/**
 * 確認メール送信ユーティリティ — Resend経由
 * ドメイン認証済みの info@local-creation.com から送信
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

/**
 * 受講オンラインURL（Zoom）— 全イベント共通の固定値（t iku提供）
 */
export const ZOOM_URL = 'https://us02web.zoom.us/j/5034392656?pwd=aWVVYXNQNVNEVm5jZ0R3ZGo3WVc4Zz09';
export const ZOOM_MEETING_ID = '503 439 2656';
export const ZOOM_PASSCODE = '769769';

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

/**
 * お支払い案内ブロック（有料セミナーのみ）
 *
 * 🔴 呼び出し側で pillar を判定し、paymentInfoFor() が null を返す
 *   （＝無料の掲載説明会など）場合はこのブロックを一切出さない。
 * 🔴 リンク先はストアのトップで複数商品が並ぶため、
 *   **選ぶべき商品名と金額を明示**して誤購入を防ぐ。
 */
export function paymentBlockHtml(pillar?: number | null): string {
  const info = paymentInfoFor(pillar);
  if (!info) return '';
  const pick = info.productName
    ? `<strong>「${info.productName}」（${info.priceLabel}）</strong>をお選びください。`
    : `<strong>${info.priceLabel}</strong>の商品をお選びください。`;
  return `
    <div style="margin: 16px 0; padding: 16px; background: #FFF9E6; border: 2px solid #E6B800; border-radius: 8px; font-size: 14px;">
      <p style="margin: 0 0 8px; font-weight: 700; color: #8A6D1F; font-size: 15px;">💳 参加費のお支払いについて</p>
      <p style="margin: 0 0 10px;">参加費は <strong style="font-size: 17px;">${info.priceLabel}</strong> です。下記のお支払いページよりお手続きをお願いいたします。</p>
      <p style="margin: 0 0 12px;">
        <a href="${PAYMENT_STORE_URL}" style="display: inline-block; background: #E60012; color: #fff; padding: 12px 22px; border-radius: 6px; font-weight: 700; text-decoration: none;">お支払いページへ進む →</a>
      </p>
      <p style="margin: 0 0 8px; word-break: break-all; font-size: 12px; color: #666;">
        ボタンが開かない場合は、こちらのURLをブラウザに貼り付けてください：<br />
        <a href="${PAYMENT_STORE_URL}" style="color: #1A73E8;">${PAYMENT_STORE_URL}</a>
      </p>
      <p style="margin: 0 0 8px; padding: 10px 12px; background: #FFF; border: 1px solid #E6D9A8; border-radius: 6px;">
        ⚠️ <strong>お支払いページには複数の商品が並んでいます。</strong>${pick}
      </p>
      <p style="margin: 0; font-weight: 700; color: #E60012;">※お支払いをもってお申し込みが確定となります。</p>
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
  /** 単一アドレス、または複数宛先（Resendは配列を受け付ける） */
  to: string | string[],
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
  const bodyLabel = pillar === 3
    ? 'リアルセミナー＆懇親会'
    : pillar === 2
      ? 'オンラインセミナー'
      : '掲載説明会';
  const subject = eventTitle ? `【KAMOファンディング】${eventTitle} 申込完了` : `【KAMOファンディング】${bodyLabel} 申込完了`;
  const html = applyConfirmationHtml({ name, eventTitle, eventDateJa, pillar });
  return sendEmail(email, subject, html);
}

/**
 * 申込完了メールのHTMLを組み立てる（送信はしない）。
 * 送信処理から切り離してあるので、検証時に本文だけを取り出せる。
 */
export function applyConfirmationHtml({
  name,
  eventTitle,
  eventDateJa,
  pillar,
}: {
  name: string;
  eventTitle?: string;
  eventDateJa?: string;
  pillar?: number | null;
}): string {
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
  return `
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
          💰 参加費：<strong>${pendingLabel(REAL_SEMINAR.price)}</strong>${REAL_SEMINAR.priceNote ? `（${REAL_SEMINAR.priceNote}）` : ''}<br />
          👥 定員：${pendingLabel(REAL_SEMINAR.capacity)}${REAL_SEMINAR.capacityParty ? ` / ${pendingLabel(REAL_SEMINAR.capacityParty)}` : ''}
          ${PRICE_TAX_NOTE ? `<br /><span style="font-size: 12px; color: #666;">${PRICE_TAX_NOTE}</span>` : ''}
        </p>` : isOnlineSeminar ? `
        <p style="margin-top: 16px; padding: 16px; background: #F4F8FF; border-radius: 8px; font-size: 14px;">
          💻 オンライン（Zoom）で開催<br />
          💰 参加費：<strong>${pendingLabel(AI_SEMINAR.price)}</strong>
          ${PRICE_TAX_NOTE ? `<br /><span style="font-size: 12px; color: #666;">${PRICE_TAX_NOTE}</span>` : ''}
        </p>` : `
        <p style="margin-top: 16px; padding: 16px; background: #FFF5F5; border-radius: 8px; font-size: 14px;">
          💻 オンライン（Zoom）で開催<br />
          ⏱️ 約90分<br />
          💰 参加費無料
        </p>`}
        ${paymentBlockHtml(pillar)}
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
}

/**
 * Zoom情報変更のご案内メール（申込済みの方への個別連絡）
 *
 * 既存メールと同じ送信基盤・同じ送信元・同じHTML体裁で送る。
 * 呼び出し側が1件ずつ順に呼ぶ前提で、1通ごとに成否を返す。
 * reminder_sent など既存フラグには一切触れない（当日リマインドは通常どおり動く）。
 *
 * @param name お名前（本文の「◯◯様」に差し込む）
 * @param email 宛先
 * @param eventTitle イベント名
 * @param eventDateJa 開催日時の日本語表記（例: 9/15（火）19:30〜21:00）
 */
export async function sendZoomChangeNoticeEmail(
  name: string,
  email: string,
  eventTitle: string,
  eventDateJa: string
): Promise<EmailResult> {
  const subject = `【重要／KAMOファンディング】${eventDateJa.split('（')[0]} 掲載説明会のZoom情報変更のお知らせ`;
  const html = `
    <div style="font-family: 'Noto Sans JP', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #E60012; color: #fff; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">🔥 KAMOファンディング</h1>
        <p style="margin: 4px 0 0; font-size: 14px;">Zoom情報 変更のお知らせ</p>
      </div>
      <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #eee;">
        <p>${name}様</p>
        <p>KAMOファンディング事務局です。<br />
        このたびは「${eventTitle}」にお申し込みいただき、誠にありがとうございます。</p>

        <p style="margin-top: 16px; padding: 16px; background: #FFF5F5; border: 1px solid #FFD6D6; border-radius: 8px;">
          大切なお知らせがございます。<br />
          <strong>当日ご参加いただくZoomの情報が変更となりました。</strong><br />
          <strong style="color: #E60012;">お申し込み完了時にお送りしたメールに記載のURLでは、ご入室いただけません。</strong>
        </p>

        ${zoomBlockHtml()}

        <div style="margin-top: 16px; padding: 16px; background: #FFF5F5; border-radius: 8px; font-size: 15px; border: 1px solid #FFD6D6;">
          <p style="margin: 0 0 4px; font-weight: 700; color: #E60012;">📅 開催日時</p>
          <p style="margin: 0; font-size: 18px; font-weight: 700;">${eventDateJa}</p>
        </div>

        <p style="margin-top: 20px;"><strong>■ お願い</strong><br />
        カレンダーやブックマークに以前のURLを登録されている場合は、お手数ですが上記の新しいURLへの変更をお願いいたします。</p>

        <p style="margin-top: 12px;">当日の朝にも、あらためてご案内のメールをお送りいたします。</p>

        <p style="margin-top: 20px;">ご不便をおかけしまして申し訳ございません。<br />
        当日お会いできるのを楽しみにしております。</p>

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

/**
 * 通知先メールアドレスを解決する。
 * 環境変数 ADMIN_NOTIFY_EMAIL（カンマ区切りで複数指定可）を優先し、
 * 未設定の場合は info@local-creation.com にフォールバックする。
 * → 宛先の変更・追加をコード修正なしで行える。
 */
export function resolveAdminNotifyEmails(): string[] {
  const raw = (process.env.ADMIN_NOTIFY_EMAIL || '').trim();
  const fallback = 'info@local-creation.com';
  if (!raw) return [fallback];
  const list = raw
    .split(',')
    .map(s => s.trim())
    .filter(s => s.includes('@'));
  return list.length > 0 ? list : [fallback];
}

/** JSTの「YYYY年M月D日(曜) HH:MM」表記を返す */
function formatJstDateTime(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d).reduce((a, p) => {
    if (p.type !== 'literal') a[p.type] = p.value;
    return a;
  }, {} as Record<string, string>);
  const wd = ['日', '月', '火', '水', '木', '金', '土'][
    new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))).getUTCDay()
  ];
  return `${Number(parts.year)}年${Number(parts.month)}月${Number(parts.day)}日(${wd}) ${parts.hour}:${parts.minute}`;
}

export interface PartnerSessionNotifyInfo {
  name: string;
  email: string;
  company?: string | null;
  profession?: string | null;
  programInterest?: string | null;
  /** 第1希望（日本語整形済み。例: 2026/8/25（月）14:00） */
  preferredSlot1?: string | null;
  /** 第2希望（同上） */
  preferredSlot2?: string | null;
  message?: string | null;
  registrationId?: string | null;
}

const PROGRAM_INTEREST_LABELS: Record<string, string> = {
  partner: '紹介パートナー',
  advisor: 'アドバイザー養成講座',
  supporter: 'プロジェクトサポーター',
  all: 'すべて聞いてから決めたい',
};

/**
 * 個別説明会（1対1）の新規申込を運営に通知するメール。
 * 申込者への確認メールとは別に送る（運営の対応漏れ防止）。
 */
export async function sendPartnerSessionAdminNotification(
  info: PartnerSessionNotifyInfo
): Promise<EmailResult> {
  const to = resolveAdminNotifyEmails();
  const appliedAt = formatJstDateTime();
  const slot1 = info.preferredSlot1?.trim() || '（未入力）';
  const slot2 = info.preferredSlot2?.trim() || '（未入力）';
  const programLabel = info.programInterest
    ? (PROGRAM_INTEREST_LABELS[info.programInterest] || info.programInterest)
    : '（未選択）';

  const subject = `【個別説明会】新規申込：${info.name}様（第1希望 ${slot1}）`;

  const row = (label: string, value: string) => `
    <tr>
      <th style="text-align:left; padding:8px 12px; background:#F4F6FA; border:1px solid #E3E8F0; font-size:13px; color:#0B1D3A; white-space:nowrap; vertical-align:top;">${label}</th>
      <td style="padding:8px 12px; border:1px solid #E3E8F0; font-size:14px;">${value || '（未入力）'}</td>
    </tr>`;

  const html = `
    <div style="font-family: 'Noto Sans JP', sans-serif; max-width: 640px; margin: 0 auto; padding: 20px;">
      <div style="background: #0B1D3A; color: #fff; padding: 18px 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 19px;">🤝 個別説明会 新規申込</h1>
        <p style="margin: 4px 0 0; font-size: 13px; color: #D4AF37;">申込日時: ${appliedAt}（JST）</p>
      </div>
      <div style="background: #fff; padding: 20px; border: 1px solid #eee; border-top: none;">
        <div style="margin-bottom: 16px; padding: 14px 16px; background: #FFFBF0; border: 1px solid #E6D9A8; border-radius: 8px;">
          <p style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: #8A6D1F;">📅 ご希望日時</p>
          <p style="margin: 0; font-size: 15px;"><strong>第1希望:</strong> ${slot1}</p>
          <p style="margin: 2px 0 0; font-size: 15px;"><strong>第2希望:</strong> ${slot2}</p>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          ${row('お名前', info.name)}
          ${row('メールアドレス', `<a href="mailto:${info.email}" style="color:#1A73E8;">${info.email}</a>`)}
          ${row('会社・団体名', info.company || '')}
          ${row('職業・専門分野', info.profession || '')}
          ${row('興味のあるプログラム', programLabel)}
          ${row('質問・メッセージ', (info.message || '').replace(/\n/g, '<br />'))}
        </table>
        <p style="margin: 18px 0 0;">
          <a href="https://kamo-funding-app.vercel.app/admin"
             style="display:inline-block; background:#0B1D3A; color:#fff; padding:12px 24px; border-radius:6px; font-weight:700; font-size:14px; text-decoration:none;">
            管理画面で確認する →
          </a>
        </p>
        <p style="margin: 14px 0 0; font-size: 12px; color: #999;">
          日程調整のご連絡をお願いします。${info.registrationId ? `<br />申込ID: ${info.registrationId}` : ''}
        </p>
      </div>
    </div>
  `;

  // 複数宛先に対応（Resend は to に配列を渡せる）
  return sendEmail(to.length === 1 ? to[0] : to, subject, html);
}
