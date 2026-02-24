-- Migration: Rename ad_hoc → open_conversation session type
-- Part of conversation architecture: two-layer model with open conversation base + structured modes

-- 1. Rename existing ad_hoc sessions
UPDATE sessions SET session_type = 'open_conversation' WHERE session_type = 'ad_hoc';

-- 2. Drop old constraint, add new one with open_conversation
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_session_type_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_session_type_check
  CHECK (session_type IN (
    'life_mapping', 'weekly_checkin', 'monthly_review',
    'quarterly_review', 'open_conversation', 'close_day', 'open_day', 'quick_capture'
  ));
