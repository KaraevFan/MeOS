---
status: complete
priority: p2
issue_id: "088"
tags: [code-review, quality, simplification]
dependencies: []
---

# Consolidate CalendarConnectCard Rendering in DayPlanView

## Problem Statement

`CalendarConnectCard` is rendered in two separate conditional blocks in `day-plan-view.tsx` — one for the empty state (`!hasAnyContent`) and one for the has-content state (`hasAnyContent`). These are mutually exclusive but split across ~20 lines of JSX, making the logic harder to reason about than necessary.

## Findings

- **Source**: code-simplicity-reviewer, kieran-typescript-reviewer agents
- **Location**: `components/day-plan/day-plan-view.tsx` lines 52-54 and 72-73
- **Evidence**: Two `<CalendarConnectCard className="mx-0 mt-0" />` renders with mutually exclusive guards

## Proposed Solutions

### Option A: Single calendar section (Recommended)
Replace both blocks with one unified calendar section after IntentionCard:
```tsx
{calendarEvents && calendarEvents.length > 0 ? (
  <CalendarCard ... />
) : hasCalendarIntegration === false ? (
  <CalendarConnectCard className="mx-0 mt-0" />
) : null}
```

- **Pros**: Single source of truth, 4 lines removed, clearer intent
- **Cons**: CalendarConnectCard position changes slightly in empty state (but IntentionCard doesn't render then anyway)
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] Single CalendarConnectCard render site in DayPlanView
- [ ] Calendar connect prompt appears regardless of whether other content exists

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-23 | Found during code review | Mutually exclusive guards split across JSX |
