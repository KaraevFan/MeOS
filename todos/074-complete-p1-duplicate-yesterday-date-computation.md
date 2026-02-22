---
status: complete
priority: p1
issue_id: "074"
tags: [code-review, typescript, performance, dates]
dependencies: []
---

# 074 — Duplicate `getYesterdayDateString()` calls and unsafe type narrowing in open_day block

## Problem Statement

In `lib/ai/context.ts`, `getYesterdayDateString(timezone)` is called 3 separate times within the `open_day` block: once for the DB query filter, and potentially twice more in the carry-forward logic. Each call performs timezone computation via `Intl.DateTimeFormat`. The value never changes within a single request — it should be computed once and reused.

Additionally, the type guard `(r): r is PromiseFulfilledResult<DayPlan | null>` should narrow to `PromiseFulfilledResult<DayPlan>` (excluding null) since the subsequent code accesses `.value.priorities` without null checking.

And `plan.priorities?.length > 0` uses optional chaining with numeric comparison — if `priorities` is undefined, `undefined > 0` evaluates to `false` (correct by accident but unclear intent). Should use `(plan.priorities?.length ?? 0) > 0` or `Array.isArray(plan.priorities) && plan.priorities.length > 0`.

## Findings

- **File:** `lib/ai/context.ts` — `getYesterdayDateString(timezone)` called 3 times in the open_day block; value is constant per request
- **File:** `lib/ai/context.ts` — Type guard narrows to `DayPlan | null` but downstream code assumes non-null without checking
- **File:** `lib/ai/context.ts` — `plan.priorities?.length > 0` relies on `undefined > 0` being `false`, which is technically correct but semantically unclear and fragile

## Proposed Solutions

### Option A: Hoist computation and fix type safety (Recommended)
Hoist `const yesterdayStr = getYesterdayDateString(timezone)` once at the top of the open_day block. Fix type guard to `PromiseFulfilledResult<DayPlan>` and add `&& r.value !== null` check. Replace `?.length > 0` with explicit null check.
- **Pros:** Eliminates redundant computation; makes type narrowing correct; clarifies intent
- **Cons:** None
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] `getYesterdayDateString()` called exactly once in the open_day block
- [ ] Type guard correctly narrows to non-null `DayPlan`
- [ ] `priorities?.length > 0` uses explicit null/undefined handling
- [ ] No behavior changes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
