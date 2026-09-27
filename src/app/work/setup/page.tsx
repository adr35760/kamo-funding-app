'use client';

import { useCallback, useEffect, useState } from 'react';
import '../work.css';

/**
 * /work/setup — チャットワークの初回設定（ルームID登録）
 *
 * 🔴 なぜ `/work/admin` の中ではなく独立した画面なのか:
 *   `/work` のログインは「個人チャットにリンクを送る」方式なので、
 *   `chatwork_room_id` が未登録だと**誰一人ログインできない**。
 *   登録画面がログインの内側にあると永久に設定できない（鶏と卵）。
 *   この画面だけは**既存 `/admin` の管理者認証**でも入れるようにしている。
 *
 * 🔴 room_id を手で探させない。`GET /rooms` の候補をプルダウンで選ばせる。
 *   トークン未設定の間は候補が出ないので、手入力欄も残す。
 */

interface SetupUser {
  id: string;
  name: string;
  role: string;
  chatwork_room_id: string | null;
  is_active: boolean;
}

interface Room {
  room_id: number;
  name: string;
  type: string;
}

export default function WorkSetupPage() {
  const [users, setUsers] = useState<SetupUser[]>([]);
  const [groupRoomId, setGroupRoomId] = useState('');
  const [chatworkConfigured, setChatworkConfigured] = useState(false);
  const [direct, setDirect] = useState<Room[]>([]);
  const [groups, setGroups] = useState<Room[]>([]);
  /**
   * 🔴 候補が空になる経路を画面が区別するための状態（2026-09-27）。
   *   'ok' 取得できた / 'not_configured' トークン未設定 /
   *   'api_error' トークン無効・権限不足 / 'no_direct' 誰もコンタクト未接続
   */
  const [roomsState, setRoomsState] = useState<'loading' | 'ok' | 'not_configured' | 'api_error' | 'no_direct'>('loading');
  const [roomsMessage, setRoomsMessage] = useState('');
  const [settingsMissing, setSettingsMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/work/settings', { cache: 'no-store' });
      if (res.status === 401 || res.status === 403) {
        setError(
          '設定画面を開く権限がありません。既存の管理画面（/admin）にログインしてから、もう一度開いてください。'
        );
        setLoading(false);
        return;
      }
      const data = await res.json().catch(() => ({}));
      setUsers(Array.isArray(data.users) ? data.users : []);
      setGroupRoomId(data.group_room_id ?? '');
      setChatworkConfigured(!!data.chatwork_configured);
      // 第2段SQL未実行だと settings が読めない
      setSettingsMissing(data.settings_error === 'PGRST205' || data.settings_error === '42P01');

      // ルーム候補。🔴 失敗の種類を画面が名指しできるよう状態を分ける
      const roomsRes = await fetch('/api/work/chatwork-rooms', { cache: 'no-store' });
      const roomsData = await roomsRes.json().catch(() => ({}));
      setDirect(Array.isArray(roomsData.direct) ? roomsData.direct : []);
      setGroups(Array.isArray(roomsData.groups) ? roomsData.groups : []);
      setRoomsMessage(roomsData.error || roomsData.note || '');
      if (!roomsData.success) {
        setRoomsState(roomsData.reason === 'not_configured' ? 'not_configured' : 'api_error');
      } else if (roomsData.no_direct_rooms) {
        setRoomsState('no_direct');
      } else {
        setRoomsState('ok');
      }
    } catch {
      setError('設定を取得できませんでした。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * 🔴 保存の失敗は**その行に返す**（2026-09-27）。
   *   画面上部の setError だとスクロール位置によって見落とされる。
   *   成功/失敗の文言を戻り値で返し、呼び出し側の行が自分の直下に出す。
   */
  const saveUserRoom = async (user: SetupUser, roomId: string): Promise<string | null> => {
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/work/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, chatwork_room_id: roomId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return data.error || `保存に失敗しました（HTTP ${res.status}）`;
      }
      setNotice(`${user.name} さんの個人チャットを保存しました。`);
      await load();
      return null;
    } catch {
      return '通信に失敗しました。電波の良い場所でもう一度お試しください。';
    }
  };

  const saveGroup = async () => {
    setError('');
    setNotice('');
    const res = await fetch('/api/work/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_room_id: groupRoomId || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      setError(data.error || `保存に失敗しました（HTTP ${res.status}）`);
      return;
    }
    setNotice('通知用グループを保存しました。');
    await load();
  };

  const unset = users.filter(u => u.is_active && !u.chatwork_room_id);

  return (
    <div className="work-body">
      <div className="work-header">
        <h1>業務管理 初回設定</h1>
        <a href="/work/login">ログイン画面</a>
      </div>

      <div className="work-shell">
        {notice ? (
          <div className="work-card" style={{ borderLeft: '5px solid #1f7a3d', color: '#1f7a3d', fontWeight: 700 }}>
            {notice}
          </div>
        ) : null}
        {error ? <div className="work-error">{error}</div> : null}

        <div className="work-card">
          <h2>この画面でやること</h2>
          <p className="work-note">
            業務管理システムのログインは、<strong>チャットワークの個人チャット（1対1）に届くリンク</strong>
            で行います。そのため、各メンバーの個人チャットのルームIDを登録しないと
            <strong>誰もログインできません</strong>。ここで登録してください。
          </p>
          {/* 🔴 候補が取れない理由を必ず名指しする（2026-09-27）。
                「入力欄が出ているだけ」で原因が分からない状態を作らない。 */}
          {roomsState === 'not_configured' ? (
            <div className="work-devlink">
              <strong>チャットワークのAPIトークンが設定されていません</strong>
              <p style={{ margin: '6px 0 0' }}>
                設定すると、下の欄が<strong>名前つきの候補</strong>から選べるようになります。
                未設定の間はURLを貼り付けるか数字を入力してください。
              </p>
            </div>
          ) : null}

          {roomsState === 'api_error' ? (
            <div className="work-error" style={{ marginTop: 12 }}>
              <strong>チャットワークに接続できませんでした</strong>
              <p style={{ margin: '6px 0 0' }}>{roomsMessage}</p>
            </div>
          ) : null}

          {roomsState === 'no_direct' ? (
            <div className="work-error" style={{ marginTop: 12 }}>
              <strong>業務Botとつながっている人がいません</strong>
              <p style={{ margin: '6px 0 0' }}>
                {roomsMessage ||
                  '各メンバーに、業務Botからのコンタクト申請を承認してもらってください。承認が済むと個人チャットができ、ここに名前が出ます。'}
              </p>
            </div>
          ) : null}

          {settingsMissing ? (
            <div className="work-error" style={{ marginTop: 12 }}>
              <strong>第2段のマイグレーションSQLが未実行です</strong>
              <p style={{ margin: '6px 0 0' }}>
                通知用グループの保存先テーブルがまだありません。
                <code>migration-work-sprint2-...</code> を実行してください。
                <strong>個人チャットの登録（下の1番）は先に進められます。</strong>
              </p>
            </div>
          ) : null}

          {/* 🔴 取得できた個人チャットをそのまま出す。
                「候補が空なのかすら分からない」状態を作らない。 */}
          {roomsState === 'ok' ? (
            <div style={{ marginTop: 12 }}>
              <p className="work-note" style={{ fontWeight: 700, color: '#1f7a3d' }}>
                業務Botから見える個人チャット {direct.length} 件
              </p>
              <div className="work-scroll">
                <table className="work-table">
                  <thead>
                    <tr>
                      <th>相手の名前</th>
                      <th>ルームID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {direct.map(r => (
                      <tr key={r.room_id}>
                        <td>{r.name}</td>
                        <td style={{ fontFamily: 'monospace' }}>{r.room_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {groups.length > 0 ? (
                <p className="work-note">グループ {groups.length} 件も取得できています。</p>
              ) : null}
            </div>
          ) : null}
          {unset.length > 0 ? (
            <div className="work-error" style={{ marginTop: 12 }}>
              未登録の人が {unset.length} 名います（{unset.map(u => u.name).join('・')}）。
              この方々はログインできません。
            </div>
          ) : users.length > 0 ? (
            <p className="work-note" style={{ color: '#1f7a3d', fontWeight: 700 }}>
              全員分の個人チャットが登録されています。
            </p>
          ) : null}
        </div>

        {/* ---- 個人チャット（ログインリンクの送信先）---- */}
        <div className="work-card">
          <h2>1. 各メンバーの個人チャット</h2>
          <p className="work-note">
            🔴 ここは<strong>必ず個人チャット（1対1）</strong>を選んでください。
            通知用グループを入れると、グループを見られる全員がその人になりすまして
            ログインできてしまいます。
          </p>
          {loading ? (
            <p className="work-note">読み込み中...</p>
          ) : users.length === 0 ? (
            <p className="work-note">利用者が取得できませんでした。</p>
          ) : (
            users
              .filter(u => u.is_active)
              .map(u => (
                <RoomPicker
                  key={u.id}
                  user={u}
                  rooms={direct}
                  roomsState={roomsState}
                  onSave={saveUserRoom}
                />
              ))
          )}
        </div>

        {/* ---- 通知用グループ ---- */}
        <div className="work-card">
          <h2>2. 通知用グループ</h2>
          <p className="work-note">
            新しい指示・期限・日報の通知を流すグループです。
            <strong>ログインリンクはここには送りません</strong>（経路を分けています）。
          </p>
          <div className="work-field">
            <label>通知用グループのルームID</label>
            {groups.length > 0 ? (
              <select value={groupRoomId} onChange={e => setGroupRoomId(e.target.value)}>
                <option value="">選択してください</option>
                {groups.map(g => (
                  <option key={g.room_id} value={String(g.room_id)}>
                    {g.name}（{g.room_id}）
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                inputMode="numeric"
                value={groupRoomId}
                onChange={e => setGroupRoomId(e.target.value)}
                placeholder="例: 123456789"
              />
            )}
          </div>
          <button className="work-btn work-btn-accept" onClick={saveGroup}>
            通知用グループを保存
          </button>
          <p className="work-note">
            未設定でも業務は回ります（通知が出ないだけです）。
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * 1人分の個人チャット選択。
 * 🔴 保存の失敗は**このボタンの直下**に出す（画面上部だと見落とされる）。
 * 🔴 候補にこの人の名前が見当たらないときは、その行で名指しして伝える。
 */
function RoomPicker({
  user,
  rooms,
  roomsState,
  onSave,
}: {
  user: SetupUser;
  rooms: Room[];
  roomsState: string;
  onSave: (u: SetupUser, roomId: string) => Promise<string | null>;
}) {
  const [value, setValue] = useState(user.chatwork_room_id ?? '');
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState('');
  const [rowOk, setRowOk] = useState('');

  const save = async () => {
    setSaving(true);
    setRowError('');
    setRowOk('');
    try {
      const err = await onSave(user, value);
      if (err) setRowError(err);
      else setRowOk('保存しました。');
    } finally {
      setSaving(false);
    }
  };

  /**
   * 候補は取れているのに、この人の名前が一覧に無い
   *  = その人だけ業務Botとコンタクト接続が済んでいない。
   * 名前の一致は緩く見る（チャットワークの表示名は姓名の区切りが違うことがある）。
   */
  const nameInRooms =
    roomsState !== 'ok'
      ? true
      : rooms.some(r => {
          const rn = r.name.replace(/[\s\u3000]/g, '');
          const un = user.name.replace(/[\s\u3000]/g, '');
          return rn.includes(un) || un.includes(rn);
        });

  return (
    <div className="work-field" style={{ borderTop: '1px solid #eee', paddingTop: 12 }}>
      <label>
        {user.name}（{user.role === 'admin' ? '管理者' : 'メンバー'}）
        {user.chatwork_room_id ? (
          <span style={{ color: '#1f7a3d', marginLeft: 8 }}>登録済み（{user.chatwork_room_id}）</span>
        ) : (
          <span style={{ color: '#b81414', marginLeft: 8 }}>未登録</span>
        )}
      </label>

      {!nameInRooms ? (
        <p className="work-note" style={{ color: '#8a6100', fontWeight: 700, margin: '0 0 6px' }}>
          この方はまだ業務Botとつながっていません（候補一覧に名前がありません）。
          コンタクト申請の承認をお願いしてください。
        </p>
      ) : null}

      <div className="work-row" style={{ alignItems: 'flex-end' }}>
        {rooms.length > 0 ? (
          <select value={value} onChange={e => setValue(e.target.value)}>
            <option value="">選択してください</option>
            {rooms.map(r => (
              <option key={r.room_id} value={String(r.room_id)}>
                {r.name}（{r.room_id}）
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="URLごと貼り付けてもOK（#!rid123456789）"
          />
        )}
        <button
          className="work-btn work-btn-ghost"
          style={{ flex: '0 0 auto', minWidth: 100 }}
          onClick={save}
          disabled={saving}
        >
          {saving ? '保存中' : '保存'}
        </button>
      </div>

      {/* 🔴 結果はボタンの直下に出す */}
      {rowError ? (
        <div className="work-error" style={{ marginTop: 8 }}>
          {rowError}
        </div>
      ) : null}
      {rowOk ? (
        <p className="work-note" style={{ color: '#1f7a3d', fontWeight: 700, marginTop: 6 }}>
          {rowOk}
        </p>
      ) : null}
    </div>
  );
}
