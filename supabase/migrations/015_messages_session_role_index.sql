-- Index on messages(session_id, role) to support queries that filter both columns together.
-- Covers:
--   • app/(main)/layout.tsx active-session check (sessions JOIN messages WHERE role = 'user')
--   • lib/supabase/home-data.ts sessions-with-user-messages query (pre-existing)
-- Without this index the FK index on session_id is used but role is filtered in memory,
-- causing an O(n) scan per session on every page navigation.
CREATE INDEX IF NOT EXISTS idx_messages_session_role
  ON messages(session_id, role);
