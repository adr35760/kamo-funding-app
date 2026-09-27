'use client';

import { useCallback, useEffect, useState } from 'react';
import './work.css';
import WorkTaskCard, { tokyoTodayIso, type WorkTask } from './WorkTaskList';

/**
 * /work — メンバーの「今日のやることリスト」。
 *
 * 既定の絞り込み: **自分の担当・未完了のみ・期限が近い順**（サーバー側でも同じ条件）。
 * 🔴 一覧から直接「受領」「完了」を押せる。詳細画面は作らない。
 * 🔴 スマホ前提の縦積み。375px幅で崩れないこと。
 */

interface Me {
  id: string;
  name: string;
  role: 'admin' | 'member' | string;
}

interface Category {
  id: number;
  name: string;
}

export default function WorkHomePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [scope, setScope] = useState<'open' | 'done'>('open');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const todayIso = tokyoTodayIso();

  const load = useCallback(async (nextScope: 'open' | 'done') => {
    setError('');
    try {
      const [meRes, taskRes, catRes] = await Promise.all([
        fetch('/api/work/me', { cache: 'no-store' }),
        fetch(`/api/work/tasks?scope=${nextScope}`, { cache: 'no-store' }),
        fetch('/api/work/categories', { cache: 'no-store' }),
      ]);

      // セッション切れは middleware がログインへ送るが、API直叩きの場合もここで拾う
      if (meRes.status === 401 || taskRes.status === 401) {
        window.location.href = '/work/login';
        return;
      }

      const meData = await meRes.json().catch(() => ({}));
      const taskData = await taskRes.json().catch(() => ({}));
      const catData = await catRes.json().catch(() => ({}));

      if (meData.success) setMe(meData.user);
      if (taskData.success) setTasks(Array.isArray(taskData.tasks) ? taskData.tasks : []);
      else setError(taskData.error || 'タスクを取得できませんでした');
      if (Array.isArray(catData.categories)) setCategories(catData.categories);
    } catch {
      setError('通信に失敗しました。電波の良い場所で開き直してください。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(scope);
  }, [load, scope]);

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
      // 完了したものは「未完了」タブから消える。取り直して整合を保つ
      await load(scope);
    } catch {
      setError('通信に失敗しました。もう一度お試しください。');
    }
  };

  const logout = async () => {
    await fetch('/api/work/me', { method: 'DELETE' }).catch(() => {});
    window.location.href = '/work/login';
  };

  const categoryName = (id: number | null) =>
    id ? categories.find(c => c.id === id)?.name : undefined;

  const overdueCount = tasks.filter(
    t => t.due_date && t.due_date < todayIso && t.status !== 'done' && t.status !== 'confirmed'
  ).length;

  return (
    <div className="work-body">
      <div className="work-header">
        <h1>やることリスト</h1>
        <span className="work-who">{me ? `${me.name} さん` : ''}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {me?.role === 'admin' ? <a href="/work/admin">管理</a> : null}
          <button onClick={logout}>ログアウト</button>
        </div>
      </div>

      <div className="work-shell">
        <div className="work-tabs">
          <button
            className={'work-tab' + (scope === 'open' ? ' is-active' : '')}
            onClick={() => setScope('open')}
          >
            未完了{scope === 'open' && tasks.length ? `（${tasks.length}）` : ''}
          </button>
          <button
            className={'work-tab' + (scope === 'done' ? ' is-active' : '')}
            onClick={() => setScope('done')}
          >
            完了済み
          </button>
        </div>

        {overdueCount > 0 && scope === 'open' ? (
          <div className="work-error" style={{ marginTop: 12 }}>
            期限を過ぎているものが {overdueCount} 件あります。
          </div>
        ) : null}

        {error ? <div className="work-error">{error}</div> : null}

        {loading ? (
          <div className="work-empty">読み込み中...</div>
        ) : tasks.length === 0 ? (
          <div className="work-empty">
            {scope === 'open'
              ? '未完了のタスクはありません。お疲れさまです。'
              : '完了済みのタスクはまだありません。'}
          </div>
        ) : (
          tasks.map(t => (
            <WorkTaskCard
              key={t.id}
              task={t}
              todayIso={todayIso}
              categoryName={categoryName(t.category_id)}
              isMine={t.assignee_id === me?.id}
              onAction={handleAction}
            />
          ))
        )}
      </div>
    </div>
  );
}
