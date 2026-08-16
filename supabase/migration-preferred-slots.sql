-- パートナーシップ「個別説明会（1対1）」対応
-- 希望日時（第1希望・第2希望）を保存する列を追加
-- Supabase SQL Editor で実行してください（冪等: 何度実行しても安全）

ALTER TABLE partner_session_registrations
  ADD COLUMN IF NOT EXISTS preferred_slots TEXT;

COMMENT ON COLUMN partner_session_registrations.preferred_slots
  IS '個別説明会の希望日時（第1希望 / 第2希望をまとめて保持）';
