import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  createLoginToken,
  isWorkAuthConfigured,
  WORK_LOGIN_TOKEN_TTL_SECONDS,
} from '@/lib/work-auth';
import { buildLoginMessage, isChatworkConfigured, sendChatworkMessage } from '@/lib/chatwork';

/**
 * POST /api/work/login-request — ログインリンクの発行
 *
 * Body: { user_id: string }
 *
 * 名前を選ぶとここに来る。ワンタイムトークンを作り、
 * **その人のチャットワーク個人チャット（1対1）**にログインURLを送る。
 *
 * 🔴 このAPIは**ログインの入口なので認証を通さない**（middleware で除外している）。
 *   そのため、ここから漏れてよい情報は一切返さない:
 *     - 送信先のルームIDやメールアドレスは返さない
 *     - 存在しない user_id でも同じ応答にする（利用者の存在を探れないようにする）
 *     - 🔴 発行したURLは、**CHATWORK_API_TOKEN 未設定のときだけ**返す（下記）
 *
 * 🔴 開発用の逃げ道（第2段で必ず削除する）:
 *   `CHATWORK_API_TOKEN` が未設定の間は送信できないので、発行したURLを応答に含める。
 *   t iku がトークンを設定したら**この分岐は自動的に無効になる**（送信経路に切り替わる）。
 *   第2段で `devLoginUrl` を返すコードごと削除すること。
 *   本番でトークン設定後にこの経路が生きることはないが、設定前の期間は
 *   **URLを知れば誰でもログインできる状態**なので、第1段の検収が済んだら
 *   速やかにトークンを設定してもらう。
 */
export async function POST(request: NextRequest) {
  // 署名鍵が無い状態でログインを通すと、誰でも偽のCookieを作れる。フェイルクローズ。
  if (!isWorkAuthConfigured()) {
    return NextResponse.json(
      { success: false, error: 'ログインは現在利用できません（サーバー設定が未完了です）' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  let userId = '';
  try {
    const body = await request.json();
    userId = typeof body?.user_id === 'string' ? body.user_id.trim() : '';
  } catch {
    userId = '';
  }

  // 応答は常に同じ形にする（存在しない利用者を探れないようにするため）
  const genericOk = (extra: Record<string, unknown> = {}) =>
    NextResponse.json(
      {
        success: true,
        message: 'ログインリンクをチャットワークの個人チャットに送信しました。',
        ...extra,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );

  if (!userId) return genericOk();

  try {
    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase
      .from('work_users')
      .select('id, name, role, chatwork_room_id, is_active')
      .eq('id', userId)
      .maybeSingle();

    if (error || !user || !user.is_active) return genericOk();

    const { token, tokenHash } = await createLoginToken();
    const expiresAt = new Date(Date.now() + WORK_LOGIN_TOKEN_TTL_SECONDS * 1000);

    // 🔴 平文ではなくハッシュを保存する
    const { error: insertError } = await supabase.from('work_login_tokens').insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    });
    if (insertError) {
      console.error('work/login-request insert error:', insertError.code);
      return NextResponse.json(
        { success: false, error: 'ログインリンクの発行に失敗しました' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const origin = request.nextUrl.origin;
    const loginUrl = `${origin}/work/login/verify?token=${token}`;
    const minutes = Math.round(WORK_LOGIN_TOKEN_TTL_SECONDS / 60);

    if (!isChatworkConfigured()) {
      // ---- 開発用の逃げ道。第2段で削除する（上のコメント参照） ----
      console.info('work/login-request: CHATWORK_API_TOKEN 未設定のため送信せずURLを返す');
      return genericOk({
        chatwork_configured: false,
        devLoginUrl: loginUrl,
        message:
          'チャットワークの設定が未完了のため送信していません。下のリンクからログインしてください（設定後はこの表示は出ません）。',
      });
    }

    const sent = await sendChatworkMessage(
      user.chatwork_room_id,
      buildLoginMessage(user.name, loginUrl, minutes)
    );

    if (!sent.ok) {
      // room_id 未登録は運用上よく起きるので、管理者が原因を分かる形で返す。
      // 🔴 ただしURLは返さない（送信できていないので、ここで返すと経路を迂回してしまう）
      /**
       * 🔴 ステータスの切り分け（2026-09-27 修正）:
       *   - room_id 未登録は**設定が足りていない**状態で、上流の障害ではない → 409
       *     （502だと「Chatworkが落ちている」と読めてしまい、運用側の調査が空振りする）
       *   - Chatwork API 自体の失敗は上流障害 → 502 のまま
       */
      const isNoRoom = sent.reason === 'no_room';
      const reason = isNoRoom
        ? 'あなたのチャットワーク個人チャットが未登録です。管理者に設定を依頼してください。'
        : 'チャットワークへの送信に失敗しました。管理者にお問い合わせください。';
      console.error('work/login-request chatwork send failed:', sent.reason, sent.error ?? '');
      return NextResponse.json(
        { success: false, error: reason, reason: sent.reason },
        { status: isNoRoom ? 409 : 502, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return genericOk({ chatwork_configured: true });
  } catch (err) {
    /**
     * 🔴 DBに触れないときは 503 を返す（2026-09-27）。
     *   `getSupabaseAdmin()` は環境変数が無いとクエリ前に例外を投げる。
     *   ここで「サーバーエラー」とだけ返すと、設定漏れなのか不具合なのか
     *   運用側が切り分けられない。ログインは業務の入口なので、
     *   **原因が分かる文言**にしておく（値そのものは出さない）。
     */
    const isConfigError =
      err instanceof Error && /environment variables are not configured/i.test(err.message);
    console.error('API /work/login-request error:', isConfigError ? 'supabase env not configured' : err);
    return NextResponse.json(
      {
        success: false,
        error: isConfigError
          ? 'ログインは現在利用できません（データベースの接続設定が未完了です）。管理者にお問い合わせください。'
          : 'サーバーエラーが発生しました',
      },
      { status: isConfigError ? 503 : 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export const dynamic = 'force-dynamic';
