---
status: complete
priority: p2
issue_id: "076"
tags: [code-review, typescript, architecture, weekly-plan]
dependencies: []
---

# 076 — readWeeklyPlan() returns stub object instead of null on parse failure

## Problem Statement

`readWeeklyPlan()` in `lib/markdown/user-file-system.ts` returns a stub object with `week_of: ''` on parse failure instead of returning `null`. This means the caller in `context.ts` checks `weeklyPlan.value` for truthiness — a stub with `week_of: ''` is truthy, so it passes the guard. Then `wp.frontmatter.week_of === currentWeekMonday` fails silently because `'' !== '2026-02-16'`, and the weekly plan is never injected. No error, no warning, just silent data loss.

Other read methods in UFS (e.g., `readFile`) return `null` on failure. This method should follow the same pattern.

Additionally, there is no `console.warn` on parse failure, unlike other read methods.

## Findings

- **File:** `lib/markdown/user-file-system.ts` — `readWeeklyPlan()` returns `{ frontmatter: { week_of: '' }, body: '' }` on parse failure
- **File:** `lib/ai/context.ts` — caller checks `weeklyPlan.value` for truthiness, which passes for stub objects
- **Pattern:** Other read methods in UFS return `null` on failure and log `console.warn`

## Proposed Solutions

### Option A: Return null on parse failure (Recommended)
Change `readWeeklyPlan()` to return `null` on parse failure, matching the pattern of other read methods. Add `console.warn` on parse failure for observability.
- **Pros:** Consistent with existing UFS patterns; callers already handle null from other methods
- **Cons:** None significant
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] `readWeeklyPlan()` returns `null` on parse failure (not stub)
- [ ] `console.warn` added on parse failure
- [ ] Callers handle `null` return correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
