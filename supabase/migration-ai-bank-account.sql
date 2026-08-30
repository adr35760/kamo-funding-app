-- ============================================================
-- AIクラファンページ作成ツール — 支援金振込口座の保存カラム追加
--
-- 実行方法:
--   1) Supabase ダッシュボード → 左メニュー「SQL Editor」
--   2) 「New query」に本ファイルの内容を貼り付け
--   3) 右下の「Run」を押す（数秒で完了します）
--   → 緑色で「Success. No rows returned」と出れば成功です
--
-- このSQLは ai_generations テーブルに列を1つ追加するだけです。
-- 既存のデータ（events / registrations / partners / ai_generations の
-- 既存行）は一切変更・削除されません。
-- 何度実行しても安全です（IF NOT EXISTS）。
--
-- なぜ page（掲載用JSON）と分けるのか:
--   page はJSONコピー・PDF出力にそのまま使われる「掲載用」データです。
--   口座情報をそこに混ぜると、掲載欄への貼り付けやPDFに出る経路が
--   できてしまうため、別カラムに分離して保存します。
-- ============================================================

ALTER TABLE ai_generations
  ADD COLUMN IF NOT EXISTS bank_account JSONB;

COMMENT ON COLUMN ai_generations.bank_account IS
  '支援金振込口座（銀行名/支店名/口座種別/口座番号/口座名義）。管理画面のみで表示し、掲載用JSON・PDF・AI生成には使用しない。';
