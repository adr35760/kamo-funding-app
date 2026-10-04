'use client';

import { useState } from 'react';

/**
 * タスク1件のカード。**一覧の中で受領・完了まで完結する**。
 *
 * 🔴 詳細画面を開かせないことが譲れない要件（開かせると使われなくなる）。
 *   そのため本文・期限・カテゴリもこのカードに出し、ボタンもここに置く。
 * 🔴 完了コメントは任意。空でも「完了」を押せる（強制すると押されなくなる）。
 *   コメント欄は「完了」を押す前に開ける形にして、書きたい人だけ書く。
 */

export interface WorkTask {
  id: string;
  title: string;
  body: string | null;
  assignee_id: string | null;
  category_id: number | null;
  due_date: string | null;
  due_time: string | null;
  priority: 'high' | 'mid' | 'low' | string;
  status: 'unaccepted' | 'in_progress' | 'done' | 'confirmed' | string;
  done_comment: string | null;
  done_at?: string | null;
  estimated_minutes?: number | null;
  created_by?: string | null;
}

export const STATUS_LABELS: Record<string, string> = {
  unaccepted: '未受領',
  in_progress: '対応中',
  done: '完了',
  confirmed: '確認済み',
};

const PRIORITY_LABELS: Record<string, string> = { high: '重要度 高', mid: '重要度 中', low: '重要度 低' };

/** 期限の状態。日付だけで判定する（時刻は表示のみ） */
export type DueState = 'none' | 'overdue' | 'today' | 'future';

export function dueState(dueDate: string | null, todayIso: string): DueState {
  if (!dueDate) return 'none';
  if (dueDate < todayIso) return 'overdue';
  if (dueDate === todayIso) return 'today';
  return 'future';
}

/** 今日の日付（Asia/Tokyo）を YYYY-MM-DD で返す。端末のタイムゾーンに依存させない */
export function tokyoTodayIso(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return parts; // en-CA は YYYY-MM-DD 形式
}

function formatDue(dueDate: string | null, dueTime: string | null): string {
  if (!dueDate) return '期限なし';
  const [y, m, d] = dueDate.split('-');
  const wd = ['日', '月', '火', '水', '木', '金', '土'][
    new Date(`${dueDate}T00:00:00+09:00`).getUTCDay()
  ];
  const time = dueTime ? ` ${dueTime.slice(0, 5)}` : '';
  return `${Number(m)}/${Number(d)}（${wd}）${time}`.trim() + (y ? '' : '');
}

interface Props {
  task: WorkTask;
  todayIso: string;
  categoryName?: string;
  assigneeName?: string;
  /** 管理者向け表示（担当者名を出し、確認ボタンを出す） */
  isAdmin?: boolean;
  /** 自分が担当かどうか。受領・完了を出すかの判断に使う */
  isMine: boolean;
  onAction: (taskId: string, action: 'accept' | 'done' | 'confirm' | 'reopen', comment?: string) => Promise<void>;
}

export default function WorkTaskCard({
  task,
  todayIso,
  categoryName,
  assigneeName,
  isAdmin = false,
  isMine,
  onAction,
}: Props) {
  const [busy, setBusy] = useState('');
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');

  const due = dueState(task.due_date, todayIso);
  const cardClass =
    'work-task' + (due === 'overdue' ? ' is-overdue' : due === 'today' ? ' is-today' : '');

  const run = async (action: 'accept' | 'done' | 'confirm' | 'reopen') => {
    setBusy(action);
    try {
      await onAction(task.id, action, action === 'done' ? comment : undefined);
      setShowComment(false);
      setComment('');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className={cardClass}>
      <p className="work-task-title">{task.title}</p>
      {task.body ? <p className="work-task-body">{task.body}</p> : null}

      <div className="work-task-meta">
        <span
          className={
            'work-chip' +
            (due === 'overdue' ? ' due-overdue' : due === 'today' ? ' due-today' : '')
          }
        >
          {due === 'overdue' ? '期限切れ ' : due === 'today' ? '本日 ' : ''}
          {formatDue(task.due_date, task.due_time)}
        </span>
        <span className="work-chip status">{STATUS_LABELS[task.status] ?? task.status}</span>
        {task.priority === 'high' || task.priority === 'low' ? (
          <span className={'work-chip ' + (task.priority === 'high' ? 'pri-high' : 'pri-low')}>
            {PRIORITY_LABELS[task.priority]}
          </span>
        ) : null}
        {task.estimated_minutes ? <span className="work-chip">想定 {formatMinutes(task.estimated_minutes)}</span> : null}
        {task.created_by && task.created_by === task.assignee_id ? <span className="work-chip">自分で追加</span> : null}
        {categoryName ? <span className="work-chip">{categoryName}</span> : null}
        {isAdmin && assigneeName ? <span className="work-chip">担当: {assigneeName}</span> : null}
      </div>

      {task.done_comment ? (
        <p className="work-note" style={{ marginBottom: 10 }}>
          完了コメント: {task.done_comment}
        </p>
      ) : null}

      {/* コメント欄は任意。開いた人だけ書く */}
      {showComment && task.status !== 'done' && task.status !== 'confirmed' ? (
        <textarea
          className="work-comment"
          placeholder="ひとこと（任意・空のままでも完了できます）"
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={2}
        />
      ) : null}

      <div className="work-actions">
        {/* 🔴 一覧から直接押せる受領・完了 */}
        {isMine && task.status === 'unaccepted' ? (
          <button
            className="work-btn work-btn-accept"
            onClick={() => run('accept')}
            disabled={busy !== ''}
          >
            {busy === 'accept' ? '処理中...' : '受領'}
          </button>
        ) : null}

        {isMine && (task.status === 'unaccepted' || task.status === 'in_progress') ? (
          <button
            className="work-btn work-btn-done"
            onClick={() => run('done')}
            disabled={busy !== ''}
          >
            {busy === 'done' ? '処理中...' : '完了'}
          </button>
        ) : null}

        {isMine && !showComment && (task.status === 'unaccepted' || task.status === 'in_progress') ? (
          <button
            className="work-btn work-btn-ghost"
            onClick={() => setShowComment(true)}
            disabled={busy !== ''}
          >
            ひとこと添える
          </button>
        ) : null}

        {/* 確認済みは管理者だけ */}
        {isAdmin && task.status === 'done' ? (
          <button
            className="work-btn work-btn-confirm"
            onClick={() => run('confirm')}
            disabled={busy !== ''}
          >
            {busy === 'confirm' ? '処理中...' : '確認済みにする'}
          </button>
        ) : null}

        {isAdmin && (task.status === 'done' || task.status === 'confirmed') ? (
          <button
            className="work-btn work-btn-ghost"
            onClick={() => run('reopen')}
            disabled={busy !== ''}
          >
            差し戻す
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** 分を「1時間30分」形式に */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}時間${m}分`;
  if (h) return `${h}時間`;
  return `${m}分`;
}
