'use client';

import { useCallback, useEffect, useState } from 'react';
import '../work.css';
import WorkTaskCard, { tokyoTodayIso, type WorkTask } from '../WorkTaskList';

/**
 * /work/admin — 管理者（t iku）の画面。第1段の範囲は次の3つだけ。
 *   1. タスクを作る
 *   2. 全員のタスクを見る（未完了／完了報告の未確認／完了済み）
 *   3. 利用者のチャットワーク個人チャットID を登録する
 *
 * ダッシュボードの集計・日報・通知は第2段。ここには作らない。
 */

interface WorkUser {
  id: string;
  name: string;
  role: string;
  chatwork_room_id: string | null;
  email: string | null;
  is_active: boolean;
}

interface Category {
  id: number;
  name: string;
}

export default function WorkAdminPage() {
  const [me, setMe] = useState<{ id: string; name: string; role: string } | null>(null);
  const [users, setUsers] = useState<WorkUser[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [scope, setScope] = useState<'open' | 'unconfirmed' | 'done'>('open');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const todayIso = tokyoTodayIso();

  // 新規タスクのフォーム
  const [form, setForm] = useState({
    title: '',
    body: '',
    assignee_id: '',
    category_id: '',
    due_date: '',
    due_time: '',
    priority: 'mid',
  });

  const load = useCallback(async (nextScope: typeof scope) => {
    setError('');
    try {
      const [meRes, userRes, catRes, taskRes] = await Promise.all([
        fetch('/api/work/me', { cache: 'no-store' }),
        fetch('/api/work/users', { cache: 'no-store' }),
        fetch('/api/work/categories', { cache: 'no-store' }),
        fetch(`/api/work/tasks?scope=${nextScope}`, { cache: 'no-store' }),
      ]);

      if (meRes.status === 401) {
        window.location.href = '/work/login';
        return;
      }

      const meData = await meRes.json().catch(() => ({}));
      const userData = await userRes.json().catch(() => ({}));
      const catData = await catRes.json().catch(() => ({}));
      const taskData = await taskRes.json().catch(() => ({}));

      if (meData.success) setMe(meData.user);
      if (Array.isArray(userData.users)) setUsers(userData.users);
      if (Array.isArray(catData.categories)) setCategories(catData.categories);
      if (taskData.success) setTasks(Array.isArray(taskData.tasks) ? taskData.tasks : []);
      else if (taskData.error) setError(taskData.error);
    } catch {
      setError('通信に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(scope);
  }, [load, scope]);

  const createTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/work/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.error || 'タスクの作成に失敗しました');
        return;
      }
      setNotice(`「${data.task.title}」を登録しました。`);
      setForm({
        title: '',
        body: '',
        assignee_id: form.assignee_id, // 同じ人に続けて出すことが多いので担当は残す
        category_id: form.category_id,
        due_date: '',
        due_time: '',
        priority: 'mid',
      });
      await load(scope);
    } catch {
      setError('通信に失敗しました。');
    } finally {
      setCreating(false);
    }
  };

  const handleAction = async (
    taskId: string,
    action: 'accept' | 'done' | 'confirm' | 'reopen',
    comment?: string
  ) => {
    try {
      const res = await fetch(`/api/work/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.error || '更新に失敗しました');
        return;
      }
      await load(scope);
    } catch {
      setError('通信に失敗しました。');
    }
  };

  const saveRoomId = async (user: WorkUser, roomId: string) => {
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/work/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, chatwork_room_id: roomId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.error || '保存に失敗しました');
        return;
      }
      setNotice(`${user.name} さんの個人チャットIDを保存しました。`);
      await load(scope);
    } catch {
      setError('通信に失敗しました。');
    }
  };

  const logout = async () => {
    await fetch('/api/work/me', { method: 'DELETE' }).catch(() => {});
    window.location.href = '/work/login';
  };

  const userName = (id: string | null) => (id ? users.find(u => u.id === id)?.name : undefined);
  const categoryName = (id: number | null) =>
    id ? categories.find(c => c.id === id)?.name : undefined;
  const members = users.filter(u => u.is_active);

  return (
    <div className="work-body">
      <div className="work-header">
        <h1>業務管理（管理者）</h1>
        <span className="work-who">{me ? `${me.name} さん` : ''}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <a href="/work">やることリスト</a>
          <button onClick={logout}>ログアウト</button>
        </div>
      </div>

      <div className="work-shell">
        {notice ? (
          <div
            className="work-card"
            style={{ borderLeft: '5px solid #1f7a3d', color: '#1f7a3d', fontWeight: 700 }}
          >
            {notice}
          </div>
        ) : null}
        {error ? <div className="work-error">{error}</div> : null}

        {/* ---- 1. 指示を出す ---- */}
        <div className="work-card">
          <h2>指示を出す</h2>
          <form onSubmit={createTask}>
            <div className="work-field">
              <label>タイトル（必須）</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="例: 9/30 説明会の告知投稿（2回目）"
              />
            </div>
            <div className="work-field">
              <label>内容</label>
              <textarea
                value={form.body}
                onChange={e => setForm({ ...form, body: e.target.value })}
                placeholder="やってほしいことを具体的に。リンクや文面もここに貼れます。"
              />
            </div>
            <div className="work-row">
              <div className="work-field">
                <label>担当者</label>
                <select
                  value={form.assignee_id}
                  onChange={e => setForm({ ...form, assignee_id: e.target.value })}
                >
                  <option value="">未割当</option>
                  {members.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="work-field">
                <label>カテゴリ</label>
                <select
                  value={form.category_id}
                  onChange={e => setForm({ ...form, category_id: e.target.value })}
                >
                  <option value="">未分類</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="work-row">
              <div className="work-field">
                <label>期限（日付）</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={e => setForm({ ...form, due_date: e.target.value })}
                />
              </div>
              <div className="work-field">
                <label>時刻（任意）</label>
                <input
                  type="time"
                  value={form.due_time}
                  onChange={e => setForm({ ...form, due_time: e.target.value })}
                />
              </div>
              <div className="work-field">
                <label>重要度</label>
                <select
                  value={form.priority}
                  onChange={e => setForm({ ...form, priority: e.target.value })}
                >
                  <option value="high">高</option>
                  <option value="mid">中</option>
                  <option value="low">低</option>
                </select>
              </div>
            </div>
            <button className="work-btn work-btn-accept" type="submit" disabled={creating}>
              {creating ? '登録中...' : 'この内容で指示を出す'}
            </button>
            <p className="work-note">
              ※ 第1段では通知は飛びません（チャットワーク通知は第2段）。担当者は
              やることリストで確認します。
            </p>
          </form>
        </div>

        {/* ---- 2. タスクの状況 ---- */}
        <div className="work-card">
          <h2>タスクの状況</h2>
          <div className="work-tabs">
            <button
              className={'work-tab' + (scope === 'open' ? ' is-active' : '')}
              onClick={() => setScope('open')}
            >
              未完了
            </button>
            <button
              className={'work-tab' + (scope === 'unconfirmed' ? ' is-active' : '')}
              onClick={() => setScope('unconfirmed')}
            >
              未確認の完了報告
            </button>
            <button
              className={'work-tab' + (scope === 'done' ? ' is-active' : '')}
              onClick={() => setScope('done')}
            >
              完了済み
            </button>
          </div>
        </div>

        {loading ? (
          <div className="work-empty">読み込み中...</div>
        ) : tasks.length === 0 ? (
          <div className="work-empty">
            {scope === 'unconfirmed'
              ? '未確認の完了報告はありません。'
              : scope === 'open'
                ? '未完了のタスクはありません。'
                : '完了済みのタスクはありません。'}
          </div>
        ) : (
          tasks.map(t => (
            <WorkTaskCard
              key={t.id}
              task={t}
              todayIso={todayIso}
              categoryName={categoryName(t.category_id)}
              assigneeName={userName(t.assignee_id)}
              isAdmin
              isMine={t.assignee_id === me?.id}
              onAction={handleAction}
            />
          ))
        )}

        {/* ---- 3. 利用者のチャットワーク設定 ---- */}
        <div className="work-card">
          <h2>利用者のチャットワーク設定</h2>
          <p className="work-note">
            🔴 ここに入れるのは<strong>その人との個人チャット（1対1）のルームID</strong>です。
            通知用グループのIDを入れてはいけません（グループを見られる全員が、
            その人になりすましてログインできてしまいます）。
            ルームIDは個人チャットを開いたときのURL末尾 <code>#!rid●●●●</code> の数字です。
          </p>
          <div className="work-scroll">
            <table className="work-table">
              <thead>
                <tr>
                  <th>名前</th>
                  <th>役割</th>
                  <th>個人チャットID</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <RoomIdRow key={u.id} user={u} onSave={saveRoomId} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="work-note">
            未設定の人はログインリンクを受け取れません。
            <code>CHATWORK_API_TOKEN</code> が未設定の間は、ログイン画面に開発用リンクが
            表示されます（トークン設定後は表示されません）。
          </p>
        </div>
      </div>
    </div>
  );
}

/** 個人チャットIDの1行。入力中の値をその行だけで持つ */
function RoomIdRow({
  user,
  onSave,
}: {
  user: WorkUser;
  onSave: (user: WorkUser, roomId: string) => Promise<void>;
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
    <tr>
      <td>{user.name}</td>
      <td>{user.role === 'admin' ? '管理者' : 'メンバー'}</td>
      <td>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="未設定"
          style={{
            minHeight: 40,
            border: '1px solid #d9dde3',
            borderRadius: 6,
            padding: '8px 10px',
            fontSize: 14,
            width: 160,
          }}
        />
      </td>
      <td>
        <button
          className="work-btn work-btn-ghost"
          style={{ minWidth: 80, minHeight: 40 }}
          onClick={save}
          disabled={saving || value === (user.chatwork_room_id ?? '')}
        >
          {saving ? '保存中' : '保存'}
        </button>
      </td>
    </tr>
  );
}
