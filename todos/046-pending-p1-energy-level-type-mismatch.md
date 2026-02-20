---
status: pending
priority: p1
issue_id: "046"
tags: [code-review, typescript, day-plan, type-safety]
dependencies: ["045"]
---

# 046 — `DayPlanDataBlock.energy_level` is `string` not `EnergyLevel` — DB CHECK will reject silently

## Problem Statement

`DayPlanDataBlock` in `types/chat.ts:94` defines `energy_level` as `string`, but the `day_plans` table has a `CHECK (energy_level IN ('fired_up', 'focused', 'neutral', 'low', 'stressed'))` constraint, and the `EnergyLevel` union type in `types/day-plan.ts` is `'fired_up' | 'focused' | 'neutral' | 'low' | 'stressed'`. If the AI outputs an unexpected value (e.g., `"energetic"`), it passes TypeScript validation but the Postgres write fails at runtime. Since the write is fire-and-forget with `.catch()`, this error is silently swallowed.

The same issue applies to `open_threads[].status` being `string` instead of `'open' | 'resolved'`.

## Findings

- **File:** `types/chat.ts:93-98`
- **Evidence:**
  ```typescript
  export interface DayPlanDataBlock {
    energy_level?: string           // loose string — should be EnergyLevel
    intention?: string
    priorities?: { rank: number; text: string; completed: boolean }[]
    open_threads?: { ... status: string }[]   // loose string — should be 'open' | 'resolved'
  }
  ```
- **DB constraint** at `supabase/migrations/016_day_plans_and_captures.sql`:
  ```sql
  energy_level TEXT CHECK (energy_level IN ('fired_up', 'focused', 'neutral', 'low', 'stressed'))
  ```
- **Parser** at `lib/ai/parser.ts:431-432`: `JSON.parse(jsonStr) as DayPlanDataBlock` — no runtime validation.

## Proposed Solutions

### Option A: Use union types + Zod validation at parse time (Recommended)
- Change `energy_level?: string` to `energy_level?: EnergyLevel`
- Change `status: string` to `status: 'open' | 'resolved'`
- Add Zod schema validation in the parser `day_plan_data` branch
- **Pros:** Catches invalid AI output at parse time, prevents silent DB failures
- **Effort:** Small
- **Risk:** Low

### Option B: Just fix the types without runtime validation
- Change the TypeScript types only
- **Pros:** Simpler
- **Effort:** Trivial
- **Risk:** Medium — `JSON.parse` returns `any`, so the type assertion still lies

## Acceptance Criteria

- [ ] `DayPlanDataBlock.energy_level` uses `EnergyLevel` type
- [ ] `DayPlanDataBlock.open_threads[].status` uses `'open' | 'resolved'`
- [ ] Parser validates `[DAY_PLAN_DATA]` JSON with Zod before emitting segment
- [ ] Invalid AI output logs a warning instead of silently failing at DB

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-20 | Identified by code review | TypeScript + architecture reviewers flagged |
