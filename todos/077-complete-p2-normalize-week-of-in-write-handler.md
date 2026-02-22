---
status: complete
priority: p2
issue_id: "077"
tags: [code-review, architecture, dates, weekly-plan]
dependencies: []
---

# 077 — week_of not normalized to Monday in file-write-handler

## Problem Statement

In `lib/markdown/file-write-handler.ts`, the `week_of` value for weekly plans comes directly from `update.name` — which is whatever date Sage puts in `[FILE_UPDATE type="weekly-plan" name="2026-02-23"]`. If Sage provides a non-Monday date (e.g., the current day "2026-02-22" which is a Sunday), the weekly plan will not match the `getStartOfWeek()` comparison in `context.ts`, and the plan silently will not be injected.

The write handler should normalize `week_of` to the Monday of that week, so even if Sage provides "2026-02-22", it gets stored as "2026-02-17".

## Findings

- **File:** `lib/markdown/file-write-handler.ts` — `week_of` is set directly from `update.name` without normalization
- **File:** `lib/ai/context.ts` — comparison uses `getStartOfWeek()` which returns Monday
- **Scenario:** Sage outputs `[FILE_UPDATE type="weekly-plan" name="2026-02-22"]` (Sunday) -> stored as `week_of: "2026-02-22"` -> fails match against `"2026-02-17"` (Monday)

## Proposed Solutions

### Option A: Normalize to Monday in file-write-handler (Recommended)
Import `shiftDate` from `dates.ts` and normalize the date to Monday before storing:
```typescript
const parsed = new Date(weekOf + 'T00:00:00Z')
const dow = parsed.getUTCDay()
const toMonday = dow === 0 ? -6 : 1 - dow
const normalizedWeekOf = shiftDate(weekOf, toMonday)
```
- **Pros:** Defensive; handles any day Sage might provide; single point of normalization
- **Cons:** None significant
- **Effort:** Small
- **Risk:** Low

### Option B: Validate and reject non-Monday dates
Reject the write if the date is not a Monday, logging a warning.
- **Pros:** Strict; surfaces prompt issues
- **Cons:** Loses the weekly plan data entirely on mismatch; fragile
- **Effort:** Small
- **Risk:** Medium (data loss on mismatch)

## Acceptance Criteria

- [ ] `week_of` is normalized to Monday of that week in file-write-handler.ts
- [ ] Non-Monday dates from Sage are corrected automatically
- [ ] Existing Monday dates pass through unchanged

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
