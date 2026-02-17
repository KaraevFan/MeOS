-- Add type column for distinguishing sage-generated vs system-generated reflection prompts.
-- Add unique constraint on (user_id, session_id) for upsert support.

ALTER TABLE reflection_prompts
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'system_generated';

-- Remove duplicate rows before adding unique constraint (keep the newest per user+session)
DELETE FROM reflection_prompts a
  USING reflection_prompts b
  WHERE a.user_id = b.user_id
    AND a.session_id = b.session_id
    AND a.id < b.id;

-- Allow upsert by (user_id, session_id)
ALTER TABLE reflection_prompts
  ADD CONSTRAINT reflection_prompts_user_session_unique UNIQUE (user_id, session_id);
