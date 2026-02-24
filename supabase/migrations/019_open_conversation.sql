-- Migration: Rename ad_hoc → open_conversation session type
-- Part of conversation architecture: two-layer model with open conversation base + structured modes

-- 1. Rename existing ad_hoc sessions
UPDATE sessions SET session_type = 'open_conversation' WHERE session_type = 'ad_hoc';

-- 2. Drop the session_type check constraint (by name lookup) and recreate with open_conversation
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE rel.relname = 'sessions'
    AND nsp.nspname = 'public'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%session_type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE sessions DROP CONSTRAINT %I', constraint_name);
  END IF;
END
$$;

ALTER TABLE sessions ADD CONSTRAINT sessions_session_type_check
  CHECK (session_type IN (
    'life_mapping', 'weekly_checkin', 'monthly_review',
    'quarterly_review', 'open_conversation', 'close_day', 'open_day', 'quick_capture'
  ));
