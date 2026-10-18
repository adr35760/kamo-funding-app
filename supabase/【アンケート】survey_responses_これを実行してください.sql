CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  satisfaction SMALLINT NOT NULL CHECK (satisfaction BETWEEN 1 AND 5),
  clarity SMALLINT NOT NULL CHECK (clarity BETWEEN 1 AND 5),
  listing_intent TEXT NOT NULL CHECK (listing_intent IN ('yes', 'considering', 'no')),
  wants_meeting BOOLEAN NOT NULL,
  wants_seminar BOOLEAN NOT NULL,
  interested_advisor BOOLEAN NOT NULL,
  comment TEXT,
  name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS wants_seminar BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS interested_advisor BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS comment TEXT;
ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS survey_responses_event_created_idx ON survey_responses (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS survey_responses_created_idx ON survey_responses (created_at DESC);

ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS survey_responses_insert_anon ON survey_responses;
CREATE POLICY survey_responses_insert_anon ON survey_responses FOR INSERT TO anon WITH CHECK (true);
