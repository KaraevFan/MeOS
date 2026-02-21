-- Add timezone column to users table for timezone-aware date computation.
-- Populated by client-side detection (Intl.DateTimeFormat().resolvedOptions().timeZone).
-- Nullable: graceful fallback to UTC if not yet set.
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT NULL;
COMMENT ON COLUMN users.timezone IS 'IANA timezone identifier (e.g., Asia/Tokyo). Set by client, used for server-side date computation.';
