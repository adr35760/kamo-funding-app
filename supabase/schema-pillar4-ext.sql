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
