---
status: pending
priority: p2
issue_id: "047"
tags: [code-review, dead-code, day-plan]
dependencies: []
---

# 047 — Dead code: DayPlanData type, resolveThread function, explored/briefing_data fields

## Problem Statement

~89 lines of dead code were introduced with the Day Plan feature. These are types, functions, and fields that are defined but never imported or used anywhere.

## Findings

1. **Dead type `DayPlanData`** — `types/day-plan.ts:76-81` (6 lines). Exported but never imported. Near-duplicate of `DayPlanDataBlock` in `types/chat.ts` with different field shapes (confusing).

2. **Dead function `resolveThread`** — `lib/supabase/day-plan-queries.ts:246-269` (24 lines). No API route or component calls it.

3. **Dead field `explored`** — `types/day-plan.ts:64`. `explored: boolean` on `Capture` is never read, toggled, or filtered.

4. **Dead field `briefing_data`** — `types/day-plan.ts:50`. Listed as updatable in `updateDayPlan` but never read or written.

5. **Dead buttons** — `morning-snapshot-card.tsx:167-169` ("explore" button, no onClick) and `captured-thoughts.tsx:143-145` ("Explore with Sage" / "Sit with this" buttons, no onClick). Also dead supporting code: `ACTION_COLORS` map (lines 65-69), `actionText`/`actionColor` vars (lines 101-102).

## Proposed Solutions

### Option A: Delete all dead code (Recommended)
- Remove `DayPlanData` type, `resolveThread` function, `explored` field, `briefing_data` field from updateDayPlan pick, dead buttons and their supporting code
- **Pros:** ~89 LOC removed, eliminates confusing near-duplicate types and misleading UI
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] `DayPlanData` type removed from `types/day-plan.ts`
- [ ] `resolveThread` function removed from `day-plan-queries.ts`
- [ ] Dead buttons removed from `morning-snapshot-card.tsx` and `captured-thoughts.tsx`
- [ ] `ACTION_COLORS` map and related vars removed
- [ ] Build passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-20 | Identified by code review | Simplicity + TypeScript reviewers |
