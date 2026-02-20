---
status: pending
priority: p3
issue_id: "053"
tags: [code-review, bug, day-plan, timezone]
dependencies: []
---

# 053 — Date boundary bug: timezone-naive timestamps on TIMESTAMPTZ column

## Problem Statement

`getCapturesForDate` uses timezone-naive timestamps (`${date}T00:00:00` / `${date}T23:59:59.999`) against `created_at TIMESTAMPTZ`. This can misclassify captures near midnight depending on user timezone. Also misses the last millisecond of the day.

## Findings

- **File:** `lib/supabase/day-plan-queries.ts:136-138`
- **Correct pattern:** Use `${date}T00:00:00Z` and `${nextDate}T00:00:00Z` with explicit UTC

## Acceptance Criteria

- [ ] Date range queries use explicit timezone or next-day boundary

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-20 | Identified by code review | TypeScript reviewer flagged |
