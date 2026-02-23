---
status: complete
priority: p2
issue_id: "095"
tags: [code-review, correctness, day-plan]
dependencies: []
---

# DayPlanConfirmationCard Filters Priorities by Index Instead of Rank

## Problem Statement

`additionalItems` uses `.filter((_, i) => i > 0)` which assumes rank-1 is always at array index 0. The Zod schema allows priorities in any order (`rank: z.number()` without ordering constraints). If the AI emits `[{rank:2,...}, {rank:1,...}]`, index-based filtering shows the wrong items.

## Findings

- **Source**: kieran-typescript-reviewer
- **Location**: `components/chat/day-plan-confirmation-card.tsx` line 19
- **Evidence**:
  ```typescript
  const additionalItems = data.priorities?.filter((_, i) => i > 0) ?? []
  ```

## Proposed Solutions

Filter by rank semantics or use `.slice(1)`:

```typescript
// Option A: Filter by rank (most defensive)
const additionalItems = data.priorities?.filter((p) => p.rank > 1) ?? []

// Option B: Slice (assumes ordering, clearer than filter-by-index)
const additionalItems = data.priorities?.slice(1) ?? []
```

- **Effort**: Trivial
- **Risk**: None

## Acceptance Criteria

- [ ] Additional items display is based on rank semantics, not array position

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-23 | Found during open-day-flow-redesign code review | AI output ordering is not guaranteed |
