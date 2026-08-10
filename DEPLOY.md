# Vercel デプロイ手順 — KAMOファンディング 売上促進アプリ

## 前提条件
- Vercelアカウント作成済み
- Supabaseプロジェクト作成済み（URL/Key取得済み）
- OpenAI APIキー取得済み

## デプロイ手順

### 1. GitHubリポジトリにプッシュ
```bash
cd kamo-app
git init
git add .
git commit -m "Phase 1: LP + Admin + AI Tool"
git remote add origin <your-github-repo>
git push -u origin main
```

### 2. Vercelにインポート
1. https://vercel.com/new にアクセス
2. GitHubリポジトリをインポート
3. Framework Preset: Next.js（自動検出）

### 3. 環境変数を設定
Vercelプロジェクト設定 → Environment Variables に以下を追加：

| 変数名 | 値 | 说明 |
|--------|-----|------|
| `NEXT_PUBLIC_SUPABASE_URL` | SupabaseプロジェクトURL | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Supabase管理画面から取得 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Supabase管理画面から取得（※サーバー側のみ） |
| `OPENAI_API_KEY` | OpenAI APIキー | `sk-proj-...` |
| `RESEND_API_KEY` | Resend APIキー | Resendダッシュボードから取得 |
| `RESEND_FROM_EMAIL` | 送信元アドレス | `KAMOファンディング <info@local-creation.com>`（半角の`<>`） |
| `CRON_SECRET` | リマインドcron認証用の任意の長い文字列 | Vercel Cronが自動で付与するため設定必須（例: ランダム40文字） |
| `REMINDER_MODE` | （任意）リマインド方式 | `sameday`（デフォルト・Hobby用）/ `window`（Pro用） |

⚠️ **環境変数はVercelダッシュボードから直接入力** — コードやチャットに書かない。

### 3b. リマインドメール用DBマイグレーション
Supabase管理画面 → SQL Editor → `supabase/migration-reminder-sent.sql` の内容を貼り付けて実行
（`registrations` テーブルに `reminder_sent` カラムを追加。存在チェック付きなので何度実行しても安全）。

### 3c. Cron（リマインド自動配信）— Hobbyプラン設定
- `vercel.json` で `/api/cron/reminders` を **毎日 UTC 0:00（= 日本時間9:00）** で実行する設定済み（Hobbyプラン対応）。
- 動作モード（環境変数 `REMINDER_MODE`）:
  - `sameday`（デフォルト・Hobby用）: 日本時間「当日」開催の全イベントの登録者に朝一括でリマインドメールを送信
  - `window`（Pro用・切替可能）: 開催開始時刻の約15分前〜60分前に送信（`*/15 * * * *` cron と組み合わせ）
- 送信対象: `status=registered` かつ `reminder_sent=false` の申込者。送信成功後にフラグを立てて**重複送信を防止**。
- ⚠️ 注意: Hobbyプランは cron の実行時刻精度が±59分のため、日本時間9:00ちょうどに実行されない場合があります（9:00〜9:59の範囲で実行）。当日開催イベントへの送信には影響なし。

### 4. デプロイ
「Deploy」ボタンをクリック。初回デプロイは2-3分。

### 5. Supabase DBマイグレーション
Supabase管理画面 → SQL Editor → `supabase/schema.sql` の内容を貼り付けて実行。

## ビルド設定
- **Framework**: Next.js 14 (自動検出)
- **Build Command**: `next build` (デフォルト)
- **Output Directory**: `.next` (デフォルト)
- **Node.js Version**: 18.x or 20.x

## カスタムドメイン（任意）
Vercelプロジェクト設定 → Domains から追加可能。
例: `kamo-app.kamofunding.com`

## デプロイ後の確認項目
- [ ] `/` LPが表示される（Designer LP統合後）
- [ ] `/ai-tool` AIツールが動作する（mode: "live" であることを確認）
- [ ] `/admin` 管理画面が表示される
- [ ] `/api/apply` 申込フォームがSupabaseに保存される
- [ ] `/api/events` イベント一覧が取得できる
- [ ] `/api/ai/generate` OpenAI APIが呼ばれる（mode: "live"）
