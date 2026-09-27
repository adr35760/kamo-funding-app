-- ============================================================
-- 社内業務管理システム 第2段（日報・通知・繰り返しタスク・設定）
--
-- 実行方法:
--   1) Supabase ダッシュボード → 左メニュー「SQL Editor」
--   2) 「New query」に本ファイルの内容を貼り付け
--   3) 右下の「Run」を押す
--   → 緑色で「Success. No rows returned」と出れば成功です
--
-- 🔴 このSQLは **新しいテーブルを作る＋work_tasks に列を2つ足す**だけです。
--   既存の registrations / partners / listing_applications / ai_generations /
--   events、および第1段の work_users / work_tasks の既存データには触りません。
--
-- 何度実行しても安全です（IF NOT EXISTS / ON CONFLICT DO NOTHING）。
--
-- ※ 貼り付けが途中で切れる事故を避けたい場合は、コメントを削った
--   `migration-work-sprint2-2026-09-27-compact.sql` を使ってください（内容は同じ）。
-- ============================================================

-- ------------------------------------------------------------
-- 1. 日報
--
--   1人1日1件。date + user_id にユニーク制約を張る。
--   🔴 「本日完了した項目／対応中／期限切れ」は**保存時に自動で埋める**。
--     手で書かせると続かないため（PRDの設計思想）。
--     ただし後から見返したときに当時の内容が変わらないよう、
--     提出時点のスナップショットを JSONB で持つ。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES work_users (id) ON DELETE CASCADE,
  -- 日報の対象日（JSTの日付）
  report_date DATE NOT NULL,
  -- 手で書く欄
  comment TEXT,           -- 所感
  blockers TEXT,          -- 困っていること
  tomorrow TEXT,          -- 明日やること
  -- 自動で埋まる欄（提出時点のスナップショット）
  done_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  ongoing_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  overdue_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  submitted_at TIMESTAMPTZ,
  -- 管理者が読んだ証跡（未読を上に出すため）
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1人1日1件
CREATE UNIQUE INDEX IF NOT EXISTS work_reports_user_date_key
  ON work_reports (user_id, report_date);
-- 日付での一覧・検索を速くする
CREATE INDEX IF NOT EXISTS work_reports_date_idx
  ON work_reports (report_date DESC);

COMMENT ON COLUMN work_reports.done_tasks IS
  '提出時点のスナップショット。後から元タスクが変わっても日報の内容は変えない。';
COMMENT ON COLUMN work_reports.submitted_at IS
  'NULL = 下書き（未提出）。日付が変わっても未提出のまま残す（提出率を測るため）。';

-- ------------------------------------------------------------
-- 2. 繰り返しタスク（定例業務）の定義
--
--   毎日 / 毎週◯曜 / 毎月◯日 に work_tasks を自動生成する元になる。
--   生成は Cron（/api/work/cron/daily）が行い、二重生成は
--   work_tasks.recurrence_id + due_date のユニーク制約で防ぐ。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_task_recurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  assignee_id UUID REFERENCES work_users (id) ON DELETE SET NULL,
  category_id INTEGER REFERENCES work_categories (id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'mid' CHECK (priority IN ('high', 'mid', 'low')),
  -- daily: 毎営業日 / weekly: 毎週 weekday 曜 / monthly_end: 毎月末
  pattern TEXT NOT NULL CHECK (pattern IN ('daily', 'weekly', 'monthly_end')),
  -- weekly のとき 0=日 ... 6=土
  weekday SMALLINT CHECK (weekday IS NULL OR (weekday BETWEEN 0 AND 6)),
  -- 期限の時刻（JST）。会議のリマインドにも使う
  due_time TIME,
  -- 会議など「開始30分前に通知したい」ものに使う
  remind_minutes_before INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS work_task_recurrences_title_key
  ON work_task_recurrences (title);

-- ------------------------------------------------------------
-- 3. 設定（通知グループのroom_idなど）
--
--   環境変数ではなくテーブルにする理由:
--     room_id は **t iku が画面から何度も入れ直す可能性がある値**で、
--     環境変数だと毎回 Vercel の再デプロイが必要になる。
--     APIトークンのような秘密情報ではない（漏れてもそのグループに
--     投稿できるのは業務Botのトークンを持つ者だけ）ので、DBで持つ。
--   🔴 CHATWORK_API_TOKEN は**ここに入れない**。環境変数のみ。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE work_settings IS
  '業務管理システムの運用設定。APIトークン等の秘密情報は入れない（環境変数を使う）。';

-- ------------------------------------------------------------
-- 4. 通知の送信ログ
--
--   同じ通知を二重に飛ばさないため（朝の遅延通知・会議リマインドは
--   Cronが何度呼ばれても1日1通にする）。運用の問い合わせ調査にも使う。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'task_assigned' / 'due_tomorrow' / 'due_today' / 'overdue_digest'
  -- / 'report_submitted' / 'report_reminder' / 'meeting_reminder'
  kind TEXT NOT NULL,
  -- 二重送信を防ぐための鍵（例: 'overdue_digest:2026-09-28'）
  dedupe_key TEXT NOT NULL,
  room_id TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'skipped')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 同じ dedupe_key で「送信済み」は1件だけ
CREATE UNIQUE INDEX IF NOT EXISTS work_notifications_dedupe_key
  ON work_notifications (dedupe_key)
  WHERE status = 'sent';

CREATE INDEX IF NOT EXISTS work_notifications_created_idx
  ON work_notifications (created_at DESC);

-- ------------------------------------------------------------
-- 5. work_tasks に繰り返し由来の列を追加
--    （第1段の既存行は NULL のままで、動作に影響しません）
-- ------------------------------------------------------------
ALTER TABLE work_tasks
  ADD COLUMN IF NOT EXISTS recurrence_id UUID REFERENCES work_task_recurrences (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

-- 🔴 同じ定例が同じ期限日に二重生成されるのを防ぐ
CREATE UNIQUE INDEX IF NOT EXISTS work_tasks_recurrence_due_key
  ON work_tasks (recurrence_id, due_date)
  WHERE recurrence_id IS NOT NULL;

-- ============================================================
-- 6. RLS
--   第1段と同じ方針: RLS 有効・ポリシー無し（= anonキーでは0行）。
--   ログインが Supabase Auth ではなく自前の署名Cookieのため、
--   DB側に auth.uid() が無く「本人」を判定できない。
--   アクセス判定は API 側（requireWorkSession / requireWorkAdmin）に集約する。
-- ============================================================
ALTER TABLE work_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_task_recurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. 初期データ — 定例業務（PRD 6の確定事項）
--    担当は後から管理画面で変更できます。
-- ============================================================

-- 日報だけは「タスクとして毎日生成」せず、日報画面と21:00リマインドで回す。
-- （毎日タスクが1件増えると、やることリストが日報で埋まって本来の指示が埋もれる）

INSERT INTO work_task_recurrences (title, body, pattern, weekday, due_time, remind_minutes_before, priority)
VALUES
  ('社員会議', '毎週月曜 11:00〜。30分前に通知します。', 'weekly', 1, '11:00', 30, 'mid'),
  ('社内会議', '毎週木曜 18:00〜。30分前に通知します。', 'weekly', 4, '18:00', 30, 'mid'),
  ('流入元レポート', '先週の流入元（UTM）を確認してまとめる。', 'weekly', 1, '18:00', NULL, 'mid'),
  ('紹介実績の集計と御礼', '当月の紹介実績を集計し、紹介者へ御礼を送る。', 'monthly_end', NULL, '18:00', NULL, 'high')
ON CONFLICT (title) DO NOTHING;

-- 流入元レポートの担当は t iku（PM指示）
UPDATE work_task_recurrences
   SET assignee_id = (SELECT id FROM work_users WHERE name = 't iku' LIMIT 1)
 WHERE title = '流入元レポート'
   AND assignee_id IS NULL;

-- 通知グループのroom_idの入れ物を用意（値は管理画面から入力する）
INSERT INTO work_settings (key, value) VALUES
  ('chatwork_group_room_id', NULL)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 確認用
-- ============================================================
SELECT 'work_reports' AS table_name, COUNT(*) AS rows FROM work_reports
UNION ALL SELECT 'work_task_recurrences', COUNT(*) FROM work_task_recurrences
UNION ALL SELECT 'work_settings', COUNT(*) FROM work_settings
UNION ALL SELECT 'work_notifications', COUNT(*) FROM work_notifications;
