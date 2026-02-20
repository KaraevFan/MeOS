---
status: pending
priority: p2
issue_id: "051"
tags: [code-review, performance, day-plan, database]
dependencies: []
---

# 051 — Duplicate getDayPlan call — 4 queries on page load instead of 2-3

## Problem Statement

`getDayPlanWithCaptures` calls `getDayPlan` at line 100, then `getCapturesForDate` at line 101 calls `getDayPlan` again internally (line 121). The same day plan row is fetched twice per page load. Combined with the two capture queries inside `getCapturesForDate`, this results in 4 queries instead of 2-3.

## Findings

- **File:** `lib/supabase/day-plan-queries.ts:99-103` — `getDayPlanWithCaptures`
- **File:** `lib/supabase/day-plan-queries.ts:115-121` — `getCapturesForDate` re-fetches day plan

## Proposed Solutions

### Option A: Pass dayPlanId to getCapturesForDate (Recommended)
- Add optional `dayPlanId?: string | null` parameter
- Reuse already-fetched day plan from `getDayPlanWithCaptures`
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] `getDayPlan` called only once per page load
- [ ] Page load uses 2-3 queries instead of 4

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-20 | Identified by code review | Performance oracle flagged |
