-- Rich file index table for fast metadata queries without reading files
CREATE TABLE file_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  domain_name TEXT,
  status TEXT,
  quarter TEXT,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1,
  frontmatter JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, file_path)
);

-- Indexes for common queries
-- Note: idx_file_index_type covers user_id prefix, so no separate user-only index needed
CREATE INDEX idx_file_index_type ON file_index(user_id, file_type);
CREATE INDEX idx_file_index_domain ON file_index(user_id, domain_name) WHERE domain_name IS NOT NULL;
CREATE INDEX idx_file_index_updated ON file_index(user_id, last_updated DESC);

-- RLS: Client can only SELECT (reads). All writes come from service role (server-side).
ALTER TABLE file_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_index" ON file_index
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
