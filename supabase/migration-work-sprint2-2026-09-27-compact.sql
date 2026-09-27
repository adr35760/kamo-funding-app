-- 業務管理システム 第2段（日報・通知・繰り返しタスク・設定） / コメント省略版
-- 内容は migration-work-sprint2-2026-09-27.sql と同一です。
-- SQL Editor に貼り付けて Run。何度実行しても安全です。

CREATE TABLE IF NOT EXISTS work_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES work_users (id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  comment TEXT,           -- 所感
  blockers TEXT,          -- 困っていること
  tomorrow TEXT,          -- 明日やること
  done_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  ongoing_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  overdue_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  submitted_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS work_reports_user_date_key
  ON work_reports (user_id, report_date);
CREATE INDEX IF NOT EXISTS work_reports_date_idx
  ON work_reports (report_date DESC);

COMMENT ON COLUMN work_reports.done_tasks IS
  '提出時点のスナップショット。後から元タスクが変わっても日報の内容は変えない。';
COMMENT ON COLUMN work_reports.submitted_at IS
  'NULL = 下書き（未提出）。日付が変わっても未提出のまま残す（提出率を測るため）。';

CREATE TABLE IF NOT EXISTS work_task_recurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  assignee_id UUID REFERENCES work_users (id) ON DELETE SET NULL,
  category_id INTEGER REFERENCES work_categories (id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'mid' CHECK (priority IN ('high', 'mid', 'low')),
  pattern TEXT NOT NULL CHECK (pattern IN ('daily', 'weekly', 'monthly_end')),
  weekday SMALLINT CHECK (weekday IS NULL OR (weekday BETWEEN 0 AND 6)),
  due_time TIME,
  remind_minutes_before INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS work_task_recurrences_title_key
  ON work_task_recurrences (title);

CREATE TABLE IF NOT EXISTS work_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE work_settings IS
  '業務管理システムの運用設定。APIトークン等の秘密情報は入れない（環境変数を使う）。';

CREATE TABLE IF NOT EXISTS work_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  room_id TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'skipped')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS work_notifications_dedupe_key
  ON work_notifications (dedupe_key)
  WHERE status = 'sent';

CREATE INDEX IF NOT EXISTS work_notifications_created_idx
  ON work_notifications (created_at DESC);

ALTER TABLE work_tasks
  ADD COLUMN IF NOT EXISTS recurrence_id UUID REFERENCES work_task_recurrences (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS work_tasks_recurrence_due_key
  ON work_tasks (recurrence_id, due_date)
  WHERE recurrence_id IS NOT NULL;

ALTER TABLE work_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_task_recurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_notifications ENABLE ROW LEVEL SECURITY;

INSERT INTO work_task_recurrences (title, body, pattern, weekday, due_time, remind_minutes_before, priority)
VALUES
  ('社員会議', '毎週月曜 11:00〜。30分前に通知します。', 'weekly', 1, '11:00', 30, 'mid'),
  ('社内会議', '毎週木曜 18:00〜。30分前に通知します。', 'weekly', 4, '18:00', 30, 'mid'),
  ('流入元レポート', '先週の流入元（UTM）を確認してまとめる。', 'weekly', 1, '18:00', NULL, 'mid'),
  ('紹介実績の集計と御礼', '当月の紹介実績を集計し、紹介者へ御礼を送る。', 'monthly_end', NULL, '18:00', NULL, 'high')
ON CONFLICT (title) DO NOTHING;

UPDATE work_task_recurrences
   SET assignee_id = (SELECT id FROM work_users WHERE name = 't iku' LIMIT 1)
 WHERE title = '流入元レポート'
   AND assignee_id IS NULL;

INSERT INTO work_settings (key, value) VALUES
  ('chatwork_group_room_id', NULL)
ON CONFLICT (key) DO NOTHING;

SELECT 'work_reports' AS table_name, COUNT(*) AS rows FROM work_reports
UNION ALL SELECT 'work_task_recurrences', COUNT(*) FROM work_task_recurrences
UNION ALL SELECT 'work_settings', COUNT(*) FROM work_settings
UNION ALL SELECT 'work_notifications', COUNT(*) FROM work_notifications;
