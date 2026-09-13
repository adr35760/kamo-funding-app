-- ============================================================
-- AIクラファンページ作成ツール — 2026-09-13 改修分のDB追加（これ1本でOK）
--
-- 実行方法:
--   1) Supabase ダッシュボード → 左メニュー「SQL Editor」
--   2) 「New query」に本ファイルの内容を**全部**貼り付け
--   3) 右下の「Run」を押す（数秒で完了します）
--   → 緑色で「Success. No rows returned」と出れば成功です
--
-- 🔴 これまでに実行していないSQLも**まとめて含めてあります**。
--    migration-ai-generations.sql / migration-ai-bank-account.sql を
--    実行済みでも未実行でも、このファイル1本を実行すれば揃います。
--    何度実行しても安全です（IF NOT EXISTS / ADD COLUMN IF NOT EXISTS）。
--
-- 既存のデータ（events / registrations / partners / ai_generations の
-- 既存行）は一切変更・削除されません。
--
-- 🔴 このSQLを実行しなくても、以下は動きます:
--    ・/ai-tool の生成
--    ・生成のたびに info@local-creation.com へ届くリマインドメール
--      （メール送信はDBと完全に独立しています）
--    実行しないと効かないのは「結果をKAMOに送信」の保存と、
--    管理画面での閲覧、メール送信ログの記録だけです。
-- ============================================================

-- ------------------------------------------------------------
-- 1) 生成結果の保存テーブル（未実行の場合はここで作られます）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  creator_name TEXT,
  -- 旧「組織名」。2026-09-13 以降は「プロジェクト実施名」が入ります
  organization TEXT,
  goal_amount BIGINT,
  generation_mode TEXT,
  hearing_input JSONB,
  page JSONB NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_generations_content_hash_key
  ON ai_generations (content_hash);

CREATE INDEX IF NOT EXISTS ai_generations_created_at_idx
  ON ai_generations (created_at DESC);

ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 2) 支援金振込口座（未実行の場合はここで追加されます）
-- ------------------------------------------------------------
ALTER TABLE ai_generations
  ADD COLUMN IF NOT EXISTS bank_account JSONB;

COMMENT ON COLUMN ai_generations.bank_account IS
  '支援金振込口座（銀行名/支店名/口座種別/口座番号/口座名義）。管理画面のみで表示し、掲載用JSON・PDF・AI生成には使用しない。';

-- ------------------------------------------------------------
-- 3) 【今回の追加】事務局提出用の連絡先
--
-- なぜ page（掲載用JSON）と分けるのか:
--   page はJSONコピー・PDF出力にそのまま使われる「掲載用」データです。
--   メールアドレスや電話番号をそこに混ぜると、掲載欄への貼り付けや
--   PDFに個人の連絡先が出る経路ができてしまうため、口座情報と同じく
--   別カラムに分離して保存します。
--
-- プロジェクト実施名とプロフィールは hearing_input（JSONB）に
-- そのまま入るため、**列の追加は不要**です。
-- ------------------------------------------------------------
ALTER TABLE ai_generations
  ADD COLUMN IF NOT EXISTS contact_email TEXT;

ALTER TABLE ai_generations
  ADD COLUMN IF NOT EXISTS contact_phone TEXT;

COMMENT ON COLUMN ai_generations.contact_email IS
  'ヒアリングで入力されたメールアドレス（事務局連絡用）。掲載用JSON・PDF・AI生成には使用しない。';

COMMENT ON COLUMN ai_generations.contact_phone IS
  'ヒアリングで入力された電話番号（事務局連絡用）。掲載用JSON・PDF・AI生成には使用しない。';

-- ------------------------------------------------------------
-- 4) 【今回の追加】AI生成リマインドメールの送信ログ
--
-- 既存の email_logs は registration_id が NOT NULL で
-- registrations(id) を参照しているため、申込に紐づかない
-- このメールは構造上入れられません。専用テーブルにします。
--
-- 未作成でもメール送信・生成には影響しません（記録だけ諦めます）。
-- 「届いていない」と言われたときに実測で答えるための記録です。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_generation_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 生成されたタイトル（どの案件の通知かを見分けるため）
  title TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('queued', 'sent', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_generation_email_logs_sent_at_idx
  ON ai_generation_email_logs (sent_at DESC);

ALTER TABLE ai_generation_email_logs ENABLE ROW LEVEL SECURITY;
