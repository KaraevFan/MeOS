-- Add close_day to session_type CHECK constraint
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_session_type_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_session_type_check
  CHECK (session_type IN (
    'life_mapping', 'weekly_checkin', 'monthly_review',
    'quarterly_review', 'ad_hoc', 'close_day'
  ));
