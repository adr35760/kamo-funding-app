'use client';

import { useEffect, useRef, useState } from 'react';
import '../../work.css';

/**
 * /work/login/verify?token=... — ログインリンクの着地点。
 *
 * トークンをサーバーに渡してセッションCookieを受け取り、`/work` へ進む。
 *
 * 🔴 トークンの検証は**必ずサーバー**で行う（ここは受け渡しだけ）。
 * 🔴 検証は1回しか走らせない（React の再実行でトークンを二度使うと、
 *   1回限りの仕様により2回目が失敗して「使えない」と表示されてしまう）。
 */
export default function WorkLoginVerifyPage() {
  const [state, setState] = useState<'verifying' | 'ok' | 'error'>('verifying');
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token = new URLSearchParams(window.location.search).get('token') || '';
    if (!token) {
      setState('error');
      setError('リンクが正しくありません。もう一度ログインしてください。');
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/work/login-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          setState('error');
          setError(data.error || 'このログインリンクは使えません。');
          return;
        }
        setState('ok');
        // 役割に応じた入口へ。URLからトークンを消すため replace を使う
        window.location.replace(data.user?.role === 'admin' ? '/work/admin' : '/work');
      } catch {
        setState('error');
        setError('通信に失敗しました。もう一度お試しください。');
      }
    })();
  }, []);

  return (
    <div className="work-body">
      <div className="work-header">
        <h1>業務管理システム</h1>
      </div>
      <div className="work-login-wrap">
        <div className="work-card">
          {state === 'verifying' && <p className="work-note">ログインしています...</p>}
          {state === 'ok' && <p className="work-note">ログインしました。画面を開いています...</p>}
          {state === 'error' && (
            <>
              <div className="work-error">{error}</div>
              <a className="work-name-btn" href="/work/login" style={{ textAlign: 'center' }}>
                ログイン画面に戻る
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
