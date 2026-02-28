---
title: "Day plan Postgres write not migrated to tool-based architecture"
date_solved: "2026-02-26"
severity: "high"
category: "logic-errors"
tags: ["data-persistence", "migration", "tool-use", "day-plan", "dual-write"]
affected_modules: ["lib/ai/tool-executor.ts", "lib/supabase/day-plan-queries.ts"]
symptoms:
  - "Day Plan page shows 'No plan for this day' after completing open_day session via tool-based flow"
  - "Structured fields (intention, energy_level) missing from Postgres day_plans table"
  - "Markdown narrative written to Supabase Storage but Postgres record not updated"
root_cause_summary: "Tool executor's save_file handler wrote markdown to Storage but skipped the dual Postgres write that legacy client-side code performed for [DAY_PLAN_DATA] blocks."
---

# Day Plan Postgres Dual Write Missing from Tool Executor

## Root Cause

During the Model-Forward Rearchitecture, the tool executor (`lib/ai/tool-executor.ts`) was built to handle file writes to Supabase Storage only. The legacy client-side code in `chat-view.tsx:1019-1076` had a dual-write pattern that:

1. Wrote markdown to Storage via `handleFileUpdate()`
2. Wrote structured fields to the Postgres `day_plans` table via `getOrCreateTodayDayPlan()` and `updateDayPlan()`

When tool execution moved to the server, only the Storage write was replicated in the tool executor. This meant `save_file(type="day-plan")` succeeded in creating the markdown artifact but failed to populate the Postgres table, causing the Day Plan page to display "No plan for this day" despite the file existing in Storage.

The `day_plans` table requires these fields: `intention`, `energy_level`, `morning_session_id`, and `morning_completed_at`. The tool schema already provided `attributes.intention` and `attributes.energy`, making the fix straightforward.

## Solution

Added a post-processing hook to `executeSaveFile()` in `lib/ai/tool-executor.ts` that mirrors the legacy dual-write pattern.

**1. Imports:**

```typescript
import { getOrCreateTodayDayPlan, updateDayPlan } from '@/lib/supabase/day-plan-queries'
import type { EnergyLevel } from '@/types/day-plan'
```

**2. Validation constant:**

```typescript
const VALID_ENERGY_LEVELS: readonly string[] = ['fired_up', 'focused', 'neutral', 'low', 'stressed']
```

**3. Helper function:**

```typescript
async function writeDayPlanToPostgres(
  attributes: Record<string, unknown> | undefined,
  context: ToolExecutionContext
): Promise<void> {
  const dayPlan = await getOrCreateTodayDayPlan(context.supabase, context.userId, context.timezone)
  const updateData: Record<string, unknown> = {
    morning_session_id: context.sessionId,
    morning_completed_at: new Date().toISOString(),
  }
  const intention = attributes?.intention
  if (typeof intention === 'string' && intention.length > 0) {
    updateData.intention = intention
  }
  const energyLevel = attributes?.energy
  if (typeof energyLevel === 'string' && VALID_ENERGY_LEVELS.includes(energyLevel)) {
    updateData.energy_level = energyLevel as EnergyLevel
  }
  await updateDayPlan(context.supabase, context.userId, dayPlan.date, updateData)
}
```

**4. Post-processing hook in `executeSaveFile()`:**

```typescript
if (result.success && fileType === 'day-plan') {
  await writeDayPlanToPostgres(attributes, context).catch((err) => {
    captureException(err, {
      tags: { tool: 'save_file', stage: 'day_plan_postgres_write' },
      extra: { sessionId: context.sessionId },
    })
  })
}
```

## Key Design Decisions

- **Non-fatal Postgres failure:** The Postgres write is wrapped in `.catch()` and logged to Sentry rather than throwing. The Storage write has already succeeded, so the markdown artifact is preserved even if the database write fails.
- **Enum validation:** Energy level is validated against `VALID_ENERGY_LEVELS` before writing to prevent invalid data from reaching Postgres.
- **Raw attributes preservation:** Uses `attributes` before `normalizeAttributes()` to preserve typed values from the tool schema.
- **Flat fields only:** Only writes `intention` and `energy_level`. Complex nested fields (`priorities`, `open_threads`) are not exposed in the tool attributes schema and remain in the markdown narrative only.
- **Session linkage:** Records `morning_session_id` and `morning_completed_at` to track which session created the day plan.

## Anti-Pattern: Side-Effect Loss During Architecture Migration

This bug exemplifies a common migration anti-pattern: **when refactoring from Architecture A to Architecture B, side effects in Architecture A that aren't obviously part of the "main" operation get dropped.**

The Storage write was the "obvious" part of saving a day plan. The Postgres write was a "side effect" (from the code's perspective) that was easy to miss — it lived in a separate code path in the client-side handler, not adjacent to the Storage write.

### Prevention Checklist for Future Tool Additions

When adding a new `save_file` file type or tool:

- [ ] Trace all writes in the legacy code path for this operation
- [ ] List every database table, storage path, and cache touched
- [ ] For each write, ask: "Does the UI read from this source?"
- [ ] Add the Postgres/side-effect write to the tool executor, not just the primary Storage write
- [ ] Wrap secondary writes in non-fatal `.catch()` if the primary write already succeeded
- [ ] Verify the Day page / Life Map / relevant UI shows correct state after the tool executes

## Related Documentation

- Todo: `todos/077-pending-p2-day-plan-postgres-write-not-migrated.md`
- Plan: `Docs/plans/2026-02-26-fix-skipped-p2-review-findings-plan.md`
- Architecture: `Docs/solutions/code-review-fixes/2026-02-25-tool-use-agentic-loop-foundation.md`
- Rearchitecture plan: `Docs/plans/2026-02-25-feat-model-forward-rearchitecture-plan.md`
- Postgres constraint patterns: `Docs/solutions/database-issues/2026-02-25-postgres-status-constraint-mismatch-expired-value.md`
