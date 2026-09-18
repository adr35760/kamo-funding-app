-- ============================================================
-- セキュリティ強化 2026-09-18
--
-- 目的: 「公開キー（anon key）を持っている人なら誰でも読める」状態の
--       テーブルを閉じる。
--
-- 背景:
--   これまでサイトの一部（管理画面のイベント作成）がブラウザから
--   Supabase を直接呼んでいたため、公開キーがサイトの配信ファイルに
--   含まれていた。公開キーは秘密にできない前提のものなので、
--   「キーを持っていれば読める」ポリシー自体を外す必要がある。
--   アプリ側はサーバー経由（service role）に移したので、
--   ブラウザ用の読み取り許可はもう不要。
--
-- 影響:
--   - サイトの表示・申し込みには影響しません（サーバー経由に統一済み）
--   - events の公開読み取りは残します（日程表示に使用。氏名等は含まない）
--   - 何度実行しても同じ結果になります
-- ============================================================

-- 紹介パートナーの個人情報（氏名・メール・電話）が公開キーで読めた経路を閉じる
DROP POLICY IF EXISTS "Public can verify referral code" ON partners;

-- 申込者・紹介実績・ログは service role 経由のみ（RLSは有効のまま、公開ポリシーを持たせない）
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- 掲載申込・AI生成結果は RLS 有効・ポリシー無し（= 公開キーでは読めない）
ALTER TABLE listing_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;

-- events は日程表示のため公開読み取りを維持する（個人情報を含まない）
-- 書き込みは service role のみ
DROP POLICY IF EXISTS "Admin can insert events" ON events;
DROP POLICY IF EXISTS "Admin can update events" ON events;
DROP POLICY IF EXISTS "Admin can delete events" ON events;

-- 確認用: 公開キーで読めるテーブルの一覧
--   SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname='public' ORDER BY tablename;
