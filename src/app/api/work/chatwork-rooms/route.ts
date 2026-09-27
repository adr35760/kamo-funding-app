import { NextRequest, NextResponse } from 'next/server';
import { listChatworkRooms } from '@/lib/chatwork';
import { requireWorkAdminOrSiteAdmin } from '@/lib/work-session';

/**
 * GET /api/work/chatwork-rooms — 業務Botから見えるルームの一覧
 *
 * ルームID登録UIのプルダウン用。**個人チャット（direct）とグループを分けて返す。**
 * 🔴 t iku に `#!rid●●●●` の数字を手で探させないためのAPI。ここが運用の詰まりどころ。
 *
 * 認証: 業務管理の admin、**または**既存 `/admin` の管理者セッション。
 *   初回設定時はまだ誰も /work にログインできないため（room_id が無いと
 *   ログインリンクが送れない = 鶏と卵）。詳細は work-session.ts を参照。
 */
export async function GET(request: NextRequest) {
  const auth = await requireWorkAdminOrSiteAdmin(request);
  if ('response' in auth) return auth.response;

  const result = await listChatworkRooms();

  if (!result.ok) {
    if (result.reason === 'not_configured') {
      // 🔴 500にしない。「トークン未設定」は設定手順の途中であって障害ではない。
      //   画面は「トークンを設定すると候補が出ます」と案内して手入力欄を残す。
      return NextResponse.json(
        {
          success: false,
          reason: 'not_configured',
          error: 'CHATWORK_API_TOKEN が未設定です。設定すると候補を自動取得できます。',
          direct: [],
          groups: [],
        },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    /**
     * 🔴 api_error は原因を名指しする（2026-09-27）。
     *   「取得できませんでした」だけだと、トークンが無効なのか権限不足なのか
     *   コンタクト未接続なのかが画面から分からず、往復が終わらない。
     *   Chatwork API のHTTPステータスで切り分ける。
     */
    const status = result.status;
    const message =
      status === 401
        ? 'チャットワークに接続できませんでした。APIトークンが正しくありません（401）。業務Botのトークンを再発行して設定し直してください。'
        : status === 403
          ? 'チャットワークに接続できましたが、権限が不足しています（403）。法人プランの場合、組織管理者による承認が必要なことがあります。'
          : status === 429
            ? 'チャットワークへのリクエストが多すぎます（429）。少し待ってから開き直してください。'
            : `チャットワークに接続できませんでした（HTTP ${status ?? '不明'}）。トークンが無効か、通信に失敗しています。`;
    return NextResponse.json(
      {
        success: false,
        reason: 'api_error',
        error: message,
        http_status: status ?? null,
        direct: [],
        groups: [],
      },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // type=direct が個人チャット（1対1）。ログインリンクの送信先はここから選ぶ。
  const direct = result.rooms
    .filter(r => r.type === 'direct')
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  const groups = result.rooms
    .filter(r => r.type === 'group')
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  /**
   * 🔴 成功したが個人チャットが0件 = **業務Botと誰もコンタクト接続していない**。
   *   このプロジェクト最大の関門なので、画面が名指しできるよう区別して返す
   *   （「候補が空」と「トークン未設定」「API失敗」を同じ見た目にしない）。
   */
  return NextResponse.json(
    {
      success: true,
      direct,
      groups,
      no_direct_rooms: direct.length === 0,
      note:
        direct.length === 0
          ? '業務Botとコンタクトがつながっている人がいません。各メンバーに業務Botからのコンタクト申請を承認してもらってください。承認が済むと個人チャットができ、ここに名前が出ます。'
          : null,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export const dynamic = 'force-dynamic';
