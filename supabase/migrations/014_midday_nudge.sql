-- 014_midday_nudge.sql
-- Adds midday_nudge notification type, open_day/quick_capture session types,
-- timezone to push_subscriptions, and composite index for nudge dedup.

-- 1. Extend notification_type CHECK constraint to include midday_nudge
-- Use DO block to find actual constraint name (inline CHECK may have auto-generated name)
DO $$
DECLARE
  _cname text;
BEGIN
  SELECT c.conname INTO _cname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
   WHERE t.relname = 'scheduled_notifications'
     AND c.contype = 'c'
     AND pg_get_constraintdef(c.oid) ILIKE '%notification_type%'
   LIMIT 1;

  IF _cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE scheduled_notifications DROP CONSTRAINT %I', _cname);
  END IF;
END
$$;

ALTER TABLE scheduled_notifications ADD CONSTRAINT scheduled_notifications_notification_type_check
  CHECK (notification_type IN ('day_1', 'day_3', 'checkin_reminder', 'checkin_missed', 'midday_nudge'));

-- 2. Add open_day and quick_capture to session_type CHECK constraint
DO $$
DECLARE
  _cname text;
BEGIN
  SELECT c.conname INTO _cname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
   WHERE t.relname = 'sessions'
     AND c.contype = 'c'
     AND pg_get_constraintdef(c.oid) ILIKE '%session_type%'
   LIMIT 1;

  IF _cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE sessions DROP CONSTRAINT %I', _cname);
  END IF;
END
$$;

ALTER TABLE sessions ADD CONSTRAINT sessions_session_type_check
  CHECK (session_type IN (
    'life_mapping', 'weekly_checkin', 'monthly_review',
    'quarterly_review', 'ad_hoc', 'close_day', 'open_day', 'quick_capture'
  ));

-- 3. Add timezone column to push_subscriptions (for server-side scheduling)
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS timezone text;

-- 4. Composite index for nudge duplicate check
-- Table uses sent_at/cancelled_at columns for pending state (no status column)
CREATE INDEX IF NOT EXISTS idx_sched_notif_user_type_date
  ON scheduled_notifications (user_id, notification_type, scheduled_for)
  WHERE sent_at IS NULL AND cancelled_at IS NULL;
