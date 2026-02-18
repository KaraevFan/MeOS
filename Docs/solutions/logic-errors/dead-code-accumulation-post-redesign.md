---
title: "Dead Code Accumulation After UI Redesign: Phantom Queries in Data Fetchers"
date: 2026-02-18
category: logic-errors
tags:
  - dead-code
  - refactoring
  - performance
  - data-fetching
  - home-screen
  - validation
  - ssr-hydration
severity: high
components:
  - lib/supabase/home-data.ts
  - lib/ai/context.ts
  - lib/markdown/file-write-handler.ts
  - lib/markdown/user-file-system.ts
  - components/ui/bottom-tab-bar.tsx
  - app/api/chat/route.ts
related_issues:
  - "PR #13: feat: Close the Day - Milestone 1"
summary: |
  Home screen redesign replaced old card layout with time-aware system but the data fetcher
  continued computing ~200 LOC of unused fields with 2 sequential DB queries adding 50-150ms
  latency per page load. Multi-agent review identified this plus 6 additional issues. Fix removed
  366 lines, eliminated phantom queries, added validation, and fixed SSR patterns.
---

# Dead Code Accumulation After UI Redesign

## Problem Statement

During the "Close the Day" Milestone 1 feature for MeOS, the home screen was redesigned from a static card layout to a time-aware system with three states (morning/midday/evening). The old data fetcher (`getHomeData()` in `lib/supabase/home-data.ts`) continued computing fields the new `HomeScreen` component never consumed.

This created three categories of waste:

1. **Phantom queries**: 2 sequential DB queries for `reflection_prompts` (50-150ms latency per page load) whose results were never rendered
2. **Dead computation**: ~200 LOC extracting `northStar`, `commitments`, `boundaries`, `sageLine`, and other fields from markdown files that the new UI never read
3. **Wasted parallel slots**: 3 of 6 `Promise.allSettled` queries (`readOverview`, `readLifePlan`, `lastCheckinResult`) only fed dead fields

## Root Cause

The UI layer (`HomeScreen` component) was redesigned to be time-aware and task-focused, but the data layer (`getHomeData()`) wasn't trimmed to match. The old home page consumed `sageLine`, `northStar`, `commitments`, `boundaries`, `quarterTheme`, `quarterlyPriorities`, `daysSinceMapping`, and `reflectionNudge`. The new design only needs: `todayClosed`, `yesterdayJournalSummary`, `activeSession`, and `checkinOverdue`.

## Solution

### Investigation Steps

1. **Identify the UI contract**: Read `HomeScreen`'s `HomeScreenData` prop interface to see what fields it accepts
2. **Trace consumption**: Grep for `homeData.fieldName` in `app/(main)/home/page.tsx` to find which `HomeData` fields are passed to the component
3. **Compare interfaces**: Side-by-side `HomeData` (19 fields) vs `HomeScreenData` (12 fields) — 9 fields in HomeData never passed through
4. **Follow the extraction chain**: For each dead field, trace back to identify which queries and helpers can be removed
5. **Verify no side effects**: Grep for function names and type references across the entire project

### Changes Applied

1. Removed 9 dead fields from `HomeData` interface
2. Removed `getSageLine()` function and all dead markdown extraction code
3. Removed 2 sequential reflection nudge queries + the `ReflectionNudge` type
4. Reduced `Promise.allSettled` from 6 queries to 3
5. Net result: **-200 LOC, eliminated 50-150ms latency per home page load**

### Before

```typescript
// 6 parallel queries — 3 were dead
const [overview, lifePlan, lastCheckinResult, activeSessionResult, todayCloseDayResult, yesterdayJournalResult] =
  await Promise.allSettled([
    ufs.readOverview(),          // DEAD — only fed northStar, boundaries, daysSinceMapping
    ufs.readLifePlan(),          // DEAD — only fed commitments, quarterTheme
    supabase.from('sessions')..., // DEAD — only fed daysSinceCheckin → sageLine
    supabase.from('sessions')..., // ALIVE
    supabase.from('sessions')..., // ALIVE
    ufs.readDailyLog(yesterday),  // ALIVE
  ])

// Then 2 SEQUENTIAL queries — both dead
const { data: sageNudge } = await supabase.from('reflection_prompts')...
const nudge = sageNudge ?? (await supabase.from('reflection_prompts')...).data
```

### After

```typescript
// 3 parallel queries — all consumed by UI
const [activeSessionResult, todayCloseDayResult, yesterdayJournalResult] =
  await Promise.allSettled([
    supabase.from('sessions')...,
    supabase.from('sessions')...,
    ufs.readDailyLog(yesterday),
  ])
```

## Additional Issues Found in Same Review

### 1. Unsafe `as` Cast on AI-Generated Content

**File**: `lib/markdown/file-write-handler.ts`

```typescript
// BEFORE — AI could output any string, cast silently accepts
overrides.energy = update.attributes.energy as DailyLogFrontmatter['energy']

// AFTER — validate against allowed values first
const VALID_ENERGY = new Set<DailyLogFrontmatter['energy']>(['high', 'moderate', 'low'])
if (update.attributes?.energy && VALID_ENERGY.has(update.attributes.energy as DailyLogFrontmatter['energy'])) {
  overrides.energy = update.attributes.energy as DailyLogFrontmatter['energy']
}
```

### 2. Yesterday's Journal Context Bug

**File**: `lib/ai/context.ts`

```typescript
// BEFORE — picks newest log regardless of date (could be today's)
const lastLog = logFilenames[0]

// AFTER — skip today's log
const todayStr = new Date().toISOString().split('T')[0]
const yesterdayLog = logFilenames.find((f) => {
  const dateFromFile = f.replace('-journal.md', '')
  return dateFromFile !== todayStr
})
```

### 3. DST-Unsafe Yesterday Calculation

```typescript
// BEFORE — fails across DST transitions
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

// AFTER — handles DST, month boundaries correctly
const yesterdayDate = new Date()
yesterdayDate.setDate(yesterdayDate.getDate() - 1)
const yesterday = yesterdayDate.toISOString().split('T')[0]
```

### 4. SSR Hydration Mismatch

**File**: `components/ui/bottom-tab-bar.tsx`

```typescript
// BEFORE — getOrbHref() calls new Date().getHours() at render time
<Link href={getOrbHref()} ...>

// AFTER — useState + useEffect for SSR safety
const [hour, setHour] = useState(12) // Default to midday for SSR
useEffect(() => { setHour(new Date().getHours()) }, [])
<Link href={getOrbHref(hour)} aria-label={getOrbLabel(hour)} ...>
```

### 5. Zod Error Details Leaked to Client

```typescript
// BEFORE — schema structure exposed
return Response.json({ error: 'Invalid request', details: err.issues })

// AFTER — generic message only
return Response.json({ error: 'Invalid request' })
```

## Prevention Strategies

### Code Review Checklist

- [ ] When refactoring a UI component, audit its data fetcher in the same PR
- [ ] Verify data fetcher return type contains only fields the component reads
- [ ] Flag sequential `await` chains — ask: "Is there a data dependency, or can these be parallel?"
- [ ] Grep for all references to removed fields before deleting
- [ ] Check for `as` casts on external/AI input — validate against Set/enum first

### Anti-Patterns to Watch For

| Anti-Pattern | Signal | Fix |
|---|---|---|
| "Just in Case" Fetch | Field computed but no component destructures it | Delete it; add when actually needed |
| Bloated Return Object | Data fetcher returns 15+ fields | Audit each field's consumers |
| Cascading Query | `await q1; await q2` without dependency comment | Parallelize or add justification comment |
| Render-Time Date | `new Date()` in component body | useState + useEffect pattern |
| Blind Cast | `as SomeType` on external input | Validate with Zod/Set first |

### Quick Reference: Safe vs Unsafe Patterns

| Concern | Unsafe | Safe |
|---|---|---|
| Yesterday's date | `Date.now() - 86400000` | `d.setDate(d.getDate() - 1)` |
| Time in components | `new Date().getHours()` at render | `useState(default)` + `useEffect(detect)` |
| AI output typing | `value as EnumType` | `VALID_SET.has(value)` then cast |
| Zod errors to client | `{ details: err.issues }` | `{ error: 'Invalid request' }` |
| Parallel queries | Sequential `await` chain | `Promise.allSettled([...])` |

## Related Documentation

- [PR #13: feat: Close the Day - Milestone 1](https://github.com/KaraevFan/MeOS/pull/13)
- `docs/solutions/performance-issues/breathing-orb-optimization.md` — Related parallel query optimization pattern
- `Docs/feedback/20260218_Home_page_design.md` — Home screen design spec defining data dependencies
- `Docs/STEERING.md` — Milestone roadmap context

## Key Takeaway

**When you redesign a UI layer, the data layer must be audited in the same PR.** The type system won't catch phantom queries — a field can be computed, returned, and silently discarded without any TypeScript error. The only reliable detection method is tracing consumption from the component back to the fetcher.
