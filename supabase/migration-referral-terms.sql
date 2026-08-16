-- ============================================
-- 紹介者登録フォーム + 紹介料規約 同意記録
-- 冪等（何度実行しても安全）
-- ============================================

-- 1) 紹介実績テーブル: ご関係・規約同意を記録
ALTER TABLE partner_referrals ADD COLUMN IF NOT EXISTS relationship TEXT;
ALTER TABLE partner_referrals ADD COLUMN IF NOT EXISTS terms_agreed BOOLEAN DEFAULT false;
ALTER TABLE partner_referrals ADD COLUMN IF NOT EXISTS terms_agreed_at TIMESTAMPTZ;

-- 紹介先企業名は任意入力に（氏名のみの登録を許可するため）
ALTER TABLE partner_referrals ALTER COLUMN referred_company_name DROP NOT NULL;

-- 2) パートナー本体: 規約同意状況を /admin で可視化するため
ALTER TABLE partners ADD COLUMN IF NOT EXISTS terms_agreed BOOLEAN DEFAULT false;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS terms_agreed_at TIMESTAMPTZ;

-- 3) 個別説明会の希望日時（前回ぶん・未実行なら一緒に適用）
ALTER TABLE partner_session_registrations ADD COLUMN IF NOT EXISTS preferred_slots TEXT;

-- 4) 参照用インデックス
CREATE INDEX IF NOT EXISTS idx_referrals_terms_agreed ON partner_referrals(terms_agreed);
CREATE INDEX IF NOT EXISTS idx_partners_terms_agreed ON partners(terms_agreed);
