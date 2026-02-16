-- 008_fix_rls_policies.sql
-- Fix overly permissive RLS policies on scheduled_notifications and reflection_prompts.
-- The "Service role full access" policies granted any authenticated user access to all rows.
-- Service role bypasses RLS entirely, so those policies only served the authenticated role.

-- 1. Drop the permissive policies
DROP POLICY IF EXISTS "Service role full access on scheduled_notifications" ON scheduled_notifications;
DROP POLICY IF EXISTS "Service role full access on reflection_prompts" ON reflection_prompts;

-- 2. Add scoped INSERT policies (the generate-reengagement API route inserts as authenticated user)
CREATE POLICY "Users can insert own notifications"
  ON scheduled_notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own prompts"
  ON reflection_prompts FOR INSERT
  WITH CHECK (auth.uid() = user_id);
