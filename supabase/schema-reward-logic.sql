-- KAMOファンディング — 報酬計算ロジック拡張
-- t iku確定値に基づく報酬モデル実装

-- ============================================
-- partner_referrals テーブル拡張
-- ============================================
ALTER TABLE partner_referrals ADD COLUMN IF NOT EXISTS total_support_amount INT;  -- 総支援金額（税抜）
ALTER TABLE partner_referrals ADD COLUMN IF NOT EXISTS kamo_platform_fee_rate DECIMAL DEFAULT 0.10;  -- KAMO手数料率（確定前: 10%仮置き）
ALTER TABLE partner_referrals ADD COLUMN IF NOT EXISTS advisor_reward_rate DECIMAL DEFAULT 0.20;     -- アドバイザー報酬率（KAMO手数料の20%）
ALTER TABLE partner_referrals ADD COLUMN IF NOT EXISTS referral_reward_rate DECIMAL DEFAULT 0.02;    -- 紹介パートナー紹介料率（総支援金額の2%）
ALTER TABLE partner_referrals ADD COLUMN IF NOT EXISTS consultant_fee_min INT DEFAULT 30000;          -- コンサルフィー下限
ALTER TABLE partner_referrals ADD COLUMN IF NOT EXISTS consultant_fee_max INT DEFAULT 100000;         -- コンサルフィー上限
ALTER TABLE partner_referrals ADD COLUMN IF NOT EXISTS calculated_reward INT;                         -- 自動計算された報酬額

-- ============================================
-- 報酬自動計算関数
-- ============================================
CREATE OR REPLACE FUNCTION calculate_referral_reward()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.partner_id IS NOT NULL THEN
    -- パートナータイプを取得
    DECLARE
      p_type TEXT;
    BEGIN
      SELECT partner_type INTO p_type FROM partners WHERE id = NEW.partner_id;
      
      IF p_type = 'referral' THEN
        -- 紹介パートナー: 総支援金額（税抜）× 2%
        NEW.calculated_reward := COALESCE(NEW.total_support_amount, 0) * NEW.referral_reward_rate;
        NEW.referral_reward_amount := NEW.calculated_reward;
        
      ELSIF p_type = 'advisor' THEN
        -- アドバイザー: KAMO手数料の20% + コンサルフィー
        -- KAMO手数料 = 総支援金額 × プラットフォーム手数料率
        -- アドバイザー報酬 = KAMO手数料 × 20%
        DECLARE
          kamo_fee INT;
          advisor_base_reward INT;
        BEGIN
          kamo_fee := COALESCE(NEW.total_support_amount, 0) * NEW.kamo_platform_fee_rate;
          advisor_base_reward := kamo_fee * NEW.advisor_reward_rate;
          -- コンサルフィーは別途（起案者から直接支払い）— calculated_rewardにはKAMO経由分のみ記録
          NEW.calculated_reward := advisor_base_reward;
          NEW.referral_reward_amount := advisor_base_reward;
        END;
      END IF;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガー作成（INSERT/UPDATE時に自動計算）
DROP TRIGGER IF EXISTS calculate_reward_on_insert ON partner_referrals;
CREATE TRIGGER calculate_reward_on_insert BEFORE INSERT ON partner_referrals
  FOR EACH ROW EXECUTE FUNCTION calculate_referral_reward();

DROP TRIGGER IF EXISTS calculate_reward_on_update ON partner_referrals;
CREATE TRIGGER calculate_reward_on_update BEFORE UPDATE ON partner_referrals
  FOR EACH ROW EXECUTE FUNCTION calculate_referral_reward();

-- ============================================
-- アドバイザー受講料決済管理
-- ============================================
ALTER TABLE partners ADD COLUMN IF NOT EXISTS course_fee_amount INT DEFAULT 128000;  -- 受講料¥128,000
ALTER TABLE partners ADD COLUMN IF NOT EXISTS course_payment_status TEXT DEFAULT 'unpaid'
  CHECK (course_payment_status IN ('unpaid', 'pending', 'paid', 'refunded'));
ALTER TABLE partners ADD COLUMN IF NOT EXISTS course_payment_method TEXT;  -- 'stripe', 'bank_transfer', etc.
ALTER TABLE partners ADD COLUMN IF NOT EXISTS course_payment_date TIMESTAMPTZ;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;  -- Stripe決済セッションID

-- ============================================
-- 報酬シミュレーションView
-- ============================================
CREATE OR REPLACE VIEW reward_simulation AS
SELECT
  pr.id AS referral_id,
  p.name AS partner_name,
  p.partner_type,
  pr.referred_company_name,
  pr.total_support_amount,
  pr.kamo_platform_fee_rate,
  CASE
    WHEN p.partner_type = 'referral' THEN
      pr.total_support_amount * pr.referral_reward_rate
    WHEN p.partner_type = 'advisor' THEN
      (pr.total_support_amount * pr.kamo_platform_fee_rate) * pr.advisor_reward_rate
    ELSE 0
  END AS kamo_paid_reward,
  CASE
    WHEN p.partner_type = 'advisor' THEN
      pr.consultant_fee_min
    ELSE NULL
  END AS consultant_fee_min,
  CASE
    WHEN p.partner_type = 'advisor' THEN
      pr.consultant_fee_max
    ELSE NULL
  END AS consultant_fee_max,
  CASE
    WHEN p.partner_type = 'advisor' THEN
      (pr.total_support_amount * pr.kamo_platform_fee_rate) * pr.advisor_reward_rate + pr.consultant_fee_min
    WHEN p.partner_type = 'referral' THEN
      pr.total_support_amount * pr.referral_reward_rate
    ELSE 0
  END AS total_estimated_reward
FROM partner_referrals pr
JOIN partners p ON p.id = pr.partner_id
ORDER BY pr.created_at DESC;
