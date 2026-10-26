ALTER TABLE registrations ADD COLUMN IF NOT EXISTS referral_code TEXT;

CREATE INDEX IF NOT EXISTS registrations_referral_code_idx ON registrations (referral_code);
