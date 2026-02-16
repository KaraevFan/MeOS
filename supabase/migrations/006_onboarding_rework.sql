-- Onboarding Flow Rework: add display_name and session metadata
-- This migration supports:
--   1. Name collection during onboarding (display_name)
--   2. Session metadata storage for intent + mini-conversation (fixes 406 error)

-- Add display_name to users table
ALTER TABLE users ADD COLUMN display_name TEXT;

-- Add metadata JSONB to sessions table
-- This fixes the 406 error: code already reads/writes sessions.metadata
-- but the column did not exist, causing PostgREST 406 (Not Acceptable)
ALTER TABLE sessions ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;

-- No new RLS policies needed:
-- users table already has "Users can read own data" (SELECT) and
-- "Users can update own data" (UPDATE) policies that cover all columns.
-- sessions table already has equivalent policies.
