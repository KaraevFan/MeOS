---
status: complete
priority: p3
issue_id: "072"
tags: [code-review, simplicity, dates, duplication]
dependencies: []
---

# 072 — Duplicate date arithmetic: extract shared `shiftDate` utility

## Problem Statement

`prevDate`/`nextDate` in `day-plan-swipe-container.tsx` duplicate the same UTC date arithmetic found in `getYesterdayDateString` in `lib/dates.ts`. Three implementations of "add/subtract days from YYYY-MM-DD" exist across the codebase.

**Source:** Simplicity reviewer, learnings researcher (DST safety pattern).

## Proposed Solutions

Add a single utility to `lib/dates.ts`:

```typescript
export function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().split('T')[0]
}
```

Then `prevDate(d)` becomes `shiftDate(d, -1)`, `nextDate(d)` becomes `shiftDate(d, 1)`. Saves ~14 lines, single source of truth for date arithmetic.

**Effort:** Small. **Risk:** None.

## Acceptance Criteria

- [ ] `shiftDate` utility exists in `lib/dates.ts`
- [ ] `prevDate`/`nextDate` in swipe container removed in favor of `shiftDate`
- [ ] `earliestDate` computed as `shiftDate(today, -MAX_LOOKBACK_DAYS)`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Identified during simplicity review | Consolidate date arithmetic into single utility |
