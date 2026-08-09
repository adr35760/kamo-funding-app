-- KAMOファンディング 売上促進プロジェクト — DB Schema
-- Phase 1: Events + Registrations + Email Logs
-- Run this in Supabase SQL Editor

-- ============================================
-- Events Table
-- ============================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('seminar', 'info_session', 'networking')),
  pillar INT NOT NULL CHECK (pillar BETWEEN 1 AND 4),
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 90,
  location TEXT,
  capacity INT,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('draft', 'upcoming', 'live', 'completed', 'cancelled')),
  streaming_url TEXT,
  streaming_platform TEXT CHECK (streaming_platform IN ('zoom', 'youtube') OR streaming_platform IS NULL),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Registrations Table
-- ============================================
CREATE TABLE registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  referrer_source TEXT,
  challenge_description TEXT,           -- 本業の課題（営業インテリジェンス）
  partner_referral_code TEXT,            -- Phase 3用
  status TEXT DEFAULT 'registered' CHECK (status IN ('registered', 'attended', 'no_show', 'cancelled', 'surveyed')),
  survey_response JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, email)
);

CREATE INDEX idx_registrations_event_id ON registrations(event_id);
CREATE INDEX idx_registrations_email ON registrations(email);
CREATE INDEX idx_registrations_status ON registrations(status);

-- ============================================
-- Email Logs Table
-- ============================================
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  template_type TEXT NOT NULL CHECK (template_type IN ('confirmation', 'reminder', 'pre_material', 'survey')),
  sent_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'sent' CHECK (status IN ('queued', 'sent', 'failed')),
  error_message TEXT
);

CREATE INDEX idx_email_logs_registration_id ON email_logs(registration_id);

-- ============================================
-- Updated_at trigger (auto-update on row change)
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER registrations_updated_at BEFORE UPDATE ON registrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Public can read events (to show on LP)
CREATE POLICY "Events are publicly readable" ON events
  FOR SELECT USING (true);

-- Public can insert registrations (from LP form)
CREATE POLICY "Public can register" ON registrations
  FOR INSERT WITH CHECK (true);

-- Only authenticated (admin) can read/update/delete registrations
CREATE POLICY "Admin can read registrations" ON registrations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admin can update registrations" ON registrations
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Admin can delete registrations" ON registrations
  FOR DELETE USING (auth.role() = 'authenticated');

-- Only admin can manage events
CREATE POLICY "Admin can insert events" ON events
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admin can update events" ON events
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Admin can delete events" ON events
  FOR DELETE USING (auth.role() = 'authenticated');

-- Email logs: admin only
CREATE POLICY "Admin can manage email logs" ON email_logs
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- KPI Aggregation View (Phase 2で有効化)
-- ============================================
CREATE OR REPLACE VIEW monthly_kpi AS
SELECT
  DATE_TRUNC('month', e.event_date) AS month,
  e.pillar,
  e.type,
  COUNT(DISTINCT r.id) AS registrations,
  COUNT(DISTINCT CASE WHEN r.status = 'attended' THEN r.id END) AS attendees,
  ROUND(
    COUNT(DISTINCT CASE WHEN r.status = 'attended' THEN r.id END)::numeric /
    NULLIF(COUNT(DISTINCT r.id), 0) * 100, 1
  ) AS attendance_rate
FROM events e
LEFT JOIN registrations r ON r.event_id = e.id
GROUP BY 1, 2, 3
ORDER BY 1 DESC;

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

-- KAMOファンディング — Pillar 4 追加カラム
-- Designer LPのフォームフィールドに対応するための拡張

-- partners テーブルに追加カラム
ALTER TABLE partners ADD COLUMN IF NOT EXISTS profession TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS program_interest TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS support_preference TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS sns TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS message TEXT;

-- 説明会申込用テーブル（説明会LPのフォーム用 — 既存registrationsと別管理）
CREATE TABLE IF NOT EXISTS partner_session_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  profession TEXT,                          -- 職業・専門分野
  program_interest TEXT,                     -- 興味のあるプログラム (referral/advisor/supporter)
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  message TEXT,
  status TEXT DEFAULT 'registered' CHECK (status IN ('registered', 'attended', 'no_show', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(email)
);

CREATE INDEX IF NOT EXISTS idx_psr_email ON partner_session_registrations(email);

CREATE TRIGGER partner_session_registrations_updated_at BEFORE UPDATE ON partner_session_registrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE partner_session_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can register for session" ON partner_session_registrations
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can manage session registrations" ON partner_session_registrations
  FOR ALL USING (auth.role() = 'authenticated');

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
