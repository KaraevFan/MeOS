---
status: pending
priority: p3
issue_id: "106"
tags: [code-review, typescript, type-safety]
dependencies: []
---

# Energy Level Maps Use `Record<string, EnergyLevel>` — Hides Undefined Lookups

## Problem Statement

`DAY_PLAN_ENERGY_MAP` and `JOURNAL_ENERGY_MAP` in `lib/energy-levels.ts` are typed as `Record<string, EnergyLevel>`, which means any string key is accepted and the return type is always `EnergyLevel` (never `undefined`). This contradicts runtime behavior where unknown keys return `undefined`. The consuming code in `journal-card.tsx` uses `as keyof typeof ENERGY_DISPLAY` cast to work around this, masking potential issues.

## Findings

- **Source**: kieran-typescript-reviewer
- **Location**: `lib/energy-levels.ts` lines 14, 23; `components/chat/journal-card.tsx` line 34

## Proposed Solutions

Use explicit key unions or a lookup function:

```typescript
type DayPlanEnergyKey = 'fired_up' | 'focused' | 'neutral' | 'low' | 'stressed'
export const DAY_PLAN_ENERGY_MAP: Record<DayPlanEnergyKey, EnergyLevel> = { ... }

// Or a safe lookup function:
export function toDayPlanEnergy(raw: string): EnergyLevel {
  return DAY_PLAN_ENERGY_MAP[raw as DayPlanEnergyKey] ?? 'neutral'
}
```

- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] Map lookups properly typed to reflect possible undefined
- [ ] Consumers handle missing keys explicitly
