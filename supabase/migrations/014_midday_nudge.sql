-- 014_midday_nudge.sql
-- Adds midday_nudge notification type and timezone to push_subscriptions.

-- 1. Extend notification_type CHECK constraint to include midday_nudge
ALTER TABLE scheduled_notifications DROP CONSTRAINT IF EXISTS scheduled_notifications_notification_type_check;
ALTER TABLE scheduled_notifications ADD CONSTRAINT scheduled_notifications_notification_type_check
  CHECK (notification_type IN ('day_1', 'day_3', 'checkin_reminder', 'checkin_missed', 'midday_nudge'));

-- 2. Add timezone column to push_subscriptions (for server-side scheduling)
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS timezone text;
