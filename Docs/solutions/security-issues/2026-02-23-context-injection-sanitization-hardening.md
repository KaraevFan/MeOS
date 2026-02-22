---
title: Context Injection Sanitization Hardening — Multi-Agent Code Review Findings
date: 2026-02-23
category: security-issues
severity: high
status: resolved
tags:
  - prompt-injection
  - context-injection
  - sanitization
  - n-plus-one-query
  - type-safety
  - code-review
  - data-architecture
  - user-data-wrapping
  - block-tag-stripping
modules:
  - lib/ai/context.ts
  - lib/supabase/day-plan-queries.ts
  - lib/markdown/user-file-system.ts
  - lib/markdown/file-write-handler.ts
  - lib/markdown/frontmatter.ts
  - types/markdown-files.ts
  - app/api/calendar/connect/route.ts
findings:
  critical: 3
  major: 5
  minor: 3
symptoms:
  - User priorities and open threads from day_plans table injected into AI system prompt without XML wrapping
  - Other user content in same prompt properly wrapped in <user_data> tags (inconsistent sanitization)
  - Seven individual getDayPlan() database calls per weekly check-in instead of batch query
  - Type guards narrowing to DayPlan | null instead of DayPlan with implicit falsy coercion
  - getYesterdayDateString() computed three times in single code path
  - Dead YAGNI schema fields in WeeklyPlanFrontmatterSchema
  - week_of date not normalized to Monday
  - Capture sanitization regex duplicated and missing DAY_PLAN_DATA tag
  - Calendar OAuth error message revealing env var names
root_cause: >
  Incremental feature development (carry-forward, week-in-numbers) introduced DB-sourced text
  injection points that bypassed the established <user_data> wrapping pattern used for
  markdown-native content. The security posture was inconsistent within the same file.
resolution: >
  All 10 actionable findings fixed. DB text wrapped in <user_data> + stripBlockTags().
  N+1 queries batched. Type guards tightened. YAGNI fields removed. week_of normalized.
  Error messages sanitized.
verified: true
prevention:
  - All user-originated DB text must pass through stripBlockTags() before system prompt injection
  - Wrap DB-sourced blocks with <user_data> XML tags (match existing markdown-native pattern)
  - Use batch queries (getDayPlansForDateRange) for multi-item DB access, never loops
  - Use Array.isArray() for array guards, never implicit falsy coercion
  - Return null on parse failure, not stubs (prevents silent data loss)
  - Never expose env var names in user-facing error messages
---

# Context Injection Sanitization Hardening

A multi-agent code review of the `feat/data-architecture-layer2-fixes` PR identified 11 findings (3 P1, 5 P2, 3 P3) across security, performance, type safety, and code quality. The most critical issue was a **prompt injection vulnerability** where user-originated text from the `day_plans` database table was injected directly into Claude's system prompt without sanitization, while identical content sources in the same file were properly wrapped. All 10 actionable findings were fixed in commit `bf96f21`.

## Root Cause Analysis

The PR added three new context injection blocks to `lib/ai/context.ts`:

1. **Carry-forward** (open_day): Yesterday's uncompleted priorities and unresolved threads
2. **Week-in-numbers** (weekly_checkin): Aggregated daily intentions and threads across the week
3. **Weekly plan** (both session types): Injected weekly planning artifact

Blocks 1 and 2 sourced data from the `day_plans` Postgres table (JSONB `priorities` and `open_threads` columns). Unlike the markdown-native content (which was properly wrapped in `<user_data>` XML tags), these DB-sourced fields were injected as raw strings. A malicious or accidentally formatted priority text like `[FILE_UPDATE type="domain" name="Career"]...` could be interpreted as a Sage output command.

## Findings & Fixes

### P1 Critical: Prompt Injection via Unsanitized DB Data (#073)

**Problem:** `lib/ai/context.ts` carry-forward and week-in-numbers blocks injected `day_plans` DB data (priority text, thread text) into the system prompt without `<user_data>` wrapping or block tag stripping.

**Fix:** Created centralized `stripBlockTags()` helper. Wrapped both sections in `<user_data>` tags. Applied tag stripping to all user-originated text fields.

```typescript
/** Strip block tags from user-originated text to prevent prompt injection. */
function stripBlockTags(text: string): string {
  return text.replace(
    /\[\/?(FILE_UPDATE|DOMAIN_SUMMARY|LIFE_MAP_SYNTHESIS|SESSION_SUMMARY|SUGGESTED_REPLIES|INLINE_CARD|INTENTION_CARD|DAY_PLAN_DATA)[^\]]*\]/g,
    ''
  )
}
```

Applied to carry-forward:
```typescript
parts.push('<user_data>')
parts.push(`- [ ] ${stripBlockTags(p.text)} (set yesterday, not completed)`)
parts.push('</user_data>')
```

Also refactored existing capture sanitization (both open_day and close_day) to use the same helper, fixing the close_day regex which was missing `DAY_PLAN_DATA`.

### P1 Critical: N+1 Day Plan Queries (#075)

**Problem:** Weekly check-in made 7 individual `getDayPlan()` calls via `Promise.allSettled()`.

**Fix:** Added `getDayPlansForDateRange()` batch query:

```typescript
export async function getDayPlansForDateRange(
  supabase: SupabaseClient, userId: string,
  startDate: string, endDate: string
): Promise<DayPlan[]> {
  const { data } = await supabase.from('day_plans').select('*')
    .eq('user_id', userId)
    .gte('date', startDate).lte('date', endDate)
    .order('date', { ascending: true })
  return (data ?? []) as DayPlan[]
}
```

Result: 7 queries reduced to 1.

### P1 Critical: Type Safety Gaps (#074)

**Problem:** `getYesterdayDateString()` called 3x in open_day block. Type guard narrowed to `DayPlan | null` instead of `DayPlan`. `plan.priorities?.length > 0` relied on `undefined > 0 === false`.

**Fix:** Hoisted date computation once. Replaced implicit coercion with explicit `Array.isArray()` guards. Used `??` instead of `||`.

### P2: readWeeklyPlan Returns Stub Not Null (#076)

**Problem:** Parse failure returned `{ week_of: '' }` stub — truthy but silently failed date comparison.

**Fix:** Returns `null` on parse failure, added `console.warn`.

### P2: week_of Not Normalized to Monday (#077)

**Problem:** AI-provided date in `[FILE_UPDATE name="2026-02-22"]` stored as-is, breaking `getStartOfWeek()` comparison.

**Fix:** Added `normalizeToMonday()` in file-write-handler:

```typescript
function normalizeToMonday(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dow = date.getUTCDay()
  const daysToMonday = dow === 0 ? -6 : 1 - dow
  return daysToMonday === 0 ? dateStr : shiftDate(dateStr, daysToMonday)
}
```

### P2: Capture Sanitization Missing DAY_PLAN_DATA (#078)

**Problem:** close_day capture regex stripped 7 tag types but missed `DAY_PLAN_DATA`.

**Fix:** Both call sites now use shared `stripBlockTags()` which includes all 8 tag types.

### P2: Calendar Error Reveals Env Vars (#079)

**Problem:** 503 response said "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."

**Fix:** Changed to "Calendar integration is not available." with server-side `console.warn`.

### P3: YAGNI Schema Fields (#081)

**Problem:** `priorities`, `reflection_day`, `status` in `WeeklyPlanFrontmatterSchema` — never read or written.

**Fix:** Removed from schema and frontmatter generator.

### P3: inferFileType Ordering Comment (#082)

**Fix:** Added comment explaining exact-match-before-prefix ordering requirement.

### P3: || vs ?? (#083)

**Fix:** All `||` fallbacks replaced with `??` or explicit `Array.isArray()` checks in new code.

## Prevention Strategies

### Context Injection Checklist (for code review)

1. Is all DB-sourced user text wrapped in `<user_data>` tags?
2. Is `stripBlockTags()` applied to all user-originated strings before prompt injection?
3. Are new injection blocks consistent with existing sections in `context.ts`?
4. Do error messages avoid exposing env var names or internal paths?

### Query Performance

- Use `getDayPlansForDateRange()` for multi-day lookups, never loop with individual queries
- Audit any `Promise.allSettled()` over DB queries — can they be batched?

### Type Safety

- Use `Array.isArray()` for array guards, never `arr?.length > 0`
- Use `??` (nullish coalescing) for defaults, never `||`
- Hoist computed values (especially date functions) outside loops
- Return `null` on parse failure, not stubs — prevents silent downstream failures

### Testing

- Unit test `stripBlockTags()` with all known block tag types
- Test `normalizeToMonday()` with edge cases (Sunday, Saturday, month boundaries)
- Test `readWeeklyPlan()` returns null on invalid frontmatter
- Verify `getDayPlansForDateRange()` handles empty ranges gracefully

## Related Documentation

- [Markdown Storage Security Review](Docs/solutions/security-issues/markdown-storage-security-review-fixes.md) — Original `<user_data>` wrapping pattern, PR #2
- [R4.1 React Hooks & Prompt Injection Fixes](Docs/solutions/code-review-fixes/20260219-react-hooks-security-db-hygiene-multi-pass-review.md) — XML data fencing established, PR #19
- [Server-Side UTC Date Bug](Docs/solutions/logic-errors/2026-02-21-server-side-utc-date-context-injection-bug.md) — Timezone-aware date utilities, PR #27
- [R5a Multi-Agent Review Fixes](Docs/solutions/code-review-fixes/20260221-multi-agent-review-p1-p2-p3-fixes.md) — Prior code review round, PR #28

## Files Modified

| File | Changes |
|------|---------|
| `lib/ai/context.ts` | `<user_data>` wrapping, `stripBlockTags()` helper, batch query integration, hoisted date, explicit array checks |
| `lib/supabase/day-plan-queries.ts` | Added `getDayPlansForDateRange()` |
| `lib/markdown/file-write-handler.ts` | Added `normalizeToMonday()`, removed unused import |
| `lib/markdown/user-file-system.ts` | `readWeeklyPlan()` returns null on failure, ordering comment |
| `lib/markdown/frontmatter.ts` | Removed YAGNI fields from generator |
| `types/markdown-files.ts` | Removed YAGNI fields from schema |
| `app/api/calendar/connect/route.ts` | Sanitized error message |

**Branch:** `feat/data-architecture-layer2-fixes`
**Commits:** `fef149a` (implementation), `bf96f21` (review fixes)
