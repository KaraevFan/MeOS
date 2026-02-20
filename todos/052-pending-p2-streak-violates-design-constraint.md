---
status: pending
priority: p2
issue_id: "052"
tags: [code-review, design, day-plan, yagni]
dependencies: []
---

# 052 — Streak feature violates "no guilt-inducing UI" design constraint

## Problem Statement

CLAUDE.md states: "No guilt-inducing UI — gentle consistency acknowledgment, never streaks or scores." The streak counter (`getStreak`, 41 LOC) counts consecutive days with morning sessions and displays "Day N" in the IntentionCard. This is exactly the kind of streak/score UI the design constraint prohibits.

The simplicity reviewer recommends removing the streak feature entirely. However, the user explicitly chose to build streak tracking as P0 during brainstorming. This finding should be triaged — the user may want to keep it despite the design constraint.

## Findings

- **File:** `lib/supabase/day-plan-queries.ts:275-315` — `getStreak` (41 lines)
- **File:** `components/day-plan/intention-card.tsx:37-44` — streak badge display
- **File:** `types/day-plan.ts:73` — `streak` field on `DayPlanWithCaptures`
- **Design constraint:** CLAUDE.md "No guilt-inducing UI" rule

## Proposed Solutions

### Option A: Remove streak entirely
- Delete `getStreak`, streak badge, `streak` from `DayPlanWithCaptures`
- **Pros:** Aligns with design constraint, ~50 LOC removed
- **Effort:** Small
- **Risk:** User explicitly requested this as P0

### Option B: Reframe as "gentle consistency acknowledgment"
- Keep streak but soften the language/display (e.g., "You've been showing up" instead of "Day 5")
- **Pros:** Keeps the feature while respecting the spirit of the constraint
- **Effort:** Trivial
- **Risk:** Low

## Acceptance Criteria

- [ ] Decision made: keep, soften, or remove
- [ ] If kept, ensure language is non-guilt-inducing

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-20 | Identified by code review | Simplicity reviewer flagged |
