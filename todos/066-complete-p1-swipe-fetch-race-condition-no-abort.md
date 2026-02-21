---
status: complete
priority: p1
issue_id: "066"
tags: [code-review, performance, race-condition, day-plan]
dependencies: []
---

# 066 — Rapid swipe navigation fires unbounded concurrent API requests with race condition

## Problem Statement

`DayPlanSwipeContainer.fetchDayPlan()` has no `AbortController`, no debounce, and no client-side cache. Rapid swiping through 10 dates fires 10 concurrent API requests. Responses can arrive out-of-order, causing stale data to overwrite the current view (race condition). Each request triggers 3-4 database queries, wasting server resources.

**Source:** Performance oracle review (CRITICAL-1), TypeScript reviewer.

## Findings

- `components/day-plan/day-plan-swipe-container.tsx:52-64` — plain `fetch()` with no abort signal
- No client-side cache for previously visited dates
- The `AbortController` pattern is already used in the codebase at `chat-view.tsx:184` (`streamAbortRef`)
- 30-day lookback window means up to 30 concurrent requests possible from a single user

## Proposed Solutions

### Option A: AbortController + Map cache (Recommended)

Add `AbortController` to cancel in-flight requests when a new navigation starts. Add a `Map<string, DayPlanWithCaptures>` ref to cache visited dates.

**Pros:** Eliminates race conditions, reduces server load, instant navigation to cached dates.
**Cons:** Cached data can become stale (mitigated: historical dates are immutable).
**Effort:** Small — pattern already exists in codebase.
**Risk:** Low.

### Option B: Debounce navigation

Add a 200ms debounce to `navigateToDate`. Only fires the fetch after the user stops swiping.

**Pros:** Simpler. **Cons:** Adds perceived latency, doesn't solve race condition for slow requests.
**Effort:** Small. **Risk:** Low.

## Acceptance Criteria

- [ ] Rapid swiping through 5+ dates results in only 1 API call (the final destination)
- [ ] Previously visited dates load instantly from cache
- [ ] No stale data flash from out-of-order responses

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Identified during performance review | Always use AbortController for navigational fetch patterns |

## Resources

- PR: `fix/r5a-p1-p2-playtest-fixes`
- Pattern: `components/chat/chat-view.tsx:184` (existing AbortController usage)
