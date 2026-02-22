---
status: complete
priority: p1
issue_id: "075"
tags: [code-review, performance, database, supabase]
dependencies: []
---

# 075 — N+1 day plan queries in weekly_checkin "Week in Numbers" block

## Problem Statement

In `lib/ai/context.ts`, the weekly_checkin "Week in Numbers" block makes 7 individual `getDayPlan(userId, dateStr)` DB queries (one per day of the week) sequentially via `Promise.allSettled`. While `Promise.allSettled` runs them concurrently from the JS side, each is a separate HTTP round-trip to Supabase. This is N+1-style querying — a single query with `WHERE local_date IN (...)` or `BETWEEN` would be much more efficient.

Current code iterates days from Monday to today:
```typescript
const dayPlanPromises = []
for (let i = 0; i < daysElapsed; i++) {
  const dateStr = shiftDate(weekMonday, i)
  dayPlanPromises.push(getDayPlan(userId, dateStr))
}
const dayPlanResults = await Promise.allSettled(dayPlanPromises)
```

## Findings

- **File:** `lib/ai/context.ts` — Loop generates up to 7 individual `getDayPlan()` calls for the week-in-numbers block
- **File:** `lib/supabase/day-plans.ts` — `getDayPlan()` performs a single-row Supabase query per call
- **Impact:** Up to 7 HTTP round-trips to Supabase on every weekly check-in context build; adds latency to AI response time
- **Pattern:** This is a classic N+1 query problem — the number of queries scales with the number of days

## Proposed Solutions

### Option A: Range query with `getDayPlansForDateRange()` (Recommended)
Add a `getDayPlansForDateRange(userId, startDate, endDate)` function in `lib/supabase/day-plans.ts` that uses a single Supabase query with `.gte('local_date', startDate).lte('local_date', endDate)`. Replace the loop with a single call.
- **Pros:** Simplest for the contiguous week range use case; single round-trip
- **Cons:** Only works for contiguous date ranges
- **Effort:** Small
- **Risk:** Low

### Option B: Batch query with `getDayPlansByDates()`
Add a `getDayPlansByDates(userId, dates: string[])` function using `.in('local_date', dates)`. More flexible for non-contiguous date ranges.
- **Pros:** Works for any set of dates, not just contiguous ranges
- **Cons:** Slightly more complex; flexibility not needed for current use case
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] Single DB query replaces 7 individual queries for weekly day plans
- [ ] New query function added to `lib/supabase/day-plans.ts`
- [ ] Week-in-numbers block uses the batch query
- [ ] Result processing handles missing days gracefully
- [ ] No behavior changes in aggregated output

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
