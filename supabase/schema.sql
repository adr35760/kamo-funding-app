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
