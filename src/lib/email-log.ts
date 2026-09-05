import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * メール送信の成否を email_logs に記録する。
 *
 * 設計の前提（重要）:
 *  - **記録の失敗が本体処理を絶対に壊さないこと。** 申込やリマインド送信は
 *    「記録できたか」とは無関係に成立させる。したがってこのモジュールの
 *    関数は例外を投げず、常に成否を boolean で返すだけにしている。
 *  - email_logs は schema-all.sql で定義済み（status: queued|sent|failed）。
 *    テーブルが無い環境でも黙って諦めるだけで、呼び出し側は影響を受けない。
 *
 * この記録が「メール未着の人を運営が見つける」唯一の手がかりになる。
 */

/** email_logs.template_type の許容値（CHECK制約に合わせる） */
export type EmailTemplateType = 'confirmation' | 'reminder' | 'pre_material' | 'survey';

/** テーブル未作成・列欠落を表すエラーコード */
function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  // 42P01: undefined_table / PGRST205: PostgREST がスキーマキャッシュに見つけられない
  return err.code === '42P01' || err.code === 'PGRST205';
}

/**
 * 1件のメール送信結果を記録する。
 * @returns 記録できたら true。できなくても呼び出し側は処理を続けてよい。
 */
export async function logEmailResult(params: {
  registrationId: string;
  templateType: EmailTemplateType;
  success: boolean;
  error?: string;
}): Promise<boolean> {
  const { registrationId, templateType, success, error } = params;
  try {
    const supabase = getSupabaseAdmin();
    const { error: insErr } = await supabase.from('email_logs').insert({
      registration_id: registrationId,
      template_type: templateType,
      status: success ? 'sent' : 'failed',
      // 長いプロバイダエラーで行が膨らまないよう切り詰める
      error_message: success ? null : (error ?? 'unknown error').slice(0, 500),
      sent_at: new Date().toISOString(),
    });
    if (insErr) {
      if (isMissingTable(insErr)) {
        console.warn('email_logs テーブルが未作成のため記録をスキップしました');
      } else {
        console.error('email_logs insert failed:', insErr.message);
      }
      return false;
    }
    return true;
  } catch (e) {
    // ここで投げると申込やcronが落ちるので必ず飲み込む
    console.error('email_logs 記録中の例外:', e);
    return false;
  }
}
