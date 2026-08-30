-- ============================================================
-- AIクラファンページ作成ツール — 生成結果の保存テーブル
--
-- 実行方法:
--   1) Supabase ダッシュボード → 左メニュー「SQL Editor」
--   2) 「New query」に本ファイルの内容を貼り付け
--   3) 右下の「Run」を押す（数秒で完了します）
--
-- このSQLは既存テーブル（events / registrations / partners 等）を
-- 一切変更しません。新しいテーブルを1つ追加するだけです。
-- 未実行のままでも既存機能・AIツールの生成は動きます
-- （「結果をKAMOに送信」だけが案内メッセージを返します）。
-- 何度実行しても安全です（IF NOT EXISTS）。
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 案件名（生成されたプロジェクトタイトル）
  title TEXT NOT NULL,
  subtitle TEXT,
  -- 送信者が分かる情報（ヒアリング入力の起案者名・組織名）
  creator_name TEXT,
  organization TEXT,
  goal_amount BIGINT,
  -- 生成モード（live / mock / mock_fallback）
  generation_mode TEXT,
  -- ヒアリング入力と生成結果の全文（JSON）
  hearing_input JSONB,
  page JSONB NOT NULL,
  -- 同一内容の二重送信を防ぐための指紋（page のハッシュ）
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 二重送信防止: 同じ内容は1行しか入らない
CREATE UNIQUE INDEX IF NOT EXISTS ai_generations_content_hash_key
  ON ai_generations (content_hash);

-- 一覧の並び替え用
CREATE INDEX IF NOT EXISTS ai_generations_created_at_idx
  ON ai_generations (created_at DESC);

-- 管理画面は Basic認証 + サービスロールキー経由でのみ参照するため、
-- 匿名キーからは読めないように RLS を有効化しポリシーを作らない。
ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;
