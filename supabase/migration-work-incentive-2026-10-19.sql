-- 業務管理システム：固定給・インセンティブ区分（t iku 指示 2026-10-19／対象は小川のみ）
-- 何度実行しても安全。既存データは変わりません。

ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS work_kind TEXT NOT NULL DEFAULT 'fixed';
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS fixed_item_code TEXT;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS incentive_code TEXT;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS unit_rate INTEGER;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS unit_count INTEGER DEFAULT 1;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS rate_percent NUMERIC(5,2);
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS sales_base INTEGER;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS deliverable TEXT;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS revision_scope TEXT;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS acceptance_criteria TEXT;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS actual_minutes INTEGER;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES work_users (id) ON DELETE SET NULL;

-- work_kind は fixed / incentive の2種類だけ
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'work_tasks_work_kind_check'
  ) THEN
    ALTER TABLE work_tasks
      ADD CONSTRAINT work_tasks_work_kind_check CHECK (work_kind IN ('fixed', 'incentive'));
  END IF;
END $$;

-- 月次の集計を速くする
CREATE INDEX IF NOT EXISTS work_tasks_kind_done_idx ON work_tasks (work_kind, done_at);
CREATE INDEX IF NOT EXISTS work_tasks_assignee_kind_idx ON work_tasks (assignee_id, work_kind);

NOTIFY pgrst, 'reload schema';
