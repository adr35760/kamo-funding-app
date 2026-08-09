'use client';

import { useState, useEffect } from 'react';

interface Event {
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

export default function AdminPage() {
  const [tab, setTab] = useState<'events' | 'registrations' | 'partners'>('events');
  const [events, setEvents] = useState<Event[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEventForm, setShowEventForm] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>('');

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
    // TODO: Supabaseからデータ取得（未接続時は空配列）
    // const { data: eventsData } = await supabase.from('events').select('*').order('event_date');
    // const { data: regsData } = await supabase.from('registrations').select('*').order('created_at', { ascending: false });
    // setEvents(eventsData || []);
    // setRegistrations(regsData || []);
    setLoading(false);
  };

  const handleCreateEvent = async () => {
    // TODO: Supabase接続後に有効化
    // await supabaseAdmin.from('events').insert({
    //   title: newEvent.title,
    //   type: newEvent.type,
    //   pillar: Number(newEvent.pillar),
    //   event_date: new Date(newEvent.event_date).toISOString(),
    //   location: newEvent.location || null,
    //   capacity: newEvent.capacity ? Number(newEvent.capacity) : null,
    //   streaming_url: newEvent.streaming_url || null,
    //   streaming_platform: newEvent.streaming_platform || null,
    //   status: 'upcoming',
    // });
    // fetchData();
    // setShowEventForm(false);
    alert('Supabase接続後に有効化されます');
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

  return (
    <div style={{ fontFamily: "'Noto Sans JP', sans-serif", maxWidth: 1100, margin: '0 auto', padding: 20 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: '#E60012', fontSize: 24, margin: '0 0 4px' }}>
          KAMOファンディング 管理画面
        </h1>
        <p style={{ color: '#999', fontSize: 13 }}>説明会・セミナー管理 + 申込者一覧</p>
      </div>

      {/* Quick Links */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <a href="/ai-tool" style={{
          padding: '8px 16px', background: '#E60012', color: '#fff', borderRadius: 6, fontSize: 13,
        }}>
          🔥 AIクラファン支援ツール
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
                        <Td>{new Date(ev.event_date).toLocaleString('ja-JP')}</Td>
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
                      <Th>名前</Th>
                      <Th>メール</Th>
                      <Th>会社</Th>
                      <Th>参加経路</Th>
                      <Th>挑戦内容</Th>
                      <Th>ステータス</Th>
                      <Th>申込日時</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRegs.map(reg => (
                      <tr key={reg.id} style={{ borderBottom: '1px solid #eee' }}>
                        <Td>{reg.name}</Td>
                        <Td>{reg.email}</Td>
                        <Td>{reg.company || '-'}</Td>
                        <Td>{reg.referrer_source || '-'}</Td>
                        <Td style={{ maxWidth: 200, color: '#E60012', cursor: 'help' }}
                          title={reg.challenge_description || ''}>
                          {reg.challenge_description ? reg.challenge_description.slice(0, 40) + '...' : '-'}
                        </Td>
                        <Td>{reg.status}</Td>
                        <Td>{new Date(reg.created_at).toLocaleString('ja-JP')}</Td>
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

              <div style={{
                textAlign: 'center', padding: 40, color: '#999',
                background: '#f9f9f9', borderRadius: 8, fontSize: 14,
              }}>
                パートナー登録データがSupabase接続後に表示されます。<br />
                紹介コード（KAMO-XXXXXX）が自動発行され、紹介実績をトラッキングできます。
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 30, padding: 16, background: '#fff3cd', borderRadius: 8, fontSize: 13, color: '#856404' }}>
        ⚠️ Supabase接続設定（環境変数）が完了すると、データの取得・保存が有効になります。
        現在はUIプレビュー状態です。 / AIツールは <a href="/ai-tool" style={{ color: '#E60012' }}>こちら</a> から利用可能です（モック応答で動作確認できます）。
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
