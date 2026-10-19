'use client';

import { useCallback, useEffect, useState } from 'react';
import '../work.css';
import { formatMinutes, formatYen } from '@/lib/work-pay';

/**
 * /work/payroll — 報酬と時間（固定給75,000円／65時間とインセンティブ）
 *
 * 読む人：小川さん（自分の分）と t ikuさん（全員の分を選べる）。
 * 🔴 「何時間使ったか」「あといくら稼いだか」を1画面で決める。
 *   タスク一覧の続きではなく、給与明細として読めることを優先する。
 */

interface Item {
  code: string;
  no: string;
  name: string;
  minutes: number;
}
interface IncentiveItem {
  id: string;
  title: string;
  code: string;
  name: string;
  yen: number;
  minutes: number;
  done: boolean;
}
interface Payroll {
  success: boolean;
  needs_migration?: boolean;
  month: string;
  user: { id: string; name: string };
  fixed: {
    budgetMinutes: number;
    weeklyBudgetMinutes: number;
    monthlyYen: number;
    usedMinutes: number;
    plannedMinutes: number;
    remainingMinutes: number;
    weekUsedMinutes: number;
    weekStart: string;
    byItem: Item[];
  };
  incentive: { confirmedYen: number; pendingYen: number; confirmed: IncentiveItem[]; pending: IncentiveItem[]; minutes: number };
  totalMinutes: number;
  totalYen: number;
}

const monthLabel = (month: string) => `${Number(month.slice(5))}月`;

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function PayrollPage() {
  const [month, setMonth] = useState('');
  const [userId, setUserId] = useState('');
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [me, setMe] = useState<{ id: string; name: string; role: string } | null>(null);
  const [data, setData] = useState<Payroll | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (m: string, uid: string) => {
    setError('');
    try {
      const q = new URLSearchParams();
      if (m) q.set('month', m);
      if (uid) q.set('user_id', uid);
      const [meRes, res, usersRes] = await Promise.all([
        fetch('/api/work/me', { cache: 'no-store' }),
        fetch(`/api/work/payroll?${q.toString()}`, { cache: 'no-store' }),
        fetch('/api/work/users', { cache: 'no-store' }),
      ]);
      if (meRes.status === 401 || res.status === 401) {
        window.location.href = '/work/login';
        return;
      }
      const meData = await meRes.json().catch(() => ({}));
      const d = await res.json().catch(() => ({}));
      const uData = await usersRes.json().catch(() => ({}));
      if (meData.success) setMe(meData.user);
      if (Array.isArray(uData.users)) {
        setUsers(uData.users.filter((u: { is_active: boolean }) => u.is_active));
      }
      if (d.success) {
        setData(d);
        setMonth(d.month);
      } else {
        setError(d.error || '実績を取得できませんでした');
      }
    } catch {
      setError('通信に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load('', '');
  }, [load]);

  const isAdmin = me?.role === 'admin';
  const fixed = data?.fixed;
  const usedPct = fixed ? Math.min(100, Math.round((fixed.usedMinutes / fixed.budgetMinutes) * 100)) : 0;
  const weekPct = fixed ? Math.min(100, Math.round((fixed.weekUsedMinutes / fixed.weeklyBudgetMinutes) * 100)) : 0;
  const over = fixed ? fixed.usedMinutes > fixed.budgetMinutes : false;

  return (
    <div className="work-body">
      <div className="work-header">
        <h1>報酬と時間</h1>
        <span className="work-who">{data?.user.name ? `${data.user.name} さん` : ''}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <a href="/work">やること</a>
          {isAdmin ? <a href="/work/admin">管理</a> : null}
        </div>
      </div>

      <div className="work-shell">
        {/* 月の切り替え */}
        <div className="work-card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="work-btn work-btn-ghost" onClick={() => load(shiftMonth(month, -1), userId)}>← 前月</button>
          <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 17 }}>{monthLabel(month)}</div>
          <button className="work-btn work-btn-ghost" onClick={() => load(shiftMonth(month, 1), userId)}>翌月 →</button>
        </div>

        {isAdmin && users.length > 0 ? (
          <div className="work-card">
            <div className="work-field">
              <label>見る人</label>
              <select value={userId} onChange={e => { setUserId(e.target.value); load(month, e.target.value); }}>
                <option value="">自分（{me?.name}）</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>
        ) : null}

        {error ? <div className="work-error">{error}</div> : null}

        {loading ? (
          <div className="work-empty">読み込み中...</div>
        ) : !data ? (
          <div className="work-empty">実績を表示できません。</div>
        ) : (
          <>
            {data.needs_migration ? (
              <div className="work-error">
                制度の列がまだデータベースにありません。時間の集計のみ表示しています（金額は出せません）。
                t ikuさんは「区分と報酬」のSQLを実行してください。
              </div>
            ) : null}

            {/* ---- 固定給 ---- */}
            <div className="work-card">
              <h2>固定給のぶん（月65時間・{formatYen(data.fixed.monthlyYen)}）</h2>
              <p style={{ fontSize: 30, fontWeight: 700, margin: '2px 0 0', color: over ? '#b81414' : '#12284b' }}>
                {formatMinutes(fixed!.usedMinutes)}
                <span style={{ fontSize: 15, color: '#666', fontWeight: 400 }}> / 65時間</span>
              </p>
              <div style={{ height: 12, background: '#e7eaee', borderRadius: 6, margin: '8px 0 6px' }}>
                <div
                  style={{
                    width: `${usedPct}%`,
                    height: '100%',
                    background: over ? '#b81414' : '#1f7a3d',
                    borderRadius: 6,
                  }}
                />
              </div>
              <p className="work-note" style={{ margin: 0 }}>
                {over
                  ? `65時間を ${formatMinutes(fixed!.usedMinutes - fixed!.budgetMinutes)} 超えています。超過ぶんはインセンティブ扱いにするか、翌月で調整してください。`
                  : `残り ${formatMinutes(fixed!.remainingMinutes)}`}
                {fixed!.plannedMinutes > 0 ? `（未完了の予定 ${formatMinutes(fixed!.plannedMinutes)} を含めると残り ${formatMinutes(fixed!.remainingMinutes - fixed!.plannedMinutes)}）` : ''}
              </p>

              <h2 style={{ marginTop: 16, fontSize: 14 }}>今週（{fixed!.weekStart.slice(5).replace('-', '/')}〜）</h2>
              <p style={{ margin: 0, fontWeight: 700 }}>
                {formatMinutes(fixed!.weekUsedMinutes)}
                <span style={{ fontSize: 13, color: '#666', fontWeight: 400 }}> / 15時間</span>
              </p>
              <div style={{ height: 8, background: '#e7eaee', borderRadius: 4, margin: '6px 0 0' }}>
                <div style={{ width: `${weekPct}%`, height: '100%', background: weekPct > 100 ? '#b81414' : '#4a7ab5', borderRadius: 4 }} />
              </div>

              {fixed!.byItem.length > 0 ? (
                <>
                  <h2 style={{ marginTop: 16, fontSize: 14 }}>業務ごとの内訳</h2>
                  <table className="work-table">
                    <tbody>
                      {fixed!.byItem.map(i => (
                        <tr key={i.code}>
                          <td style={{ width: 20 }}>{i.no}</td>
                          <td>{i.name}</td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatMinutes(i.minutes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : null}
            </div>

            {/* ---- インセンティブ ---- */}
            <div className="work-card">
              <h2>インセンティブ（{monthLabel(data.month)}）</h2>
              <p style={{ fontSize: 26, fontWeight: 700, margin: '2px 0 0', color: '#1f7a3d' }}>
                {formatYen(data.incentive.confirmedYen)}
              </p>
              <p className="work-note" style={{ margin: '2px 0 10px' }}>
                確定ぶん（{data.incentive.confirmed.length}件）
                {data.incentive.pending.length > 0
                  ? `／進行中 ${formatYen(data.incentive.pendingYen)}（${data.incentive.pending.length}件）`
                  : ''}
              </p>

              {data.incentive.confirmed.length === 0 && data.incentive.pending.length === 0 ? (
                <p className="work-note">この月のインセンティブ業務はありません。</p>
              ) : (
                <table className="work-table">
                  <tbody>
                    {[...data.incentive.confirmed, ...data.incentive.pending].map(x => (
                      <tr key={x.id}>
                        <td>
                          {x.name}
                          {x.title && x.title !== x.name ? <span style={{ color: '#888' }}>（{x.title}）</span> : null}
                          <span className="work-chip" style={{ marginLeft: 6 }}>{x.done ? '確定' : '進行中'}</span>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}>
                          {formatYen(x.yen)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* ---- 合計 ---- */}
            <div className="work-card">
              <h2>今月の合計</h2>
              <table className="work-table">
                <tbody>
                  <tr><td>固定給</td><td style={{ textAlign: 'right' }}>{formatYen(data.fixed.monthlyYen)}</td></tr>
                  <tr><td>インセンティブ（確定）</td><td style={{ textAlign: 'right' }}>{formatYen(data.incentive.confirmedYen)}</td></tr>
                  <tr><td style={{ fontWeight: 700 }}>合計</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{formatYen(data.totalYen)}</td></tr>
                  <tr><td>総労働時間（固定＋インセンティブ）</td><td style={{ textAlign: 'right' }}>{formatMinutes(data.totalMinutes)}</td></tr>
                </tbody>
              </table>
              <p className="work-note" style={{ marginTop: 10 }}>
                固定給は日常的なプラットフォーム運営業務が対象です。企画・制作・営業・紹介は着手前に報酬を確定してから行います。
                インセンティブ業務の時間も労働時間として記録し、固定給ぶんと合計して最低賃金・割増賃金を満たす必要があります（成果報酬は上乗せで、それだけでは賃金支払義務を満たしません）。
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
