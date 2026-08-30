'use client';

import { useState, useEffect } from 'react';

interface Event {
  finished?: boolean;
  id: string;
  title: string;
  type: string;
  pillar: number;
  event_date: string;
  location: string;
  capacity: number | null;
  status: string;
  streaming_url: string | null;
  streaming_platform: string | null;
}

interface Registration {
  id: string;
  event_id: string;
  name: string;
  email: string;
  company: string | null;
  referrer_source: string | null;
  challenge_description: string | null;
  status: string;
  created_at: string;
}

interface Partner {
  id: string;
  name: string;
  email: string;
  partner_type: string | null;
  organization: string | null;
  referral_code: string | null;
  status: string | null;
  created_at: string;
  terms_agreed?: boolean | null;
  terms_agreed_at?: string | null;
}

interface Referral {
  id: string;
  partner_id: string;
  referred_contact_name: string | null;
  referred_company_name: string | null;
  referred_email: string | null;
  relationship?: string | null;
  status: string | null;
  notes: string | null;
  terms_agreed?: boolean | null;
  terms_agreed_at?: string | null;
  created_at: string;
  partners?: { name: string | null; email: string | null; referral_code: string | null } | null;
}

/** migration未適用時、notes に退避した「ご関係」「規約同意日時」を読み出す */
function extractFromNotes(notes: string | null | undefined, key: string): string {
  if (!notes) return '';
  const line = notes.split('\n').find(l => l.startsWith(`${key}:`));
  return line ? line.slice(key.length + 1).trim() : '';
}

const pillarLabels: Record<number, string> = {
  1: '説明会',
  2: 'オンラインセミナー',
  3: 'リアル懇親会',
  4: 'パートナー',
};

const typeLabels: Record<string, string> = {
  seminar: 'セミナー',
  info_session: '説明会',
  networking: '懇親会',
};

const partnerTypeLabels: Record<string, string> = {
  referral: '紹介パートナー',
  advisor: '認定アドバイザー',
  supporter: 'サポーター',
};

export default function AdminPage() {
  const [tab, setTab] = useState<'events' | 'registrations' | 'partners' | 'referrals' | 'ai'>('events');
  const [events, setEvents] = useState<Event[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string>('');
  const [showEventForm, setShowEventForm] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  // 一括削除用: チェックされた行の id 集合
  const [selectedRegIds, setSelectedRegIds] = useState<Set<string>>(new Set());
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<Set<string>>(new Set());

  // 新規イベントフォーム
  const [newEvent, setNewEvent] = useState({
    title: '',
    type: 'info_session',
    pillar: 1,
    event_date: '',
    location: '',
    capacity: '',
    streaming_url: '',
    streaming_platform: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
    // イベント一覧取得
    // 管理画面は過去日程も表示する必要があるため専用APIを使う（公開APIは終了回を除外）
    const eventsRes = await fetch('/api/admin/events');
    if (eventsRes.ok) {
      const eventsData = await eventsRes.json();
      setEvents(eventsData.events || []);
    }
    // 申込者一覧取得（admin API経由 — service role key使用）
    const regsRes = await fetch('/api/admin/registrations');
    if (regsRes.ok) {
      const regsData = await regsRes.json();
      setRegistrations(regsData.registrations || []);
    }
    // パートナー一覧取得
    const partnersRes = await fetch('/api/admin/partners');
    if (partnersRes.ok) {
      const partnersData = await partnersRes.json();
      setPartners(partnersData.partners || []);
    }
    // 紹介者一覧取得
    const referralsRes = await fetch('/api/admin/referrals');
    if (referralsRes.ok) {
      const referralsData = await referralsRes.json();
      setReferrals(referralsData.referrals || []);
    }
    } catch {
      // fetch error — 空のまま
    }
    setLoading(false);
    // 一括削除後の再取得時は選択をクリア
    setSelectedRegIds(new Set());
    setSelectedPartnerIds(new Set());
  };

  /** 申込を削除（確認ダイアログあり・不可逆） */
  const handleDeleteRegistration = async (reg: Registration) => {
    const confirmMsg = `${reg.name} さんの申込を削除しますか？\nこの操作は取り消せません。`;
    if (!window.confirm(confirmMsg)) return;
    setDeleting(reg.id);
    try {
      const res = await fetch(`/api/admin/registrations?id=${encodeURIComponent(reg.id)}`, { method: 'DELETE' });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.ok) {
        alert(`削除に失敗しました: ${result.error || '不明なエラー'}`);
        return;
      }
      alert('申込を削除しました。');
      fetchData();
    } catch {
      alert('削除中にエラーが発生しました');
    } finally {
      setDeleting('');
    }
  };

  /** パートナーを削除（確認ダイアログあり・不可逆） */
  const handleDeletePartner = async (partner: Partner) => {
    const confirmMsg = `${partner.name} さんのパートナー登録を削除しますか？\nこの操作は取り消せません。`;
    if (!window.confirm(confirmMsg)) return;
    setDeleting(partner.id);
    try {
      const res = await fetch(`/api/admin/partners?id=${encodeURIComponent(partner.id)}`, { method: 'DELETE' });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.ok) {
        alert(`削除に失敗しました: ${result.error || '不明なエラー'}`);
        return;
      }
      alert('パートナーを削除しました。');
      fetchData();
    } catch {
      alert('削除中にエラーが発生しました');
    } finally {
      setDeleting('');
    }
  };

  /** 申込を一括削除（確認ダイアログあり・不可逆） */
  const handleBulkDeleteRegistrations = async () => {
    const ids = Array.from(selectedRegIds);
    if (ids.length === 0) {
      alert('削除する申込を選択してください。');
      return;
    }
    const confirmMsg = `選択した ${ids.length} 件の申込を削除しますか？\nこの操作は取り消せません。`;
    if (!window.confirm(confirmMsg)) return;
    setDeleting('bulk-regs');
    try {
      const res = await fetch(`/api/admin/registrations?id=${encodeURIComponent(ids.join(','))}`, { method: 'DELETE' });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.ok) {
        alert(`削除に失敗しました: ${result.error || '不明なエラー'}`);
        return;
      }
      alert(`${ids.length} 件の申込を削除しました。`);
      setSelectedRegIds(new Set());
      fetchData();
    } catch {
      alert('削除中にエラーが発生しました');
    } finally {
      setDeleting('');
    }
  };

  /** パートナーを一括削除（確認ダイアログあり・不可逆） */
  const handleBulkDeletePartners = async () => {
    const ids = Array.from(selectedPartnerIds);
    if (ids.length === 0) {
      alert('削除するパートナーを選択してください。');
      return;
    }
    const confirmMsg = `選択した ${ids.length} 件のパートナーを削除しますか？\nこの操作は取り消せません。`;
    if (!window.confirm(confirmMsg)) return;
    setDeleting('bulk-partners');
    try {
      const res = await fetch(`/api/admin/partners?id=${encodeURIComponent(ids.join(','))}`, { method: 'DELETE' });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.ok) {
        alert(`削除に失敗しました: ${result.error || '不明なエラー'}`);
        return;
      }
      alert(`${ids.length} 件のパートナーを削除しました。`);
      setSelectedPartnerIds(new Set());
      fetchData();
    } catch {
      alert('削除中にエラーが発生しました');
    } finally {
      setDeleting('');
    }
  };

  /** 行チェックのトグル */
  const toggleRegSelection = (id: string) => {
    setSelectedRegIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const togglePartnerSelection = (id: string) => {
    setSelectedPartnerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allPartnersSelected = partners.length > 0 && partners.every(p => selectedPartnerIds.has(p.id));
  const toggleAllPartners = () => {
    setSelectedPartnerIds(prev => {
      const next = new Set(prev);
      partners.forEach(p => next.add(p.id));
      if (allPartnersSelected) partners.forEach(p => next.delete(p.id));
      return next;
    });
  };

  const handleCreateEvent = async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      alert('Supabase接続が設定されていません');
      return;
    }
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/events`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          title: newEvent.title,
          type: newEvent.type,
          pillar: Number(newEvent.pillar),
          event_date: new Date(newEvent.event_date).toISOString(),
          location: newEvent.location || null,
          capacity: newEvent.capacity ? Number(newEvent.capacity) : null,
          streaming_url: newEvent.streaming_url || null,
          streaming_platform: newEvent.streaming_platform || null,
          status: 'upcoming',
        }),
      });
      if (res.ok) {
        fetchData();
        setShowEventForm(false);
      } else {
        alert('イベント作成に失敗しました');
      }
    } catch {
      alert('イベント作成中にエラーが発生しました');
    }
  };

  const exportCSV = () => {
    if (registrations.length === 0) {
      alert('エクスポートするデータがありません');
      return;
    }
    const headers = ['名前', 'メール', '会社', '参加経路', '挑戦内容', 'ステータス', '申込日時'];
    const rows = registrations.map(r => [
      r.name, r.email, r.company || '', r.referrer_source || '',
      r.challenge_description || '', r.status, new Date(r.created_at).toLocaleString('ja-JP'),
    ]);
    const csv = [headers, ...rows].map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registrations_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredRegs = selectedEventId
    ? registrations.filter(r => r.event_id === selectedEventId)
    : registrations;

  /** 全選択チェックボックス（一覧表示中の行すべて） */
  const allRegsSelected = filteredRegs.length > 0 && filteredRegs.every(r => selectedRegIds.has(r.id));
  const toggleAllRegs = () => {
    setSelectedRegIds(prev => {
      const next = new Set(prev);
      filteredRegs.forEach(r => next.add(r.id));
      if (allRegsSelected) filteredRegs.forEach(r => next.delete(r.id));
      return next;
    });
  };

  return (
    <div style={{ fontFamily: "'Noto Sans JP', sans-serif", maxWidth: 1100, margin: '0 auto', padding: 20 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, margin: '0 0 4px' }}>
          <a
            href="/"
            title="トップページへ"
            style={{ color: '#E60012', textDecoration: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', transition: 'border-color .2s, opacity .2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderBottomColor = '#E60012'; e.currentTarget.style.opacity = '0.8'; }}
            onMouseLeave={e => { e.currentTarget.style.borderBottomColor = 'transparent'; e.currentTarget.style.opacity = '1'; }}
          >
            KAMOファンディング 管理画面
          </a>
        </h1>
        <p style={{ color: '#999', fontSize: 13 }}>説明会・セミナー管理 + 申込者一覧</p>
      </div>

      {/* Quick Links */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <a href="/ai-tool" style={{
          padding: '8px 16px', background: '#E60012', color: '#fff', borderRadius: 6, fontSize: 13,
        }}>
          🔥 AIクラファンページ作成ツール
        </a>
        <a href="/partners" style={{
          padding: '8px 16px', background: '#D4A017', color: '#fff', borderRadius: 6, fontSize: 13,
        }}>
          🤝 パートナー登録
        </a>
        <a href="/supporters" style={{
          padding: '8px 16px', background: '#333', color: '#fff', borderRadius: 6, fontSize: 13,
        }}>
          🎯 サポーター登録
        </a>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #E60012' }}>
        <TabButton active={tab === 'events'} onClick={() => setTab('events')}>
          イベント管理
        </TabButton>
        <TabButton active={tab === 'registrations'} onClick={() => setTab('registrations')}>
          申込者一覧
        </TabButton>
        <TabButton active={tab === 'partners'} onClick={() => setTab('partners')}>
          パートナー管理
        </TabButton>
        <TabButton active={tab === 'referrals'} onClick={() => setTab('referrals')}>
          紹介者一覧
        </TabButton>
        <TabButton active={tab === 'ai'} onClick={() => setTab('ai')}>
          AI生成結果
        </TabButton>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>読み込み中...</div>
      ) : (
        <>
          {/* Events Tab */}
          {tab === 'events' && (
            <div>
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: 18 }}>イベント一覧</h2>
                <button onClick={() => setShowEventForm(!showEventForm)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#E60012',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}>
                  + 新規イベント作成
                </button>
              </div>

              {showEventForm && (
                <div style={{
                  background: '#f9f9f9',
                  borderRadius: 8,
                  padding: 20,
                  marginBottom: 20,
                  border: '1px solid #e0e0e0',
                }}>
                  <h3 style={{ marginBottom: 16, fontSize: 15 }}>新規イベント</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Input label="タイトル" value={newEvent.title}
                      onChange={v => setNewEvent({ ...newEvent, title: v })} />
                    <Select label="タイプ" value={newEvent.type}
                      onChange={v => setNewEvent({ ...newEvent, type: v })}
                      options={[
                        { value: 'info_session', label: '説明会' },
                        { value: 'seminar', label: 'セミナー' },
                        { value: 'networking', label: '懇親会' },
                      ]} />
                    <Select label="Pillar" value={String(newEvent.pillar)}
                      onChange={v => setNewEvent({ ...newEvent, pillar: Number(v) })}
                      options={[
                        { value: '1', label: 'Pillar 1: 説明会' },
                        { value: '2', label: 'Pillar 2: セミナー' },
                        { value: '3', label: 'Pillar 3: 懇親会' },
                        { value: '4', label: 'Pillar 4: パートナー' },
                      ]} />
                    <Input label="開催日時" type="datetime-local" value={newEvent.event_date}
                      onChange={v => setNewEvent({ ...newEvent, event_date: v })} />
                    <Input label="会場/URL" value={newEvent.location}
                      onChange={v => setNewEvent({ ...newEvent, location: v })} />
                    <Input label="定員" type="number" value={newEvent.capacity}
                      onChange={v => setNewEvent({ ...newEvent, capacity: v })} />
                    <Input label="配信URL (Zoom/YouTube)" value={newEvent.streaming_url}
                      onChange={v => setNewEvent({ ...newEvent, streaming_url: v })} />
                    <Select label="配信プラットフォーム" value={newEvent.streaming_platform}
                      onChange={v => setNewEvent({ ...newEvent, streaming_platform: v })}
                      options={[
                        { value: '', label: 'なし' },
                        { value: 'zoom', label: 'Zoom' },
                        { value: 'youtube', label: 'YouTube Live' },
                      ]} />
                  </div>
                  <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                    <button onClick={handleCreateEvent}
                      style={{ ...primaryBtn, fontSize: 13 }}>作成</button>
                    <button onClick={() => setShowEventForm(false)}
                      style={secondaryBtn}>キャンセル</button>
                  </div>
                </div>
              )}

              {events.length === 0 ? (
                <EmptyState message="イベントがありません。「新規イベント作成」から追加してください。" />
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                      <Th>タイトル</Th>
                      <Th>タイプ</Th>
                      <Th>Pillar</Th>
                      <Th>開催日時</Th>
                      <Th>会場</Th>
                      <Th>定員</Th>
                      <Th>ステータス</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map(ev => (
                      <tr key={ev.id} style={{ borderBottom: '1px solid #eee' }}>
                        <Td>{ev.title}</Td>
                        <Td>{typeLabels[ev.type] || ev.type}</Td>
                        <Td>{pillarLabels[ev.pillar] || `Pillar ${ev.pillar}`}</Td>
                        <Td>
                          {new Date(ev.event_date).toLocaleString('ja-JP')}
                          {ev.finished && (
                            <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: '#666', background: '#eee', padding: '2px 6px', borderRadius: 4 }}>
                              終了
                            </span>
                          )}
                        </Td>
                        <Td>{ev.location || '-'}</Td>
                        <Td>{ev.capacity || '-'}</Td>
                        <Td>{ev.status}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Registrations Tab */}
          {tab === 'registrations' && (
            <div>
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: 18 }}>申込者一覧</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={selectedEventId}
                    onChange={e => setSelectedEventId(e.target.value)}
                    style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                    <option value="">全イベント</option>
                    {events.map(ev => (
                      <option key={ev.id} value={ev.id}>{ev.title}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleBulkDeleteRegistrations}
                    disabled={selectedRegIds.size === 0 || deleting === 'bulk-regs'}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid #f5c6c6',
                      background: selectedRegIds.size > 0 ? '#fdecea' : '#f9f9f9',
                      color: selectedRegIds.size > 0 ? '#d32f2f' : '#bbb',
                      cursor: selectedRegIds.size > 0 ? 'pointer' : 'not-allowed',
                      fontSize: 13,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}>
                    {deleting === 'bulk-regs' ? '削除中...' : `選択したものを削除 (${selectedRegIds.size})`}
                  </button>
                  <button onClick={exportCSV}
                    style={{ ...secondaryBtn, fontSize: 13 }}>
                    CSV出力
                  </button>
                </div>
              </div>

              {filteredRegs.length === 0 ? (
                <EmptyState message="申込データがありません。LPが公開されると申込が蓄積されます。" />
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px', fontSize: 12, color: '#666', width: 36 }}>
                        <input
                          type="checkbox"
                          checked={allRegsSelected}
                          onChange={toggleAllRegs}
                          title="全選択"
                        />
                      </th>
                      <Th>名前</Th>
                      <Th>メール</Th>
                      <Th>申込イベント</Th>
                      <Th>会社</Th>
                      <Th>参加経路</Th>
                      <Th>挑戦内容</Th>
                      <Th>ステータス</Th>
                      <Th>申込日時</Th>
                      <Th>操作</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRegs.map(reg => (
                      <tr key={reg.id} style={{ borderBottom: '1px solid #eee', background: selectedRegIds.has(reg.id) ? '#FFF5F5' : 'transparent' }}>
                        <Td>
                          <input
                            type="checkbox"
                            checked={selectedRegIds.has(reg.id)}
                            onChange={() => toggleRegSelection(reg.id)}
                          />
                        </Td>
                        <Td>{reg.name}</Td>
                        <Td>{reg.email}</Td>
                        <Td>
                          {(() => {
                            const ev = events.find(e => e.id === reg.event_id);
                            if (!ev) return <span style={{ color: '#999' }}>-</span>;
                            return (
                              <span>
                                {ev.title}
                                <span style={{ display: 'block', fontSize: 11, color: '#666' }}>
                                  {pillarLabels[ev.pillar] || `Pillar ${ev.pillar}`}
                                </span>
                              </span>
                            );
                          })()}
                        </Td>
                        <Td>{reg.company || '-'}</Td>
                        <Td>{reg.referrer_source || '-'}</Td>
                        <Td style={{ maxWidth: 200, color: '#E60012', cursor: 'help' }}
                          title={reg.challenge_description || ''}>
                          {reg.challenge_description ? reg.challenge_description.slice(0, 40) + '...' : '-'}
                        </Td>
                        <Td>{reg.status}</Td>
                        <Td>{new Date(reg.created_at).toLocaleString('ja-JP')}</Td>
                        <Td>
                          <button
                            onClick={() => handleDeleteRegistration(reg)}
                            disabled={deleting === reg.id}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 6,
                              border: '1px solid #f5c6c6',
                              background: '#fdecea',
                              color: '#d32f2f',
                              cursor: deleting === reg.id ? 'wait' : 'pointer',
                              fontSize: 12,
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                            }}>
                            {deleting === reg.id ? '削除中...' : '削除'}
                          </button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Partners Tab */}
          {tab === 'partners' && (
            <div>
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: 18 }}>パートナー管理</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleBulkDeletePartners}
                    disabled={selectedPartnerIds.size === 0 || deleting === 'bulk-partners'}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid #f5c6c6',
                      background: selectedPartnerIds.size > 0 ? '#fdecea' : '#f9f9f9',
                      color: selectedPartnerIds.size > 0 ? '#d32f2f' : '#bbb',
                      cursor: selectedPartnerIds.size > 0 ? 'pointer' : 'not-allowed',
                      fontSize: 13,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}>
                    {deleting === 'bulk-partners' ? '削除中...' : `選択したものを削除 (${selectedPartnerIds.size})`}
                  </button>
                  <a href="/partners" target="_blank" style={{ ...primaryBtn, fontSize: 13, textDecoration: 'none' }}>
                    パートナー登録ページ →
                  </a>
                  <a href="/supporters" target="_blank" style={{ ...secondaryBtn, fontSize: 13, textDecoration: 'none' }}>
                    サポーター登録ページ →
                  </a>
                </div>
              </div>

              <div style={{ background: '#f9f9f9', borderRadius: 8, padding: 20, marginBottom: 20, fontSize: 14, color: '#666' }}>
                <h3 style={{ fontSize: 15, marginBottom: 12, color: '#333' }}>3つのパートナータイプ</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f0f0f0' }}>
                      <Th>タイプ</Th><Th>役割</Th><Th>報酬</Th><Th>参入ハードル</Th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><Td>紹介パートナー</Td><Td>クラファン掲載候補を紹介</Td><Td>¥30,000〜50,000/件</Td><Td>登録のみ（無料）</Td></tr>
                    <tr><Td>認定アドバイザー</Td><Td>企画から支援までフルサポート</Td><Td>成功報酬10〜15%＋顧問料</Td><Td>養成講座修了</Td></tr>
                    <tr><Td>サポーター</Td><Td>PR・集客・熱量創出支援</Td><Td>成果報酬</Td><Td>説明会参加</Td></tr>
                  </tbody>
                </table>
              </div>

              {partners.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: 40, color: '#999',
                  background: '#f9f9f9', borderRadius: 8, fontSize: 14,
                }}>
                  パートナー登録データがまだありません。<br />
                  紹介コード（KAMO-XXXXXX）は登録時に自動発行され、紹介実績をトラッキングできます。
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px', fontSize: 12, color: '#666', width: 36 }}>
                        <input
                          type="checkbox"
                          checked={allPartnersSelected}
                          onChange={toggleAllPartners}
                          title="全選択"
                        />
                      </th>
                      <Th>名前</Th>
                      <Th>メール</Th>
                      <Th>タイプ</Th>
                      <Th>組織</Th>
                      <Th>紹介コード</Th>
                      <Th>ステータス</Th>
                      <Th>規約同意</Th>
                      <Th>登録日時</Th>
                      <Th>操作</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {partners.map(partner => (
                      <tr key={partner.id} style={{ borderBottom: '1px solid #eee', background: selectedPartnerIds.has(partner.id) ? '#FFF5F5' : 'transparent' }}>
                        <Td>
                          <input
                            type="checkbox"
                            checked={selectedPartnerIds.has(partner.id)}
                            onChange={() => togglePartnerSelection(partner.id)}
                          />
                        </Td>
                        <Td>{partner.name}</Td>
                        <Td>{partner.email}</Td>
                        <Td>{partnerTypeLabels[partner.partner_type || ''] || partner.partner_type || '-'}</Td>
                        <Td>{partner.organization || '-'}</Td>
                        <Td style={{ fontWeight: 700, color: '#27AE60', fontFamily: 'monospace' }}>
                          {partner.referral_code || '-'}
                        </Td>
                        <Td>{partner.status || '-'}</Td>
                        <Td>
                          {partner.terms_agreed ? (
                            <span style={{ color: '#27AE60', fontWeight: 700 }}>
                              ✅ 同意済
                              {partner.terms_agreed_at && (
                                <span style={{ display: 'block', fontSize: 11, color: '#666', fontWeight: 400 }}>
                                  {new Date(partner.terms_agreed_at).toLocaleString('ja-JP')}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span style={{ color: '#999' }}>未同意</span>
                          )}
                        </Td>
                        <Td>{new Date(partner.created_at).toLocaleString('ja-JP')}</Td>
                        <Td>
                          <button
                            onClick={() => handleDeletePartner(partner)}
                            disabled={deleting === partner.id}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 6,
                              border: '1px solid #f5c6c6',
                              background: '#fdecea',
                              color: '#d32f2f',
                              cursor: deleting === partner.id ? 'wait' : 'pointer',
                              fontSize: 12,
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                            }}>
                            {deleting === partner.id ? '削除中...' : '削除'}
                          </button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Referrals Tab — 紹介者一覧 */}
          {tab === 'referrals' && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>紹介者一覧</h2>
              <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
                紹介パートナーが登録した紹介者の一覧です（{referrals.length}件）。
              </p>
              {referrals.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>まだ紹介者の登録はありません</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                      <Th>紹介者氏名</Th>
                      <Th>ご関係</Th>
                      <Th>会社・団体</Th>
                      <Th>紹介パートナー</Th>
                      <Th>紹介コード</Th>
                      <Th>規約同意</Th>
                      <Th>登録日時</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                        <Td>{r.referred_contact_name || '-'}</Td>
                        <Td>{r.relationship || extractFromNotes(r.notes, 'ご関係') || '-'}</Td>
                        <Td>{r.referred_company_name || '-'}</Td>
                        <Td>{r.partners?.name || '-'}</Td>
                        <Td style={{ fontWeight: 700, color: '#27AE60', fontFamily: 'monospace' }}>
                          {r.partners?.referral_code || '-'}
                        </Td>
                        <Td>
                          {r.terms_agreed || extractFromNotes(r.notes, '紹介料規約に同意') ? (
                            <span style={{ color: '#27AE60', fontWeight: 700 }}>
                              ✅ 同意済
                              <span style={{ display: 'block', fontSize: 11, color: '#666', fontWeight: 400 }}>
                                {r.terms_agreed_at
                                  ? new Date(r.terms_agreed_at).toLocaleString('ja-JP')
                                  : extractFromNotes(r.notes, '紹介料規約に同意')}
                              </span>
                            </span>
                          ) : (
                            <span style={{ color: '#999' }}>未同意</span>
                          )}
                        </Td>
                        <Td>{new Date(r.created_at).toLocaleString('ja-JP')}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* AI生成結果タブ */}
          {tab === 'ai' && <AIGenerationsPanel />}
        </>
      )}

      <div style={{ marginTop: 30, padding: 16, background: '#fff3cd', borderRadius: 8, fontSize: 13, color: '#856404' }}>
        ⚠️ 削除したデータは元に戻せません。削除前に対象者へ確認を行ってください。
        / AIツールは <a href="/ai-tool" style={{ color: '#E60012' }}>こちら</a> から利用可能です。
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 6,
  border: 'none',
  background: '#E60012',
  color: '#fff',
  cursor: 'pointer',
};

const secondaryBtn: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 6,
  border: '1px solid #ddd',
  background: '#fff',
  color: '#333',
  cursor: 'pointer',
};

/** AI生成結果タブ（送信された生成内容の一覧＋詳細） */
function AIGenerationsPanel() {
  const [rows, setRows] = useState<AIGenerationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState<AIGenerationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/ai-generations');
        const data = await res.json();
        setRows(data.generations ?? []);
        if (data.needsMigration) setNotice(data.error || '保存先テーブルが未作成です');
      } catch {
        setNotice('取得に失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/ai-generations?id=${id}`);
      const data = await res.json();
      setDetail(data.generation ?? null);
    } finally {
      setDetailLoading(false);
    }
  };

  const copyDetailJSON = async () => {
    if (!detail) return;
    await navigator.clipboard.writeText(JSON.stringify(detail.page, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>読み込み中...</div>;

  return (
    <div>
      {notice && (
        <div style={{
          background: '#FFF8E1', border: '1px solid #E6D9A8', borderRadius: 8,
          padding: 16, marginBottom: 16, fontSize: 13,
        }}>
          ⚠️ {notice}
        </div>
      )}

      {detail ? (
        <div>
          <button onClick={() => setDetail(null)} style={{
            padding: '8px 16px', borderRadius: 6, border: '1px solid #ddd',
            background: '#fff', cursor: 'pointer', fontSize: 13, marginBottom: 16,
          }}>
            ← 一覧に戻る
          </button>
          {detailLoading ? (
            <div style={{ color: '#999' }}>読み込み中...</div>
          ) : (
            <div>
              <h2 style={{ fontSize: 20, margin: '0 0 4px' }}>{detail.title}</h2>
              <p style={{ color: '#666', fontSize: 14, margin: '0 0 4px' }}>{detail.subtitle}</p>
              <p style={{ color: '#999', fontSize: 13, margin: '0 0 16px' }}>
                送信日時: {formatJst(detail.created_at)} ／ 起案者: {detail.creator_name || '—'}
                {detail.organization ? `（${detail.organization}）` : ''}
                {detail.goal_amount ? ` ／ 目標金額: ¥${Number(detail.goal_amount).toLocaleString()}` : ''}
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                <button onClick={copyDetailJSON} style={{
                  padding: '10px 18px', borderRadius: 6, border: 'none',
                  background: '#E60012', color: '#fff', cursor: 'pointer', fontSize: 13,
                }}>
                  JSONをコピー
                </button>
                {copied && <span style={{ alignSelf: 'center', color: '#27AE60', fontSize: 13, fontWeight: 'bold' }}>✅ コピーしました</span>}
              </div>
              <pre style={{
                background: '#f7f7f7', border: '1px solid #e0e0e0', borderRadius: 8,
                padding: 16, fontSize: 12, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {JSON.stringify(detail.page, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999', fontSize: 14 }}>
          送信された生成結果はまだありません。
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 8, overflowX: 'auto', border: '1px solid #eee' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: '#f7f7f7', textAlign: 'left' }}>
              <tr>
                <Th>送信日時（JST）</Th>
                <Th>案件名</Th>
                <Th>起案者 / 組織</Th>
                <Th>目標金額</Th>
                <Th>生成</Th>
                <Th>詳細</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid #eee' }}>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{formatJst(r.created_at)}</td>
                  <td style={{ padding: '10px 12px' }}>{r.title}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {r.creator_name || '—'}
                    {r.organization ? <span style={{ color: '#999' }}>{` / ${r.organization}`}</span> : null}
                  </td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    {r.goal_amount ? `¥${Number(r.goal_amount).toLocaleString()}` : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#999' }}>{r.generation_mode || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <button onClick={() => openDetail(r.id)} style={{
                      padding: '6px 12px', borderRadius: 6, border: '1px solid #E60012',
                      background: '#fff', color: '#E60012', cursor: 'pointer', fontSize: 12,
                    }}>
                      表示
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface AIGenerationRow {
  id: string;
  title: string;
  subtitle: string | null;
  creator_name: string | null;
  organization: string | null;
  goal_amount: number | null;
  generation_mode: string | null;
  created_at: string;
}

interface AIGenerationDetail extends AIGenerationRow {
  page: unknown;
  hearing_input: unknown;
}

/** UTC の ISO 文字列を日本時間の表記に変換する */
function formatJst(iso: string): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso)) + ' JST';
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '10px 20px',
      border: 'none',
      borderBottom: active ? '3px solid #E60012' : '3px solid transparent',
      background: 'transparent',
      color: active ? '#E60012' : '#999',
      fontWeight: active ? 'bold' : 'normal',
      cursor: 'pointer',
      fontSize: 14,
    }}>
      {children}
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '10px 12px', fontSize: 12, color: '#666' }}>{children}</th>;
}

function Td({ children, style, title }: { children: React.ReactNode; style?: React.CSSProperties; title?: string }) {
  return <td style={{ padding: '10px 12px', ...style }} title={title}>{children}</td>;
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 14 }} />
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 14 }}>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: 40,
      color: '#999',
      background: '#f9f9f9',
      borderRadius: 8,
      fontSize: 14,
    }}>
      {message}
    </div>
  );
}
