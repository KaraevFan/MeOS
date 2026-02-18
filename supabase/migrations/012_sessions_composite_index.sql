-- Composite index for common home-screen queries:
-- "has user completed close_day today?" and "latest active session"
CREATE INDEX IF NOT EXISTS idx_sessions_user_type_status_completed
  ON sessions(user_id, session_type, status, completed_at DESC);
