---
status: pending
priority: p2
issue_id: "048"
tags: [code-review, performance, concurrency, day-plan]
dependencies: []
---

# 048 — JSONB read-modify-write race condition in togglePriorityCompleted

## Problem Statement

`togglePriorityCompleted` uses a read-modify-write pattern on the `priorities` JSONB field. If a user rapidly taps two different priority checkboxes, the second toggle reads stale data and overwrites the first toggle's result. The same pattern exists in `resolveThread` (though that function is dead code — see #047).

## Findings

- **File:** `lib/supabase/day-plan-queries.ts:220-241`
- **Pattern:** 1) Read entire row, 2) Modify array in JS, 3) Write entire column back
- **Failure scenario:** Rapid-tap two checkboxes → second read gets pre-first-toggle state → overwrites first toggle → user sees one checkbox revert on refresh

## Proposed Solutions

### Option A: Postgres RPC with atomic jsonb_set (Recommended)
- Create `toggle_priority_completed` RPC function using `jsonb_set` for atomic update
- **Pros:** No race condition regardless of concurrency
- **Effort:** Medium (new migration + RPC call)
- **Risk:** Low

### Option B: Optimistic locking with version counter
- Add `version` column, use `WHERE version = expected_version`
- **Pros:** Generic solution
- **Effort:** Medium
- **Risk:** Low, but adds retry complexity

## Acceptance Criteria

- [ ] Rapid-tapping two checkboxes preserves both toggles
- [ ] No read-modify-write pattern on JSONB fields
- [ ] Build passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-20 | Identified by code review | Performance oracle flagged |
