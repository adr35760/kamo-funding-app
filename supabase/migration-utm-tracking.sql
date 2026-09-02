-- ============================================================
-- 申込の流入元（UTM）記録 — registrations に3列を追加
--
-- 実行方法:
--   1) Supabase ダッシュボード → 左メニュー「SQL Editor」
--   2) 「New query」に本ファイルの内容を貼り付け
--   3) 右下の「Run」を押す（数秒で完了します）
--   → 緑色で「Success. No rows returned」と出れば成功です
--
-- このSQLは registrations テーブルに列を3つ追加するだけです。
-- 既存の申込データは一切変更・削除されません（追加された列は既存行では空になります）。
-- 何度実行しても安全です（IF NOT EXISTS）。
--
-- ⚠️ このファイルは単独で実行してください。
--    supabase/migration-ai-bank-account.sql（AIツールの口座列追加）とは
--    別の変更なので、まとめずにそれぞれ実行してください。
--
-- 未実行のままでも申込フォームは正常に動きます
-- （その間の流入元だけが記録されず、申込自体は必ず成功します）。
-- ============================================================

ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

-- 「流入元ごとの申込人数」の集計を速くするための索引
CREATE INDEX IF NOT EXISTS registrations_utm_campaign_idx
  ON registrations (utm_campaign);

COMMENT ON COLUMN registrations.utm_source IS
  '流入元の媒体名（facebook / kamobiz / youtube 等）。小文字に正規化して保存。本人申告の referrer_source とは別物。';
COMMENT ON COLUMN registrations.utm_medium IS
  '流入の種別（organic / salon / community / paid / email 等）。小文字に正規化して保存。';
COMMENT ON COLUMN registrations.utm_campaign IS
  '投稿・配信の単位（briefing_0915 / seminar_1005 等）。どの投稿が何人連れてきたかの集計キー。';
