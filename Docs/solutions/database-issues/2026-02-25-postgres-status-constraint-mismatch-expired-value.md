---
title: Session status CHECK constraint silently rejects 'expired' value
date: 2026-02-25
category: database-issues
severity: high
tags:
  - constraint-violation
  - silent-failure
  - type-database-mismatch
  - session-lifecycle
modules:
  - lib/ai/context.ts
  - lib/supabase/home-data.ts
  - supabase/migrations/001_initial_schema.sql
  - types/chat.ts
  - types/database.ts
symptoms:
  - "Stale session card ('Continue your evening reflection') persists on home screen for 2+ days"
  - "expireStale* UPDATE queries silently fail — no rows updated, no exception thrown"
  - "Errors logged to console.error but invisible without Vercel log inspection"
  - "Three fix attempts over 2 days failed because none checked the DB constraint"
root_cause: "Postgres CHECK constraint on sessions.status allows only ('active', 'completed', 'abandoned'), but three expiry functions set status = 'expired' — a disallowed value. TypeScript types included 'expired', masking the mismatch."
fix_type: code-change
time_to_resolve: "3 fix attempts over 2 days before root cause identified"
prevented_by:
  - "Generate TS types from DB schema (npx supabase gen types)"
  - "Throw on Supabase update errors instead of console.error"
  - "Integration tests for session expiry functions"
  - "Migration checklist requiring TS type sync"
---

# Session Status CHECK Constraint Silently Rejects 'expired' Value

## Problem

Stale session cards (e.g., "Continue your evening reflection") persisted on the home screen for 2+ days. The `expireStale*` functions in `lib/ai/context.ts` appeared to execute without errors, but database updates were silently rejected.

The Postgres `sessions` table enforces a CHECK constraint:

```sql
-- supabase/migrations/001_initial_schema.sql
status text not null check (status in ('active', 'completed', 'abandoned'))
```

All three expiry functions attempted to set `status = 'expired'` — a value **not in the constraint**:

```typescript
// lib/ai/context.ts — all three functions had this pattern
.update({ status: 'expired' })  // Postgres rejects silently
```

The TypeScript type `SessionStatus` included `'expired'`, so the type checker never flagged the mismatch:

```typescript
// types/chat.ts
export type SessionStatus = 'active' | 'completed' | 'abandoned' | 'expired'
```

## Investigation

Three approaches were tried before discovering the root cause:

### Attempt 1: Add missing expiry function (PR #33)

Created `expireStaleCloseDaySessions()` and called it from `getHomeData()`. Failed because the new function used the same `status: 'expired'` pattern — the constraint silently rejected the UPDATE.

### Attempt 2: Fix auth context (hotfix)

Refactored expiry functions to accept an optional `SupabaseClient` parameter, assuming the issue was auth context loss when creating a new client. Failed because the constraint violation is independent of which client instance is used.

### Attempt 3: Add error logging (hotfix)

Added `console.error()` calls to surface Supabase errors. The errors **were** being returned by Supabase, but:
- `console.error` in a Vercel serverless function isn't easily visible
- The function didn't throw, so execution continued normally
- The stale session remained `'active'` and kept showing on the home screen

### Root cause discovery

Read `001_initial_schema.sql` and found the CHECK constraint only allows three values. The `'expired'` value was added to TypeScript types but never to the DB constraint via a migration.

## Root Cause

**Schema-type mismatch.** The TypeScript `SessionStatus` union type was extended with `'expired'` without a corresponding migration to update the Postgres CHECK constraint. Postgres silently rejects UPDATE statements that violate CHECK constraints — the row is not modified, and Supabase returns an error object (not an exception). The error was logged but not thrown, so the calling code continued as if the update succeeded.

## Solution

Changed all three expiry functions from `'expired'` to `'abandoned'` — a value that IS in the CHECK constraint and semantically appropriate (system-triggered cleanup of stale sessions):

```typescript
// lib/ai/context.ts — before
.update({ status: 'expired' })

// lib/ai/context.ts — after
.update({ status: 'abandoned' })
```

Applied to:
- `expireStaleOpenDaySessions()`
- `expireStaleCloseDaySessions()`
- `expireStaleOpenConversations()`

Commit: `c008e41` — pushed directly to main as hotfix.

## Why Previous Fixes Failed

| Attempt | What it tried | Why it failed |
|---------|--------------|---------------|
| PR #33 | Add expiry function | Used same invalid `'expired'` status |
| Hotfix 1 | Pass authenticated client | Constraint violation is auth-independent |
| Hotfix 2 | Add console.error logging | Errors logged but not thrown; invisible in Vercel |

All three attempts addressed **how** the update was made (missing function, wrong client, no logging) but none checked **what** value was being written against **what** the database accepts.

## Prevention Strategies

### 1. Throw on Supabase errors, don't just log

```typescript
// Instead of:
if (error) console.error('[fn]', error.message)

// Do:
if (error) throw new Error(`[fn] ${error.message}`)
```

Or at minimum, check affected row count to detect silent failures.

### 2. Keep TS types in sync with DB constraints

When adding a new enum value to TypeScript types, always create a migration to add it to the corresponding CHECK constraint. The `npx supabase gen types` command can help detect drift.

### 3. Add integration tests for expiry functions

```typescript
it('expireStaleCloseDaySessions actually updates the session', async () => {
  // Create a session, backdate it, call expiry, verify status changed
  const session = await createTestSession('close_day')
  await backdateSession(session.id, '2026-02-20')
  await expireStaleCloseDaySessions(userId, 'Asia/Tokyo', supabase)
  const updated = await getSession(session.id)
  expect(updated.status).not.toBe('active')
})
```

### 4. Migration checklist for CHECK constraints

Before merging any migration that touches CHECK constraints:
- [ ] TypeScript types updated to match
- [ ] `npx supabase gen types` regenerated
- [ ] Tests cover all valid and invalid values
- [ ] SQL comment links to TypeScript type file

## Related Documents

- [React state guard race condition](../logic-errors/2026-02-24-react-state-guard-race-condition-stale-batching.md) — related session lifecycle bug fixed in same PR
- [Server-side UTC date context injection bug](../logic-errors/2026-02-21-server-side-utc-date-context-injection-bug.md) — timezone handling in same expiry code path
- [Conversation architecture type safety fixes](../code-review-fixes/2026-02-24-conversation-architecture-type-safety-fixes.md) — PR #32 review that added the expiry functions
- PR #33: Added `expireStaleCloseDaySessions` (first fix attempt)
- Commit `97b45c5`: Auth client refactor (second fix attempt)
- Commit `c008e41`: Final fix — `'abandoned'` status

## Key Takeaway

When a Supabase `.update()` silently does nothing, check the Postgres CHECK constraint. TypeScript types can diverge from DB constraints without any compile-time or runtime warning. The Supabase client returns an error object, but if you only log it (not throw), the failure is invisible.
