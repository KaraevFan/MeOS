-- Pulse check ratings per session
CREATE TABLE pulse_check_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain_name TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('thriving', 'good', 'okay', 'struggling', 'in_crisis')),
  rating_numeric INTEGER NOT NULL CHECK (rating_numeric BETWEEN 1 AND 5),
  is_baseline BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE pulse_check_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own ratings"
  ON pulse_check_ratings FOR ALL
  USING (auth.uid() = user_id);

-- Indexes for quick lookups
CREATE INDEX idx_pulse_ratings_session ON pulse_check_ratings(session_id);
CREATE INDEX idx_pulse_ratings_user ON pulse_check_ratings(user_id);

-- Add next_checkin_at to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS next_checkin_at TIMESTAMPTZ;
