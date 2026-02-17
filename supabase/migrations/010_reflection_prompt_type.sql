-- Add type column for distinguishing sage-generated vs system-generated reflection prompts.
-- Add unique constraint on (user_id, session_id) for upsert support.

ALTER TABLE reflection_prompts
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'system_generated';

-- Allow upsert by (user_id, session_id)
ALTER TABLE reflection_prompts
  ADD CONSTRAINT reflection_prompts_user_session_unique UNIQUE (user_id, session_id);
