-- ============================================================
-- 社内業務管理システム 第1段（ログイン・タスク・やることリスト）
--   /work · /work/admin 用のテーブルを新規作成する
--
-- 実行方法:
--   1) Supabase ダッシュボード → 左メニュー「SQL Editor」
--   2) 「New query」に本ファイルの内容を貼り付け
--   3) 右下の「Run」を押す
--   → 緑色で「Success. No rows returned」と出れば成功です
--
-- 🔴 このSQLは **新しいテーブルを作るだけ** です。
--   既存の registrations / partners / listing_applications / ai_generations /
--   events には一切触りません（既存の業務データは変更・削除されません）。
--
-- 何度実行しても安全です（IF NOT EXISTS / ON CONFLICT DO NOTHING）。
-- ============================================================

-- ------------------------------------------------------------
-- 1. 利用者（4名。t iku が管理者、他3名がメンバー）
--
--   chatwork_room_id は「その人との個人チャット（1対1）」のルームID。
--   🔴 ログインリンクはここにだけ送る。通知用グループには送らない
--     （グループに送ると誰でも他人になりすませてしまう）。
--   まだ業務Botアカウントが無いため NULL。管理画面から後で入力する。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  chatwork_account_id TEXT,
  -- 個人チャット（type=direct）のルームID。ログインリンクの送信先
  chatwork_room_id TEXT,
  -- 予備手段。チャットワーク障害時に全員ログイン不能になるのを避ける
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 同姓同名を作らない（ログイン画面は名前を選ぶ方式なので重複すると選べない）
CREATE UNIQUE INDEX IF NOT EXISTS work_users_name_key ON work_users (name);

COMMENT ON COLUMN work_users.chatwork_room_id IS
  '本人との個人チャット（1対1）のルームID。ログインリンクの送信先はここだけ。通知用グループのIDを入れてはいけない（なりすまし防止）。';

-- ------------------------------------------------------------
-- 2. カテゴリ（t iku 確定の固定9種）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------
-- 3. タスク（業務指示）
--
--   状態: unaccepted（未受領）→ in_progress（対応中）→ done（完了）→ confirmed（確認済み）
--   confirmed に進められるのは admin のみ（＝報告を読んだ証跡）。判定はアプリ側で行う。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  assignee_id UUID REFERENCES work_users (id) ON DELETE SET NULL,
  category_id INTEGER REFERENCES work_categories (id) ON DELETE SET NULL,
  due_date DATE,
  -- 時刻は任意（「その日のうち」で十分なタスクが多いため）
  due_time TIME,
  priority TEXT NOT NULL DEFAULT 'mid' CHECK (priority IN ('high', 'mid', 'low')),
  status TEXT NOT NULL DEFAULT 'unaccepted'
    CHECK (status IN ('unaccepted', 'in_progress', 'done', 'confirmed')),
  created_by UUID REFERENCES work_users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  done_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  -- 完了時の一言。🔴 任意（強制すると完了ボタンが押されなくなる）
  done_comment TEXT
);

-- やることリストの既定の並び（自分の担当・未完了・期限が近い順）を速くする
CREATE INDEX IF NOT EXISTS work_tasks_assignee_status_idx
  ON work_tasks (assignee_id, status, due_date);
CREATE INDEX IF NOT EXISTS work_tasks_status_due_idx
  ON work_tasks (status, due_date);

-- ------------------------------------------------------------
-- 4. 監査ログ（誰がいつ受領・完了・確認・差し戻しを押したか）
--    タスクの現在の状態とは別に、操作の履歴を必ず残す
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_task_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES work_tasks (id) ON DELETE CASCADE,
  user_id UUID REFERENCES work_users (id) ON DELETE SET NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('created', 'accepted', 'done', 'confirmed', 'reopened')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS work_task_events_task_idx
  ON work_task_events (task_id, created_at DESC);

-- ------------------------------------------------------------
-- 5. ログイン用ワンタイムトークン
--
--   🔴 平文のトークンは絶対に保存しない。SHA-256 のハッシュだけを入れる。
--     DBが漏れてもログインには使えない状態にするため。
--   有効期限10分・1回使用で失効（used_at）。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_login_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES work_users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 検証は毎回ハッシュ1件の引き当てなので UNIQUE にしておく
CREATE UNIQUE INDEX IF NOT EXISTS work_login_tokens_hash_key
  ON work_login_tokens (token_hash);
CREATE INDEX IF NOT EXISTS work_login_tokens_user_idx
  ON work_login_tokens (user_id, created_at DESC);

COMMENT ON COLUMN work_login_tokens.token_hash IS
  'ワンタイムトークンの SHA-256 ハッシュ（16進）。平文は保存しない。';

-- ============================================================
-- 6. RLS（行レベルセキュリティ）
--
-- 🔴 方針: 業務データは**公開キー（anon key）からは一切読めない**ようにする。
--   RLS を有効にし、ポリシーを作らない = anon / authenticated では0行。
--   アプリは service role key（サーバー専用）で読み書きし、
--   「誰がどれを見られるか」は API 側でセッションを検証して判定する。
--
--   なぜポリシーで書き分けないのか:
--     ログインが Supabase Auth ではなく**自前のワンタイムリンク＋署名Cookie**なので、
--     DB 側に auth.uid() が存在しない。ポリシーに書くべき「本人」を DB が知らない。
--     ここで中途半端に anon 読み取りを許すと、ブラウザから全件読めてしまう。
--   → 第2段で Supabase Auth を併用するなら、そのときにポリシーを追加する。
-- ============================================================
ALTER TABLE work_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_task_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_login_tokens ENABLE ROW LEVEL SECURITY;

-- 念のため、過去に作られた公開ポリシーが残っていたら落とす
DROP POLICY IF EXISTS "Public read work_users" ON work_users;
DROP POLICY IF EXISTS "Public read work_tasks" ON work_tasks;

-- ============================================================
-- 7. 初期データ
-- ============================================================

-- カテゴリ9種（t iku 確定・表示順つき）
INSERT INTO work_categories (name, sort_order) VALUES
  ('KAMO運営', 1),
  ('営業', 2),
  ('セミナー及び交流会の集客', 3),
  ('イベント集客', 4),
  ('経理', 5),
  ('広報全般', 6),
  ('クラファンスクールの運営', 7),
  ('紹介制度の確立・運営・告知', 8),
  ('その他', 9)
ON CONFLICT (name) DO NOTHING;

-- 利用者4名（chatwork_room_id は業務Bot作成後に管理画面から入力する）
INSERT INTO work_users (name, role) VALUES
  ('t iku', 'admin'),
  ('生島正', 'member'),
  ('小川文代', 'member'),
  ('堺彬', 'member')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 確認用: 作成されたテーブルと初期データの件数
-- ============================================================
SELECT 'work_users' AS table_name, COUNT(*) AS rows FROM work_users
UNION ALL SELECT 'work_categories', COUNT(*) FROM work_categories
UNION ALL SELECT 'work_tasks', COUNT(*) FROM work_tasks
UNION ALL SELECT 'work_task_events', COUNT(*) FROM work_task_events
UNION ALL SELECT 'work_login_tokens', COUNT(*) FROM work_login_tokens;
