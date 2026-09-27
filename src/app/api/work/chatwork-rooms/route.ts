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
    return NextResponse.json(
      {
        success: false,
        reason: 'api_error',
        error: 'チャットワークからルーム一覧を取得できませんでした。',
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

  return NextResponse.json(
    { success: true, direct, groups },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export const dynamic = 'force-dynamic';
