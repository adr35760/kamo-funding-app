import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { isValidEmail, normalizeEmail } from '@/lib/email-address';

/**
 * POST /api/survey
 *
 * 掲載説明会後アンケートの回答を保存する（公開・認証なし）。
 *
 * 保存先: survey_responses（supabase/【アンケート】survey_responses_これを実行してください.sql）
 *  - 回答は匿名でも成立させる（name / email は null 可）。
 *  - name / email は「個別ミーティングを希望＝はい」のときだけ画面で入力を促すが、
 *    **サーバーとしては任意**（未入力でも保存する）。
 *  - 自由記述（comment）は現在UIに出していないが、列は残してあるため受け口も用意する
 *    （将来7問目として戻すとき、APIの変更だけで済むように）。
 *
 * 読み取りAPIは用意しない（集計は /api/admin/survey 経由＝service role）。
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LISTING_INTENTS = ['yes', 'considering', 'no'] as const;

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function toIntInRange(v: unknown, min: number, max: number): number | null {
  if (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max) return v;
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) {
    const n = Number(v.trim());
    if (n >= min && n <= max) return n;
  }
  return null;
}

function toBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return null;
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bad('リクエストの形式が正しくありません');
  }

  // ---- イベントID（必須） ----
  const eventId = typeof body.event_id === 'string' ? body.event_id.trim() : '';
  if (!UUID_RE.test(eventId)) {
    return bad('対象の説明会が特定できませんでした。お手数ですが配布メールのリンクから開き直してください');
  }

  // ---- 設問1・2（5段階・必須） ----
  const satisfaction = toIntInRange(body.satisfaction, 1, 5);
  if (satisfaction === null) return bad('設問1「本日の説明会の満足度」を選択してください');
  const clarity = toIntInRange(body.clarity, 1, 5);
  if (clarity === null) return bad('設問2「説明は分かりやすかったか」を選択してください');

  // ---- 設問3（はい／検討中／いいえ・必須） ----
  const listingIntent = typeof body.listing_intent === 'string' ? body.listing_intent.trim() : '';
  if (!LISTING_INTENTS.includes(listingIntent as (typeof LISTING_INTENTS)[number])) {
    return bad('設問3「掲載を検討したいか」を選択してください');
  }

  // ---- 設問4・5・6（はい／いいえ・必須） ----
  const wantsMeeting = toBool(body.wants_meeting);
  if (wantsMeeting === null) return bad('設問4「生島との個別ミーティングを希望するか」を選択してください');
  const wantsSeminar = toBool(body.wants_seminar);
  if (wantsSeminar === null) return bad('設問5「オンライン・リアルセミナーは参加したいですか？」を選択してください');
  const interestedAdvisor = toBool(body.interested_advisor);
  if (interestedAdvisor === null) return bad('設問6「クラファンのアドバイザー及び紹介報酬制度は興味ありますか？」を選択してください');

  // ---- 任意項目（name / email / comment） ----
  const nameRaw = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : '';
  let email: string | null = null;
  if (typeof body.email === 'string' && body.email.trim() !== '') {
    const normalized = normalizeEmail(body.email);
    // 個別ミーティング希望者は連絡先として使うため、形式不正は受付時に直してもらう
    if (!isValidEmail(normalized)) {
      return bad(
        'メールアドレスの形式が正しくありません。半角英数字で example@gmail.com の形で入力してください'
      );
    }
    email = normalized;
  }
  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 4000) : '';

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('survey_responses').insert({
      event_id: eventId,
      satisfaction,
      clarity,
      listing_intent: listingIntent,
      wants_meeting: wantsMeeting,
      wants_seminar: wantsSeminar,
      interested_advisor: interestedAdvisor,
      // 列は残してあるが、現在のUIでは収集しないため通常は null
      comment: comment || null,
      name: nameRaw || null,
      email,
    });

    if (error) {
      if (isMissingTable(error)) {
        // マイグレーション未実行。回答者を技術的な文言で不安にさせない。
        console.error('survey_responses テーブルが未作成のため回答を保存できません');
        return NextResponse.json(
          {
            ok: false,
            needsMigration: true,
            error: 'ただいま回答を保存できません。お手数ですが時間をおいて再度お試しください。',
          },
          { status: 503 }
        );
      }
      console.error('survey_responses insert failed:', error.message);
      return NextResponse.json(
        { ok: false, error: '回答の保存に失敗しました。時間をおいて再度お試しください。' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // getSupabaseAdmin() は環境変数が無いとクエリ前に例外を投げる（既知の落とし穴）
    console.error('survey POST error:', err);
    return NextResponse.json(
      { ok: false, error: '回答の保存に失敗しました。時間をおいて再度お試しください。' },
      { status: 500 }
    );
  }
}

function isMissingTable(error: { code?: string; message?: string }): boolean {
  const msg = error.message || '';
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    (/survey_responses/.test(msg) && /could not find the table|does not exist/i.test(msg))
  );
}

export const dynamic = 'force-dynamic';
