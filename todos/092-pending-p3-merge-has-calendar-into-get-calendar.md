---
status: pending
priority: p3
issue_id: "092"
tags: [code-review, performance]
dependencies: []
---

# Merge hasCalendarIntegration into getCalendarEvents

## Problem Statement

`hasCalendarIntegration` and `getCalendarEvents` both query the `integrations` table independently. Running in `Promise.all` produces two nearly identical database round-trips.

## Findings

- **Source**: performance-oracle agent
- **Location**: `lib/calendar/google-calendar.ts` lines 19 and 77

## Proposed Solutions

Have `getCalendarEvents` return a richer result: `{ events: CalendarEvent[], hasIntegration: boolean }`. Eliminates one DB query per page load (~20-40ms).

- **Effort**: Small
- **Risk**: Low (update call sites)

## Acceptance Criteria

- [ ] Single integration query per page load instead of two

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-23 | Found during code review | Redundant DB queries in parallel fetch |
