---
title: "RLS Security Hole, Idempotency Guard, Push Error Handling"
date: 2026-02-16
category: security-issues
tags:
  - rls-security
  - idempotency
  - push-subscriptions
  - edge-function
  - supabase
severity: critical
component:
  - supabase/migrations
  - app/api/session/generate-reengagement
  - supabase/functions/send-notifications
related_prs:
  - "#7"
symptom: "No user-visible symptoms — caught during post-merge code review"
root_cause: "RLS policies with USING (true) intended for service role but granting all authenticated users full table access"
---

# RLS Auth Data Leak + Reliability Fixes

## Problem

After merging PR #7 (retention sprint), code review identified three issues:

### 1. Critical: RLS Security Hole

Two RLS policies on `scheduled_notifications` and `reflection_prompts` used `USING (true) WITH CHECK (true)` for `FOR ALL` operations:

```sql
-- This was the bug
CREATE POLICY "Service role full access on scheduled_notifications"
  ON scheduled_notifications FOR ALL
  USING (true) WITH CHECK (true);
```

**The name is misleading.** Supabase service role bypasses RLS entirely at the connection level — it never evaluates policies. These policies applied to the `authenticated` role instead, granting **any authenticated user full CRUD access to all users' data** in both tables.

### 2. Important: Duplicate Content on Re-fire

The `generate-reengagement` API route had no idempotency guard. React strict mode, component remounts, or network retries could create duplicate reflection prompts and scheduled notifications for the same session.

### 3. Important: Subscription Deletion on Transient Errors

`sendWebPush` returned `boolean`. On any failure, the caller deleted the push subscription. But failures can be transient (network timeout, 503). A push service outage would wipe all subscriptions.

## Root Cause

**RLS misconception:** The assumption was "service role needs an RLS policy to access the table." In reality, service role bypasses RLS. Policies only apply to `anon` and `authenticated` roles. A policy with `USING (true)` effectively means "any authenticated user can do anything."

**Missing idempotency:** Fire-and-forget calls from client components can be re-triggered. Without a server-side dedup check, each call creates new rows.

**Binary error handling:** Conflating "subscription expired" with "push service temporarily down" leads to irreversible data loss during outages.

## Solution

### Fix 1: RLS Policy Replacement

Migration `008_fix_rls_policies.sql`:

```sql
-- Drop the permissive policies
DROP POLICY IF EXISTS "Service role full access on scheduled_notifications"
  ON scheduled_notifications;
DROP POLICY IF EXISTS "Service role full access on reflection_prompts"
  ON reflection_prompts;

-- Add scoped INSERT policies for authenticated users
CREATE POLICY "Users can insert own notifications"
  ON scheduled_notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own prompts"
  ON reflection_prompts FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### Fix 2: Idempotency Guard

In `app/api/session/generate-reengagement/route.ts`, added before generation logic:

```typescript
const { count } = await supabase
  .from('scheduled_notifications')
  .select('*', { count: 'exact', head: true })
  .eq('session_id', sessionId)

if (count && count > 0) {
  return new Response(
    JSON.stringify({ ok: true, skipped: 'already_generated' }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}
```

The `head: true` option performs a lightweight count without fetching row data.

### Fix 3: Three-State Push Result

Changed `sendWebPush` from `boolean` to a discriminated result type:

```typescript
type PushResult = 'sent' | 'expired' | 'error'

async function sendWebPush(subscription, payload): Promise<PushResult> {
  try {
    await webpush.sendNotification(subscription, payload)
    return 'sent'
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode
    if (statusCode === 410 || statusCode === 404) {
      return 'expired'  // Permanent — safe to delete
    }
    return 'error'  // Transient — leave subscription intact
  }
}
```

Caller only deletes on `'expired'`:

```typescript
if (result === 'expired') {
  await supabase.from('push_subscriptions').delete().eq('id', sub.id)
}
// 'error' — transient failure, leave subscription intact for next cron run
```

Also moved `setVapidDetails` to lazy module-scope init (called once, not per send).

## Prevention

### RLS Policy Checklist

Before writing any RLS policy:

- [ ] **Service role doesn't need policies.** It bypasses RLS. If your Edge Function uses `SUPABASE_SERVICE_ROLE_KEY`, it already has full access.
- [ ] **Never use `USING (true)` without a specific reason.** It grants access to all authenticated users.
- [ ] **Scope to ownership:** `auth.uid() = user_id` for user-owned data.
- [ ] **Scope to operation:** Use `FOR INSERT`, `FOR SELECT`, etc. — not `FOR ALL` unless every operation is needed.
- [ ] **Name policies accurately.** "Service role full access" is misleading when it applies to authenticated users.

### Idempotency Pattern for Fire-and-Forget Endpoints

Any endpoint called via fire-and-forget from the client should have a dedup check:

```typescript
// Check if already processed using a natural key (session_id, user_id, etc.)
const { count } = await supabase
  .from('target_table')
  .select('*', { count: 'exact', head: true })
  .eq('natural_key', value)

if (count && count > 0) {
  return Response.json({ ok: true, skipped: 'already_processed' })
}
```

### Error Classification for External Services

| HTTP Status | Type | Action |
|---|---|---|
| 410, 404 | Permanent | Delete/clean up resource |
| 400, 401, 403 | Permanent | Log, notify, don't retry |
| 429, 500, 502, 503, 504 | Transient | Retry later, preserve state |
| Network timeout | Transient | Retry later, preserve state |

**Never delete user data on transient errors.** Use a discriminated union type (`'sent' | 'expired' | 'error'`) instead of boolean to force callers to handle each case explicitly.

## Cross-References

- Prior security review: `Docs/solutions/security-issues/markdown-storage-security-review-fixes.md` — established deny-by-default pattern for write permissions
- CLAUDE.md: "Supabase Row Level Security (RLS) on all tables — never trust client-side auth alone"
- Migration pattern: `supabase/migrations/003_storage_bucket.sql` — correct RLS with `auth.uid()` scoping
- Migration pattern: `supabase/migrations/004_file_index.sql` — correct per-operation RLS policies
- Fix migration: `supabase/migrations/008_fix_rls_policies.sql`
