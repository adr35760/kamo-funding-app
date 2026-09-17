-- ============================================================
-- KAMOファンディング 掲載申込書（Web申込フォーム）の保存テーブル
--
-- 実行方法:
--   1) Supabase ダッシュボード → 左メニュー「SQL Editor」
--   2) 「New query」に本ファイルの内容を貼り付け
--   3) 右下の「Run」を押す（数秒で完了します）
--
-- このSQLは既存テーブル（events / registrations / partners /
-- ai_generations 等）を一切変更しません。新しいテーブルを1つ
-- 追加するだけです。
--
-- 🔴 未実行のままでも申込フォームは開けますが、**送信は保存できません**
--    （送信時に「保存先テーブルが未作成です」と案内を返します）。
--    公開前にこのSQLの実行が必要です。
--
-- 何度実行しても安全です（IF NOT EXISTS）。
-- ============================================================

CREATE TABLE IF NOT EXISTS listing_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ===== 申込者（会社） =====
  company_name TEXT NOT NULL,
  -- 役職＋氏名（申込書では1行のため1列で受ける）
  representative TEXT,
  company_postal_code TEXT,
  company_address TEXT,

  -- ===== プロジェクト担当者 =====
  contact_name TEXT NOT NULL,
  contact_department TEXT,
  contact_phone TEXT,
  contact_email TEXT NOT NULL,
  contact_postal_code TEXT,
  contact_address TEXT,

  -- ===== プロジェクト =====
  project_name TEXT,
  -- プロジェクト概要（300文字以上必須）
  project_summary TEXT,
  -- 主な販売予定品目（概要の直下・必須。2026-09-17 t iku 指定）
  selling_items TEXT,
  -- 目標達成型 / 実行確約型
  project_type TEXT,
  -- EC型は記載不要のため NULL 可
  goal_amount BIGINT,
  -- 募集希望日（日付として持たず申告文字列で保持する。
  -- 「11月中」「未定」等の自由記述が実運用で入るため）
  recruit_start_hope TEXT,
  recruit_end_hope TEXT,

  -- ===== サポート希望 =====
  -- 希望する / 希望しない
  support_hope TEXT,

  -- ===== プロジェクト資金 振込先 =====
  -- 🔴 口座情報。管理画面の一覧では「銀行名 ****下4桁」にマスクし、
  --    詳細画面でのみ全体を表示する（ai_generations.bank_account と同じ方針）。
  bank_name TEXT,
  bank_branch TEXT,
  bank_account_type TEXT,
  bank_account_number TEXT,
  bank_account_holder TEXT,

  -- ===== その他 =====
  remarks TEXT,
  agency TEXT,
  -- 出品者向け規約への同意（フォーム側で必須）
  agreed_terms BOOLEAN NOT NULL DEFAULT FALSE,

  -- 事務局の処理状況
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'in_review', 'approved', 'rejected')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 🔴 すでにこのSQLの旧版を実行してテーブルを作成済みの場合のための追補。
--
--    上の CREATE TABLE IF NOT EXISTS は「テーブルが無いときだけ」効くので、
--    **既存テーブルには新しい列が足されない**。そのため列の追加は
--    ADD COLUMN IF NOT EXISTS で別に書く必要がある。
--    （テーブルを今回初めて作る場合、ここは何もしない＝エラーにならない）
-- ============================================================

-- selling_items（主な販売予定品目）: 2026-09-17 追加
ALTER TABLE listing_applications
  ADD COLUMN IF NOT EXISTS selling_items TEXT;

CREATE INDEX IF NOT EXISTS listing_applications_created_at_idx
  ON listing_applications (created_at DESC);
CREATE INDEX IF NOT EXISTS listing_applications_status_idx
  ON listing_applications (status);

-- 一般公開キー（anon）からは読めないようにする。
-- 書き込み（申込の保存）と読み取り（管理画面）は
-- どちらもサーバー側の service_role キー経由で行う。
ALTER TABLE listing_applications ENABLE ROW LEVEL SECURITY;
