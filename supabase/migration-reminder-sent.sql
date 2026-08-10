-- リマインドメール重複送信防止フラグ
-- Supabase SQL Editor で実行してください（既存環境への適用も冪等）:
--   ALTER TABLE registrations ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_registrations_reminder
  ON registrations(event_id, reminder_sent)
  WHERE status = 'registered';
