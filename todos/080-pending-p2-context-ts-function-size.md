---
status: pending
priority: p2
issue_id: "080"
tags: [code-review, architecture, refactoring, maintainability]
dependencies: []
---

# 080 — fetchAndInjectFileContext() approaching 440 lines needs decomposition

## Problem Statement

`fetchAndInjectFileContext()` in `lib/ai/context.ts` is approaching 440 lines. With the new carry-forward, week-in-numbers, and weekly plan injection blocks, it is becoming difficult to navigate and maintain. Each session type adds conditional blocks that are largely independent of each other.

This is not urgent but should be addressed before the next round of features adds more complexity to the function.

## Findings

- **File:** `lib/ai/context.ts` — `fetchAndInjectFileContext()` is ~440 lines
- **Pattern:** Session-type-specific blocks (carry-forward, week-in-numbers, weekly plan) are independent but interleaved in a single function
- **Impact:** Difficult to review, test, and extend; increases risk of regressions when adding new context blocks

## Proposed Solutions

### Option A: Extract session-type context blocks to helper functions (Recommended)
Extract independent context-building blocks into named helper functions:
- `buildCarryForwardContext(userId, timezone)`
- `buildWeekInNumbersContext(userId, timezone)`
- `buildWeeklyPlanContext(weeklyPlan, sessionType, timezone)`

Keep `fetchAndInjectFileContext()` as the orchestrator that calls these helpers and assembles the final context string.
- **Pros:** Each helper is independently testable; orchestrator becomes readable at a glance; easier to add new context blocks
- **Cons:** Slightly more files/functions to navigate
- **Effort:** Medium
- **Risk:** Low (pure refactor, no behavior changes)

### Option B: Strategy pattern per session type
Create a `ContextBuilder` interface with implementations per session type (`LifeMappingContextBuilder`, `WeeklyCheckinContextBuilder`, etc.).
- **Pros:** Clean separation; scales well to many session types
- **Cons:** Over-engineered for current 2-session-type scope; higher effort
- **Effort:** Large
- **Risk:** Low

## Acceptance Criteria

- [ ] Session-type context blocks extracted to named helpers
- [ ] `fetchAndInjectFileContext()` reduced to orchestration logic
- [ ] No behavior changes
- [ ] Type-check passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
