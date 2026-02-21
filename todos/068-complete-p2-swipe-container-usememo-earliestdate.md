---
status: complete
priority: p2
issue_id: "068"
tags: [code-review, performance, memoization, day-plan]
dependencies: []
---

# 068 — `earliestDate` IIFE recomputes on every render, breaking callback memoization chain

## Problem Statement

The IIFE computing `earliestDate` in `DayPlanSwipeContainer` runs on every render despite `today` being stable. This creates a referentially new string each render, which invalidates the `navigateToDate` useCallback, which invalidates `handlePrev`/`handleNext`, which invalidates the touch handlers. The entire memoization chain is broken.

Additionally, `formatShortDate` is defined inside the render function body but is a pure function.

**Source:** Performance oracle (OPT-1, OPT-2), TypeScript reviewer, simplicity reviewer.

## Proposed Solutions

### Fix (straightforward)

1. Wrap `earliestDate` in `useMemo(() => ..., [today])`
2. Move `formatShortDate` outside the component alongside `prevDate`/`nextDate`
3. Consider extracting `prevDate`/`nextDate` into a shared `shiftDate(dateStr, days)` utility in `lib/dates.ts`

**Effort:** Small. **Risk:** None.

## Acceptance Criteria

- [ ] `earliestDate` uses `useMemo` with `[today]` dependency
- [ ] `formatShortDate` is defined outside the component
- [ ] Callback chain is stable across renders

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Identified during performance + simplicity review | IIFEs in render break memoization chains |
