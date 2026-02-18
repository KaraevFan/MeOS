-- Calendar integration: store OAuth tokens for external providers
-- NOTE(security): access_token and refresh_token are stored as plaintext.
-- Acceptable for MVP behind RLS (each user can only read own row).
-- Post-MVP: encrypt tokens at rest via pgcrypto or Vault (see STEERING.md backlog).
CREATE TABLE integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL, -- 'google_calendar'
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own integrations"
  ON integrations FOR ALL USING (auth.uid() = user_id);
