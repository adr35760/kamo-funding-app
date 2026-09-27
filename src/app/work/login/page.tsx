'use client';

import { useEffect, useState } from 'react';
import '../work.css';

/**
 * /work/login — 名前を選ぶだけのログイン画面。
 *
 * メールもパスワードも入力させない（メンバー2名がGoogleアカウントを持っていないため）。
 * 名前を押すと、その人のチャットワーク個人チャットにワンタイムリンクが届く。
 *
 * 🔴 ここで扱うのは id と name だけ。役割やルームIDは取得しない
 *   （ログイン前の画面に業務情報を出さない）。
 */

interface NameOption {
  id: string;
  name: string;
}

export default function WorkLoginPage() {
  const [users, setUsers] = useState<NameOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  // 🔴 チャットワーク未設定のときだけサーバーが返す開発用リンク（第2段で削除）
  const [devUrl, setDevUrl] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/work/users?for=login', { cache: 'no-store' });
        const data = await res.json();
        setUsers(Array.isArray(data.users) ? data.users : []);
      } catch {
        setError('利用者の一覧を取得できませんでした。通信状況をご確認ください。');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const requestLink = async (user: NameOption) => {
    setSending(user.id);
    setMessage('');
    setError('');
    setDevUrl('');
    try {
      const res = await fetch('/api/work/login-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'ログインリンクの送信に失敗しました');
      }
      setMessage(data.message || 'ログインリンクを送信しました。');
      if (data.devLoginUrl) setDevUrl(data.devLoginUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'ログインリンクの送信に失敗しました');
    } finally {
      setSending('');
    }
  };

  return (
    <div className="work-body">
      <div className="work-header">
        <h1>業務管理システム</h1>
      </div>

      <div className="work-login-wrap">
        <div className="work-card">
          <h2>お名前を選んでください</h2>
          <p className="work-note">
            選ぶと、チャットワークの個人チャット（1対1）にログイン用のリンクが届きます。
            パスワードの入力は不要です。リンクは10分間・1回だけ有効です。
          </p>

          {loading ? (
            <p className="work-note">読み込み中...</p>
          ) : users.length === 0 ? (
            <p className="work-note">
              利用者が登録されていません。マイグレーションSQLの実行が必要です。
            </p>
          ) : (
            users.map(u => (
              <button
                key={u.id}
                className="work-name-btn"
                onClick={() => requestLink(u)}
                disabled={sending !== ''}
              >
                {sending === u.id ? '送信中...' : u.name}
              </button>
            ))
          )}

          {message && (
            <p className="work-note" style={{ color: '#1f7a3d', fontWeight: 700, marginTop: 14 }}>
              {message}
            </p>
          )}
          {error && <div className="work-error">{error}</div>}

          {devUrl && (
            /* 🔴 開発用の表示。CHATWORK_API_TOKEN 設定後は出ない。第2段でこのブロックを削除する */
            <div className="work-devlink">
              <strong>開発用リンク（チャットワーク未設定）</strong>
              <p style={{ margin: '6px 0' }}>
                チャットワークの設定が終わると、この表示は出なくなります。
              </p>
              <a href={devUrl}>このリンクでログイン</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
