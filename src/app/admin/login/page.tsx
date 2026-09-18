import { isGoogleLoginConfigured } from '@/lib/admin-auth';

/**
 * /admin/login — 管理画面のログイン画面
 *
 * 🔴 このページだけは認証を通さない（ログインの入口なので middleware の
 *   保護対象から外している）。ここに個人情報は一切表示しない。
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: '管理画面ログイン | KAMOファンディング',
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  const configured = isGoogleLoginConfigured();

  return (
    <div
      style={{
        fontFamily: "'Noto Sans JP', sans-serif",
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #F4F7FC 0%, #FFFFFF 100%)',
        padding: 20,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: 40,
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 8px 40px rgba(27, 42, 74, 0.12)',
          border: '1px solid #E3E9F4',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: '#1B2A4A',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>管</span>
        </div>

        <h1 style={{ color: '#1B2A4A', fontSize: 20, fontWeight: 900, margin: '0 0 8px' }}>
          KAMOファンディング 管理画面
        </h1>

        {configured ? (
          <>
            <p style={{ color: '#666', fontSize: 13, lineHeight: 1.9, margin: '0 0 24px' }}>
              運営メンバーのGoogleアカウントでログインしてください。
              <br />
              許可されたアカウントのみご利用いただけます。
            </p>

            <a
              href="/api/admin-auth/login"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                width: '100%',
                padding: '13px',
                borderRadius: 8,
                border: '1px solid #DADCE0',
                background: '#fff',
                color: '#3C4043',
                fontSize: 15,
                fontWeight: 700,
                textDecoration: 'none',
                boxSizing: 'border-box',
              }}
            >
              {/* Google のロゴ（公式配色） */}
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.6 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-2.8-.4-4.1H24v8.2h12.5c-.3 2.1-1.6 5.2-4.7 7.3l7.6 5.9c4.5-4.2 6.7-10.3 6.7-17.3z" />
                <path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C1 16.4 0 20.1 0 24s1 7.6 2.6 10.8l7.8-6.1z" />
                <path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.4-5.6l-7.6-5.9c-2 1.4-4.7 2.4-7.8 2.4-6.4 0-11.7-3.7-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
              </svg>
              Googleでログイン
            </a>

            <p style={{ color: '#999', fontSize: 11, lineHeight: 1.8, marginTop: 20, marginBottom: 0 }}>
              受け取るのはメールアドレスのみです。
              <br />
              メール・連絡先・ファイルには一切アクセスしません。
            </p>
          </>
        ) : (
          <>
            <p style={{ color: '#666', fontSize: 13, lineHeight: 1.9, margin: '0 0 8px' }}>
              Googleログインの準備が完了していません。
            </p>
            <p style={{ color: '#999', fontSize: 12, lineHeight: 1.9, margin: 0 }}>
              設定が済むまでは、従来のパスワードでご利用いただけます。
              <br />
              <a href="/admin" style={{ color: '#1B2A4A' }}>
                管理画面を開く
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
