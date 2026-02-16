-- ==============================================
-- Purge all user data for a fresh onboarding test
-- ==============================================
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- Replace the UUID below with your actual user ID

DO $$
DECLARE
  target_user_id UUID := '00000000-0000-0000-0000-000000000000'; -- <-- REPLACE THIS
  deleted_files INT;
  deleted_sessions INT;
  deleted_ratings INT;
  deleted_life_maps INT;
  deleted_patterns INT;
  deleted_push_subs INT;
BEGIN
  -- 1. Delete messages (cascades from sessions, but being explicit)
  --    messages -> sessions(id) ON DELETE CASCADE, so deleting sessions handles this

  -- 2. Delete pulse check ratings
  DELETE FROM pulse_check_ratings WHERE user_id = target_user_id;
  GET DIAGNOSTICS deleted_ratings = ROW_COUNT;

  -- 3. Delete sessions (cascades to messages)
  DELETE FROM sessions WHERE user_id = target_user_id;
  GET DIAGNOSTICS deleted_sessions = ROW_COUNT;

  -- 4. Delete life maps (cascades to life_map_domains)
  DELETE FROM life_maps WHERE user_id = target_user_id;
  GET DIAGNOSTICS deleted_life_maps = ROW_COUNT;

  -- 5. Delete patterns
  DELETE FROM patterns WHERE user_id = target_user_id;
  GET DIAGNOSTICS deleted_patterns = ROW_COUNT;

  -- 6. Delete push subscriptions
  DELETE FROM push_subscriptions WHERE user_id = target_user_id;
  GET DIAGNOSTICS deleted_push_subs = ROW_COUNT;

  -- 7. Reset user record to fresh state
  UPDATE users
  SET
    onboarding_completed = false,
    display_name = NULL,
    next_checkin_at = NULL,
    sage_persona_notes = NULL
  WHERE id = target_user_id;

  -- Summary
  RAISE NOTICE '========== PURGE COMPLETE ==========';
  RAISE NOTICE 'User: %', target_user_id;
  RAISE NOTICE 'Sessions deleted (+ messages via cascade): %', deleted_sessions;
  RAISE NOTICE 'Pulse check ratings deleted: %', deleted_ratings;
  RAISE NOTICE 'Life maps deleted (+ domains via cascade): %', deleted_life_maps;
  RAISE NOTICE 'Patterns deleted: %', deleted_patterns;
  RAISE NOTICE 'Push subscriptions deleted: %', deleted_push_subs;
  RAISE NOTICE '====================================';
  RAISE NOTICE '';
  RAISE NOTICE 'MANUAL STEP REQUIRED:';
  RAISE NOTICE 'Go to Storage > user-files bucket and delete the folder:';
  RAISE NOTICE '  users/%/', target_user_id;
END $$;
