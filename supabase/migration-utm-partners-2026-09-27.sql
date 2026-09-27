-- ============================================================
-- パートナー・紹介パートナー登録の流入元（UTM）記録
--   partners テーブルに3列を追加
--
-- 実行方法:
--   1) Supabase ダッシュボード → 左メニュー「SQL Editor」
--   2) 「New query」に本ファイルの内容を貼り付け
--   3) 右下の「Run」を押す（数秒で完了します）
--   → 緑色で「Success. No rows returned」と出れば成功です
--
-- このSQLは partners テーブルに列を3つ追加するだけです。
-- 既存の登録データは一切変更・削除されません（追加された列は既存行では空になります）。
-- 何度実行しても安全です（IF NOT EXISTS）。
--
-- 🔴 なぜ partners テーブルだけなのか:
--   「パートナー候補」と「紹介パートナー（サポーター）」は
--   別テーブルではなく、**同じ partners テーブル**に
--   partner_type（referral / advisor / supporter）で区別して入っている。
--   したがって1テーブルへの追加で両方の計測がまとめて通る。
--
-- 未実行のままでも登録フォームは正常に動きます
-- （その間の流入元だけが記録されず、登録自体は必ず成功します）。
-- ============================================================

ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

-- 流入元ごとの集計を速くするための索引
CREATE INDEX IF NOT EXISTS partners_utm_source_idx
  ON partners (utm_source);

COMMENT ON COLUMN partners.utm_source IS
  '登録者の流入元の媒体名（youtube / x / line 等）。小文字に正規化して保存。本人申告の source とは別物。';

COMMENT ON COLUMN partners.utm_medium IS
  '流入の種別（social / video / message / referral 等）。';

COMMENT ON COLUMN partners.utm_campaign IS
  '投稿単位の識別子（任意）。同じ媒体の複数回の告知を分けて集計するために使う。';
