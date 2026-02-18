---
title: "M3 Daily Rhythm: Multi-Agent Code Review Findings & Resolution"
date: "2026-02-18"
category: code-review-fixes
problem_type: [logic_error, security_issue, type_safety, performance_issue, database_issue]
severity: p1
status: resolved
modules:
  - lib/markdown/user-file-system.ts
  - lib/ai/context.ts
  - lib/supabase/home-data.ts
  - components/home/home-screen.tsx
  - supabase/migrations/014_midday_nudge.sql
tags: [timestamp-override, prompt-injection, type-narrowing, constraint-safety, redundant-calls, migration-safety, code-review]
related_pr: "#15"
git_branch: "feat/daily-rhythm-m3"
fix_commit: "7bfe7a7"
related:
  - docs/solutions/code-review-fixes/20260218-daily-rhythm-p1-p2-p3-findings.md
  - docs/solutions/security-issues/markdown-storage-security-review-fixes.md
  - docs/solutions/security-issues/rls-auth-data-leak-fix.md
  - docs/solutions/logic-errors/dead-code-accumulation-post-redesign.md
  - docs/solutions/logic-errors/markdown-section-extraction-heading-boundary.md
---

# M3 Daily Rhythm: Multi-Agent Code Review Findings & Resolution

## Problem Statement

An 8-agent code review of the M3 daily rhythm PR (24 files, 930 insertions) identified 3 P1 bugs, 8 P2 issues, and 9 P3 items across the quick capture, AI classification, nudge scheduling, and checkin persistence features. The P1 bugs would have caused runtime errors, silent data corruption, and a prompt injection vulnerability in production.

**Review agents used:** TypeScript reviewer, Security sentinel, Performance oracle, Architecture strategist, Agent-native reviewer, Code simplicity reviewer, Data migration expert, Learnings researcher.

## Root Cause Analysis

### Bug 1: writeCapture timestamp override (P1 — data corruption)

**Location:** `lib/markdown/user-file-system.ts:430`

JavaScript object spread semantics: `{ ...overrides, timestamp }` puts the positional `timestamp` parameter (HHmmss format like `"141500"`) last, overwriting `overrides.timestamp` (ISO string like `"2026-02-18T14:15:00.000Z"`). Every capture's `frontmatter.timestamp` was silently corrupted. Downstream, `new Date("141500")` produces `Invalid Date`, breaking the time display in close_day context injection.

### Bug 2: Migration constraint name mismatch (P1 — deployment risk)

**Location:** `supabase/migrations/014_midday_nudge.sql:5`

PostgreSQL auto-generates names for inline CHECK constraints. The migration hard-coded `DROP CONSTRAINT IF EXISTS scheduled_notifications_notification_type_check`, but if the actual generated name differed, the DROP would silently no-op (due to `IF EXISTS`), and the subsequent ADD would fail with a duplicate constraint. All `midday_nudge` inserts would be silently rejected since the function is fire-and-forget.

### Bug 3: Prompt injection via capture content (P1 — security)

**Location:** `lib/ai/context.ts:213`

User-submitted capture text was interpolated directly into the close_day system prompt: `parts.push('- ${time}${mode}: "${capture.content}"')`. A user could craft content containing `[FILE_UPDATE type="overview"]...` to trick the LLM into emitting unauthorized file writes. While session-scoped write permissions limit the blast radius, the daily journal or sage context could still be corrupted.

### Bug 4: Unsafe checkinResponse type cast (P2 — type safety)

**Location:** `components/home/home-screen.tsx:266`

`data.checkinResponse as 'yes' | 'not-yet' | 'snooze' | null` bypassed TypeScript's type checking entirely. If a corrupt value appeared in frontmatter, it would flow silently into `CheckinCard` without validation.

### Bug 5: todayCaptureCount capped at 5 (P2 — logic error)

**Location:** `lib/supabase/home-data.ts:117`

`listCaptures(todayStr, 5)` returned at most 5 filenames. `todayCaptureCount = captureFilenames.length` was derived from this truncated list, so the evening sage text said "5 thoughts" even if the user had 12.

### Bug 6: Missing session types in DB constraint (P2 — schema drift)

**Location:** `supabase/migrations/011_close_day_session.sql`

TypeScript `SessionType` included `open_day | quick_capture` but the PostgreSQL CHECK constraint stopped at `close_day`. Inserting `open_day` sessions would fail at the database layer.

### Bug 7: Redundant listCaptures API call (P2 — performance)

**Location:** `lib/ai/context.ts:208`

`listCaptures(todayStr)` was called a second time without a limit just to get `.length` for a total count — an extra 50-100ms Supabase Storage round-trip on every close_day context build.

## Working Solutions

### Fix 1: Rename parameter to avoid spread collision

```typescript
// Before (bug):
async writeCapture(date: string, timestamp: string, content: string, overrides?) {
    const frontmatter = generateCaptureFrontmatter(date, { ...overrides, timestamp })
    const filename = `${date}-${timestamp}.md`

// After (fix):
async writeCapture(date: string, timeCode: string, content: string, overrides?) {
    const frontmatter = generateCaptureFrontmatter(date, overrides)
    const filename = `${date}-${timeCode}.md`
```

The `timestamp` property is now set only by `generateCaptureFrontmatter()` via `overrides`, preventing the HHmmss collision.

### Fix 2: Query constraint by definition, not assumed name

```sql
DO $$
DECLARE _cname text;
BEGIN
  SELECT c.conname INTO _cname
    FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid
   WHERE t.relname = 'scheduled_notifications'
     AND c.contype = 'c'
     AND pg_get_constraintdef(c.oid) ILIKE '%notification_type%'
   LIMIT 1;
  IF _cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE scheduled_notifications DROP CONSTRAINT %I', _cname);
  END IF;
END $$;
```

This approach matches the constraint by its logical definition rather than relying on PostgreSQL's internal naming scheme.

### Fix 3: Strip block tags before LLM injection

```typescript
const sanitized = capture.content.replace(
  /\[\/?(FILE_UPDATE|DOMAIN_SUMMARY|LIFE_MAP_SYNTHESIS|SESSION_SUMMARY)[^\]]*\]/g, ''
)
parts.push(`- ${time}${mode}: "${sanitized}"`)
```

### Fix 4: Narrow type at the data layer with runtime validation

```typescript
// In home-data.ts — validate before assignment:
const rawCheckin = todayDayPlanResult.value.frontmatter.checkin_response
checkinResponse = rawCheckin === 'yes' || rawCheckin === 'not-yet' || rawCheckin === 'snooze'
  ? rawCheckin : null

// In interfaces — use the narrow type:
checkinResponse: 'yes' | 'not-yet' | 'snooze' | null
```

### Fix 5: Fetch all filenames for count, read only first N

```typescript
ufs.listCaptures(todayStr),  // no limit — accurate count
// ...
todayCaptureCount = captureFilenames.length  // true total
captureFilenames.slice(0, 5).map(...)  // only read 5 for display
```

### Fix 6: Add missing session types to constraint

Applied the same defensive PL/pgSQL pattern to the sessions table, adding `open_day` and `quick_capture`.

### Fix 7: Remove redundant API call

Replaced `await ufs.listCaptures(todayStr).then(f => f.length)` with `validCaptures.length`.

## Prevention Strategies

### Code Review Checklist

- [ ] No parameter names that collide with spread object keys — rename to avoid silent override
- [ ] All external data (Supabase, API responses) passed through `safeParse()` — no bare `as` casts
- [ ] User content sanitized before LLM prompt injection — strip block tags at minimum
- [ ] Database CHECK constraints include all values from TypeScript union types
- [ ] Migration constraint operations use `pg_constraint` lookup, not assumed names
- [ ] COUNT values derived from unbounded queries, not from `.length` on limited results
- [ ] No redundant API calls — check if data is already available in scope before fetching

### Reusable Patterns

**Defensive constraint management in PostgreSQL migrations:**

Always query `pg_constraint` by definition to find the actual constraint name. Handles inline CHECK constraints with auto-generated names, name collisions, and version differences.

**Sanitize user content before LLM injection:**

Strip structured output block tags (`[FILE_UPDATE]`, `[DOMAIN_SUMMARY]`, etc.) from any user-generated text before interpolating into system prompts.

**Validate union types at the data layer:**

Never use `as` casts to narrow types from external data. Validate at the data extraction point with explicit value checks or Zod schemas. The narrow type then flows cleanly to all consumers.

**Separate count from display limit:**

When a query needs both a count (for UI text) and a limited result set (for display), fetch without limit for count, then `.slice()` for display. Or use Supabase `{ count: 'exact', head: true }` for count-only queries.

## Cross-References

- [M2 Code Review Findings](./20260218-daily-rhythm-p1-p2-p3-findings.md) — Previous review cycle (regex `lastIndex`, side effects, Zod validation)
- [Markdown Storage Security Review](../security-issues/markdown-storage-security-review-fixes.md) — Deny-by-default write permissions, path traversal prevention
- [RLS Auth Data Leak Fix](../security-issues/rls-auth-data-leak-fix.md) — RLS policy patterns, idempotency guards
- [Dead Code Accumulation](../logic-errors/dead-code-accumulation-post-redesign.md) — Phantom queries, data fetcher audit pattern
- [Markdown Section Extraction](../logic-errors/markdown-section-extraction-heading-boundary.md) — Heading-level assumptions in parsers
