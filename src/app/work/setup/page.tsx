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
  const [roomsNote, setRoomsNote] = useState('');
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

      // ルーム候補（トークン未設定なら空で返る）
      const roomsRes = await fetch('/api/work/chatwork-rooms', { cache: 'no-store' });
      const roomsData = await roomsRes.json().catch(() => ({}));
      setDirect(Array.isArray(roomsData.direct) ? roomsData.direct : []);
      setGroups(Array.isArray(roomsData.groups) ? roomsData.groups : []);
      if (!roomsData.success) setRoomsNote(roomsData.error || '');
      else setRoomsNote('');
    } catch {
      setError('設定を取得できませんでした。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveUserRoom = async (user: SetupUser, roomId: string) => {
    setError('');
    setNotice('');
    const res = await fetch('/api/work/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, chatwork_room_id: roomId || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      setError(data.error || '保存に失敗しました');
      return;
    }
    setNotice(`${user.name} さんの個人チャットを保存しました。`);
    await load();
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
      setError(data.error || '保存に失敗しました');
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
          {!chatworkConfigured ? (
            <div className="work-devlink">
              <strong>CHATWORK_API_TOKEN が未設定です</strong>
              <p style={{ margin: '6px 0 0' }}>
                設定すると、下の欄がチャットワークから取得した<strong>名前つきの候補</strong>から
                選べるようになります。未設定の間は数字を手入力してください
                （個人チャットを開いたときのURL末尾 <code>#!rid●●●●</code> の数字）。
              </p>
            </div>
          ) : null}
          {roomsNote ? <p className="work-note">※ {roomsNote}</p> : null}
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

/** 1人分の個人チャット選択。候補があればプルダウン、無ければ手入力 */
function RoomPicker({
  user,
  rooms,
  onSave,
}: {
  user: SetupUser;
  rooms: Room[];
  onSave: (u: SetupUser, roomId: string) => Promise<void>;
}) {
  const [value, setValue] = useState(user.chatwork_room_id ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(user, value);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="work-field" style={{ borderTop: '1px solid #eee', paddingTop: 12 }}>
      <label>
        {user.name}（{user.role === 'admin' ? '管理者' : 'メンバー'}）
        {user.chatwork_room_id ? (
          <span style={{ color: '#1f7a3d', marginLeft: 8 }}>登録済み</span>
        ) : (
          <span style={{ color: '#b81414', marginLeft: 8 }}>未登録</span>
        )}
      </label>
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
            inputMode="numeric"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="個人チャットのルームID（数字）"
          />
        )}
        <button
          className="work-btn work-btn-ghost"
          style={{ flex: '0 0 auto', minWidth: 100 }}
          onClick={save}
          disabled={saving || value === (user.chatwork_room_id ?? '')}
        >
          {saving ? '保存中' : '保存'}
        </button>
      </div>
    </div>
  );
}
