-- KAMOファンディング — Pillar 4 パートナー・サポーター管理 DB Schema
-- Phase 3拡張 — 既存schema.sqlに追加

-- ============================================
-- Partners Table（紹介パートナー・アドバイザー・サポーター）
-- ============================================
CREATE TABLE partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  organization TEXT,
  partner_type TEXT NOT NULL CHECK (partner_type IN ('referral', 'advisor', 'supporter')),
  referral_code TEXT UNIQUE NOT NULL,           -- 自動発行（例: KAMO-XXXXXX）
  status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'completed', 'suspended')),
  
  -- 紹介パートナー用
  network_description TEXT,                      -- ネットワーク・得意分野
  
  -- アドバイザー用
  advisor_course_status TEXT CHECK (advisor_course_status IN (NULL, 'enrolled', 'completed', 'certified')),
  advisor_course_progress INT DEFAULT 0,         -- 0-6 (全6回)
  
  -- サポーター用
  supporter_motivation TEXT,                     -- 参加動機
  
  -- 共通
  notes TEXT,
  registered_event_id UUID REFERENCES events(id) ON DELETE SET NULL,  -- 説明会経由登録
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_partners_referral_code ON partners(referral_code);
CREATE INDEX idx_partners_email ON partners(email);
CREATE INDEX idx_partners_type ON partners(partner_type);
CREATE INDEX idx_partners_status ON partners(status);

-- ============================================
-- Partner Referrals Table（紹介実績トラッキング）
-- ============================================
CREATE TABLE partner_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  referred_company_name TEXT NOT NULL,            -- 紹介先企業名
  referred_contact_name TEXT,                     -- 紹介先担当者名
  referred_email TEXT,                            -- 紹介先メール
  status TEXT DEFAULT 'introduced' CHECK (status IN ('introduced', 'contacted', 'applied', 'listed', 'completed', 'rejected')),
  referral_reward_amount INT,                     -- 報酬額（掲載完了時に確定）
  reward_status TEXT CHECK (reward_status IN (NULL, 'pending', 'paid')),
  listed_project_id TEXT,                         -- KAMOに掲載された場合のプロジェクトID
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_referrals_partner_id ON partner_referrals(partner_id);
CREATE INDEX idx_referrals_status ON partner_referrals(status);

-- ============================================
-- updated_at トリガー
-- ============================================
CREATE TRIGGER partners_updated_at BEFORE UPDATE ON partners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER partner_referrals_updated_at BEFORE UPDATE ON partner_referrals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS ポリシー
-- ============================================
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_referrals ENABLE ROW LEVEL SECURITY;

-- 公開側: パートナー登録（INSERT only）
CREATE POLICY "Public can register as partner" ON partners
  FOR INSERT WITH CHECK (true);

-- 公開側: 紹介コードで自分の情報を確認（SELECT by referral_code）
CREATE POLICY "Public can verify referral code" ON partners
  FOR SELECT USING (true);

-- Admin only: full access
CREATE POLICY "Admin can manage partners" ON partners
  FOR ALL USING (auth.role() = 'authenticated');

-- 紹介実績: admin only
CREATE POLICY "Admin can manage referrals" ON partner_referrals
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- パートナー別KPI View
-- ============================================
CREATE OR REPLACE VIEW partner_kpi AS
SELECT
  p.id,
  p.name,
  p.partner_type,
  p.referral_code,
  p.status,
  COUNT(DISTINCT pr.id) AS total_referrals,
  COUNT(DISTINCT CASE WHEN pr.status = 'completed' THEN pr.id END) AS completed_referrals,
  COALESCE(SUM(CASE WHEN pr.status = 'completed' THEN pr.referral_reward_amount ELSE 0 END), 0) AS total_reward_earned
FROM partners p
LEFT JOIN partner_referrals pr ON pr.partner_id = p.id
GROUP BY p.id, p.name, p.partner_type, p.referral_code, p.status
ORDER BY total_referrals DESC;
