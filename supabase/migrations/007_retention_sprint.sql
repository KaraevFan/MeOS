-- 007_retention_sprint.sql
-- Adds ad_hoc session type, notification scheduling, reflection prompts,
-- last_active_at tracking, and fixes push_subscriptions unique constraint.

-- 1. Add ad_hoc to session_type CHECK constraint
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_session_type_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_session_type_check
  CHECK (session_type IN ('life_mapping', 'weekly_checkin', 'monthly_review', 'quarterly_review', 'ad_hoc'));

-- 2. Scheduled notifications table
CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  notification_type text NOT NULL CHECK (notification_type IN ('day_1', 'day_3', 'checkin_reminder', 'checkin_missed')),
  title text NOT NULL,
  body text NOT NULL,
  url text NOT NULL DEFAULT '/home',
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  cancelled_at timestamptz,
  gate_condition jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_pending
  ON scheduled_notifications (scheduled_for)
  WHERE sent_at IS NULL AND cancelled_at IS NULL;

ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON scheduled_notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Service role needs full access for the Edge Function
CREATE POLICY "Service role full access on scheduled_notifications"
  ON scheduled_notifications FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. Reflection prompts table
CREATE TABLE IF NOT EXISTS reflection_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  prompt_text text NOT NULL,
  context_hint text,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reflection_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own prompts"
  ON reflection_prompts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own prompts"
  ON reflection_prompts FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role needs full access for content generation API
CREATE POLICY "Service role full access on reflection_prompts"
  ON reflection_prompts FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Add last_active_at to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

-- 5. Fix push_subscriptions unique constraint (known bug — upsert fails without it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'push_subscriptions_user_endpoint_unique'
  ) THEN
    ALTER TABLE push_subscriptions
      ADD CONSTRAINT push_subscriptions_user_endpoint_unique
      UNIQUE (user_id, endpoint);
  END IF;
END $$;
