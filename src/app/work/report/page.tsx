'use client';

import { useCallback, useEffect, useState } from 'react';
import '../work.css';

/**
 * /work/report — 日報。
 *
 * 🔴 設計の要: **自動で入る欄は手で書かせない。**
 *   「本日完了／対応中／期限超過」はサーバーが集計して返す。
 *   利用者が書くのは所感・困っていること・明日やることの3つだけ。
 *   ここを手入力にすると日報は続かない（PRDの設計思想）。
 */

interface TaskSnap {
  id: string;
  title: string;
  due_date: string | null;
  done_comment?: string | null;
}

interface Auto {
  done: TaskSnap[];
  ongoing: TaskSnap[];
  overdue: TaskSnap[];
}

export default function WorkReportPage() {
  const [date, setDate] = useState('');
  const [auto, setAuto] = useState<Auto | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({ comment: '', blockers: '', tomorrow: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (targetDate?: string) => {
    setError('');
    try {
      const q = targetDate ? `?date=${targetDate}` : '';
      const res = await fetch(`/api/work/reports${q}`, { cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = '/work/login';
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!data.success) {
        setError(data.error || '日報を取得できませんでした');
        return;
      }
      setDate(data.date);
      setSubmitted(!!data.submitted);
      setReport(data.report ?? null);
      setAuto(data.auto ?? null);
      if (data.report) {
        setForm({
          comment: String(data.report.comment ?? ''),
          blockers: String(data.report.blockers ?? ''),
          tomorrow: String(data.report.tomorrow ?? ''),
        });
      }
    } catch {
      setError('通信に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/work/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, ...form }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.error || '提出に失敗しました');
        return;
      }
      // 🔴 通知が飛ばなくても提出は成功。画面もそう見せる
      setNotice(
        data.notified
          ? '日報を提出しました。管理者へ通知しました。'
          : '日報を提出しました。（チャットワーク通知は未設定のため送られていません。提出は完了しています）'
      );
      setSubmitted(true);
      await load(date);
    } catch {
      setError('通信に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const snapshot = (key: 'done_tasks' | 'ongoing_tasks' | 'overdue_tasks'): TaskSnap[] => {
    const v = report?.[key];
    return Array.isArray(v) ? (v as TaskSnap[]) : [];
  };

  const done = submitted ? snapshot('done_tasks') : auto?.done ?? [];
  const ongoing = submitted ? snapshot('ongoing_tasks') : auto?.ongoing ?? [];
  const overdue = submitted ? snapshot('overdue_tasks') : auto?.overdue ?? [];

  return (
    <div className="work-body">
      <div className="work-header">
        <h1>日報</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <a href="/work">やること</a>
        </div>
      </div>

      <div className="work-shell">
        <div className="work-card">
          <div className="work-field">
            <label>対象日</label>
            <input
              type="date"
              value={date}
              onChange={e => {
                setDate(e.target.value);
                load(e.target.value);
              }}
            />
          </div>
          {submitted ? (
            <p className="work-note" style={{ color: '#1f7a3d', fontWeight: 700 }}>
              この日の日報は提出済みです。内容は提出時点のものを表示しています。
            </p>
          ) : null}
        </div>

        {notice ? (
          <div className="work-card" style={{ borderLeft: '5px solid #1f7a3d', color: '#1f7a3d', fontWeight: 700 }}>
            {notice}
          </div>
        ) : null}
        {error ? <div className="work-error">{error}</div> : null}

        {loading ? (
          <div className="work-empty">読み込み中...</div>
        ) : (
          <>
            {/* ---- 自動で入る欄 ---- */}
            <div className="work-card">
              <h2>本日完了した項目（自動）</h2>
              {done.length === 0 ? (
                <p className="work-note">まだありません。</p>
              ) : (
                done.map(t => (
                  <p key={t.id} className="work-note" style={{ margin: '4px 0' }}>
                    ・{t.title}
                    {t.done_comment ? `（${t.done_comment}）` : ''}
                  </p>
                ))
              )}
            </div>

            <div className="work-card">
              <h2>対応中の項目（自動）</h2>
              {ongoing.length === 0 ? (
                <p className="work-note">ありません。</p>
              ) : (
                ongoing.map(t => (
                  <p key={t.id} className="work-note" style={{ margin: '4px 0' }}>
                    ・{t.title}
                  </p>
                ))
              )}
            </div>

            {overdue.length > 0 ? (
              <div className="work-card" style={{ borderLeft: '5px solid #e02020' }}>
                <h2>期限を過ぎている項目（自動）</h2>
                {overdue.map(t => (
                  <p key={t.id} className="work-note" style={{ margin: '4px 0' }}>
                    ・{t.title}（期限 {t.due_date ?? '不明'}）
                  </p>
                ))}
              </div>
            ) : null}

            {/* ---- 手で書く欄 ---- */}
            <div className="work-card">
              <h2>所感・困っていること・明日やること</h2>
              <div className="work-field">
                <label>所感</label>
                <textarea
                  value={form.comment}
                  onChange={e => setForm({ ...form, comment: e.target.value })}
                  placeholder="今日やってみて気づいたことなど（空でも提出できます）"
                  disabled={submitted}
                />
              </div>
              <div className="work-field">
                <label>困っていること</label>
                <textarea
                  value={form.blockers}
                  onChange={e => setForm({ ...form, blockers: e.target.value })}
                  placeholder="詰まっていること・判断してほしいこと"
                  disabled={submitted}
                />
              </div>
              <div className="work-field">
                <label>明日やること</label>
                <textarea
                  value={form.tomorrow}
                  onChange={e => setForm({ ...form, tomorrow: e.target.value })}
                  disabled={submitted}
                />
              </div>
              {submitted ? (
                <p className="work-note">
                  提出済みのため編集できません。修正が必要なときは管理者にお伝えください。
                </p>
              ) : (
                <button className="work-btn work-btn-done" onClick={submit} disabled={saving}>
                  {saving ? '提出中...' : 'この内容で提出する'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
