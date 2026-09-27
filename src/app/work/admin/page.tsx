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

interface Dashboard {
  date: string;
  // 🔴 null = 読めなかった（0件ではない）。画面は「—」を出す
  summary: {
    unaccepted: number;
    in_progress: number;
    overdue: number;
    done_today: number;
    unconfirmed: number;
  } | null;
  readable?: { tasks: boolean; reports: boolean };
  per_user: Array<{
    id: string;
    name: string;
    role: string;
    open: number;
    overdue: number;
    done_today: number;
    report_submitted: boolean | null;
  }>;
  today_reports: Array<{
    id: string;
    user_name: string;
    submitted_at: string | null;
    read_at: string | null;
    comment: string | null;
    blockers: string | null;
    tomorrow: string | null;
  }> | null;
  report_not_submitted: Array<{ id: string; name: string }> | null;
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
  const [dash, setDash] = useState<Dashboard | null>(null);
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
      const [meRes, userRes, catRes, taskRes, dashRes] = await Promise.all([
        fetch('/api/work/me', { cache: 'no-store' }),
        fetch('/api/work/users', { cache: 'no-store' }),
        fetch('/api/work/categories', { cache: 'no-store' }),
        fetch(`/api/work/tasks?scope=${nextScope}`, { cache: 'no-store' }),
        fetch('/api/work/dashboard', { cache: 'no-store' }),
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

      const dashData = await dashRes.json().catch(() => ({}));
      if (dashData.success) setDash(dashData);
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
      // 🔴 通知が飛ばなくても作成は成功。画面もそう見せる
      setNotice(
        data.notified
          ? `「${data.task.title}」を登録し、通知を送りました。`
          : `「${data.task.title}」を登録しました。（チャットワーク通知は未設定のため送られていません。登録は完了しています）`
      );
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

  const markRead = async (reportId: string) => {
    await fetch('/api/work/dashboard', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_id: reportId }),
    }).catch(() => {});
    await load(scope);
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
          <a href="/work">やること</a>
          <a href="/work/setup">設定</a>
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

        {/* ---- 0. ダッシュボード ---- */}
        {dash ? (
          <div className="work-card">
            <h2>今日の状況（{dash.date}）</h2>
            {dash.summary ? (
              <div className="work-stats">
                <Stat label="未受領" value={dash.summary.unaccepted} />
                <Stat label="対応中" value={dash.summary.in_progress} />
                <Stat label="遅延" value={dash.summary.overdue} danger={dash.summary.overdue > 0} />
                <Stat label="本日完了" value={dash.summary.done_today} good />
                <Stat
                  label="未確認の完了"
                  value={dash.summary.unconfirmed}
                  warn={dash.summary.unconfirmed > 0}
                />
              </div>
            ) : (
              /* 🔴 0件と読めなかったことを区別する。数字を出さない */
              <div className="work-error">
                タスクの集計を取得できませんでした。件数は表示していません（0件ではありません）。
                マイグレーションが未実行か、データベースに接続できていない可能性があります。
              </div>
            )}

            <h2 style={{ marginTop: 18 }}>人別の状況</h2>
            <div className="work-scroll">
              <table className="work-table">
                <thead>
                  <tr>
                    <th>名前</th>
                    <th>抱え</th>
                    <th>遅延</th>
                    <th>本日完了</th>
                    <th>日報</th>
                  </tr>
                </thead>
                <tbody>
                  {dash.per_user.map(u => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.open}</td>
                      <td style={{ color: u.overdue > 0 ? '#b81414' : undefined, fontWeight: u.overdue > 0 ? 700 : 400 }}>
                        {u.overdue}
                      </td>
                      <td>{u.done_today}</td>
                      <td>
                        {u.role === 'admin' || u.report_submitted === null ? (
                          <span style={{ color: '#999' }}>—</span>
                        ) : u.report_submitted ? (
                          <span style={{ color: '#1f7a3d', fontWeight: 700 }}>提出済</span>
                        ) : (
                          <span style={{ color: '#b81414' }}>未提出</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 style={{ marginTop: 18 }}>
              今日の日報
              {dash.today_reports
                ? `（${dash.today_reports.length}件${
                    dash.report_not_submitted && dash.report_not_submitted.length > 0
                      ? ` / 未提出 ${dash.report_not_submitted.length}名`
                      : ''
                  }）`
                : ''}
            </h2>
            {!dash.today_reports ? (
              <p className="work-note">
                日報を取得できませんでした（0件ではありません）。第2段のマイグレーションが
                未実行の可能性があります。
              </p>
            ) : dash.today_reports.length === 0 ? (
              <p className="work-note">まだ提出がありません。</p>
            ) : (
              dash.today_reports.map(r => (
                <div
                  key={r.id}
                  className="work-task"
                  style={{ borderLeftColor: r.read_at ? '#d9dde3' : '#e6a700' }}
                >
                  <p className="work-task-title">
                    {r.user_name}
                    {!r.read_at ? (
                      <span className="work-chip due-today" style={{ marginLeft: 8 }}>未読</span>
                    ) : null}
                  </p>
                  {r.comment ? <p className="work-task-body">所感: {r.comment}</p> : null}
                  {r.blockers ? (
                    <p className="work-task-body" style={{ color: '#b81414' }}>
                      困っていること: {r.blockers}
                    </p>
                  ) : null}
                  {r.tomorrow ? <p className="work-task-body">明日: {r.tomorrow}</p> : null}
                  {!r.read_at ? (
                    <div className="work-actions">
                      <button className="work-btn work-btn-ghost" onClick={() => markRead(r.id)}>
                        既読にする
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        ) : null}

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

        {/* ---- 3. 設定への案内（room_id登録は /work/setup に移した）---- */}
        <div className="work-card">
          <h2>チャットワークの設定</h2>
          <p className="work-note">
            個人チャットのルームIDと通知用グループの登録は
            <a href="/work/setup" style={{ fontWeight: 700 }}> 初回設定の画面 </a>
            に移しました。ログインできない人がいる場合は、まずそちらで個人チャットが
            登録されているか確認してください。
          </p>
        </div>

      </div>
    </div>
  );
}

/** ダッシュボードの数値1つ */
function Stat({
  label,
  value,
  danger,
  warn,
  good,
}: {
  label: string;
  value: number;
  danger?: boolean;
  warn?: boolean;
  good?: boolean;
}) {
  const color = danger ? '#b81414' : warn ? '#8a6100' : good ? '#1f7a3d' : '#12284b';
  return (
    <div className="work-stat">
      <span className="work-stat-label">{label}</span>
      <span className="work-stat-value" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
