-- 自分のタスクの「想定時間」を入れる列を追加（何度実行しても安全）
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER;
NOTIFY pgrst, 'reload schema';
