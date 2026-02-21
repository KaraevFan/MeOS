---
status: complete
priority: p2
issue_id: "070"
tags: [code-review, typescript, type-safety, day-plan]
dependencies: []
---

# 070 — `res.json()` returns untyped `any` in DayPlanSwipeContainer fetch

## Problem Statement

`fetchDayPlan` in `DayPlanSwipeContainer` calls `res.json()` which returns `any`. The result is passed directly to `setData(json)` without runtime validation. If the API response shape changes, the component will silently accept corrupted state.

**Source:** TypeScript reviewer (Issue 1).

## Proposed Solutions

### Fix

Add minimal runtime validation:

```typescript
const json: unknown = await res.json()
if (json && typeof json === 'object' && 'captures' in json) {
  setData(json as DayPlanWithCaptures)
}
```

Or use a Zod schema if one exists for `DayPlanWithCaptures`.

**Effort:** Small. **Risk:** None.

## Acceptance Criteria

- [ ] `res.json()` result is validated before setting state
- [ ] Invalid responses don't corrupt component state

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Identified during TypeScript review | Always validate fetch response types at runtime |
