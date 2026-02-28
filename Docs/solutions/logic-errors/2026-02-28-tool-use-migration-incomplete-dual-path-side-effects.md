---
title: "Model-Forward Rearchitecture: Tool-Use API Migration P1/P2 Fixes"
date: 2026-02-28
category: logic-errors
severity: P1
tags:
  - tool-use-api
  - schema-mismatch
  - architecture-migration
  - silent-data-loss
  - race-condition
  - missing-side-effects
  - SSE-routing
  - code-review
affected_modules:
  - lib/ai/tool-definitions.ts
  - lib/ai/tool-executor.ts
  - app/api/chat/route.ts
  - components/chat/chat-view.tsx
  - components/day-plan/evening-reflection-card.tsx
  - components/day-plan/day-plan-swipe-container.tsx
  - lib/markdown/file-write-handler.ts
symptoms:
  - Energy values silently dropped (4 of 5 canonical values missing from schema)
  - Split-conversation UI events (showOptions, showPulseCheck) undelivered to client
  - Post-session lifecycle side effects never executed (onboarding_completed, scheduleMidDayNudge)
  - Session-insights and capture file types not recognized by tool schema
  - Tool context metadata stale after lifecycle tool execution
  - Concurrent save_file/complete_session race conditions
  - Missing wall-clock stream abort (Vercel 504 timeout risk)
  - Unconditional UI refresh on Day tab causing unnecessary server round-trips
  - Missing user_id defense-in-depth filtering on session queries
  - Legacy FILE_UPDATE block references in new prompts
root_cause_summary: >
  Migration from regex-parsed text blocks to Claude tool-use API created systematic alignment gaps.
  Tool schema enums didn't match canonical TypeScript types. SSE event routing wasn't wired for
  split-conversation tools. Post-session hooks only existed in legacy path. Async tool execution
  order wasn't guaranteed, creating races between persistence and session completion. Context
  object not refreshed after stateful tool execution.
---

# Model-Forward Rearchitecture: Tool-Use Migration P1/P2 Fixes

## Problem Statement

After migrating from regex-parsed text blocks (`[FILE_UPDATE]`, `[ENTER_MODE]`, `[SUGGESTED_REPLIES]`) to Claude's native tool use API with a server-side agentic loop, a multi-agent code review discovered 12 issues (4 P1 critical, 8 P2 important) across the migration surface area.

The root cause pattern: **the migration completed the happy path but missed edge cases, async coordination, schema inventory validation, and side effect migration.**

## Solution

### P1 Fixes (Critical)

#### 1. Energy Enum Mismatch (#134)

The tool schema defined `['high', 'moderate', 'low']` but the canonical `EnergyLevel` type is `['fired_up', 'focused', 'neutral', 'low', 'stressed']`. Only `'low'` overlapped -- 4 of 5 values were silently rejected.

**Fix:** Aligned `tool-definitions.ts` enum and `evening-reflection-card.tsx` ENERGY_LABELS to the canonical type.

```typescript
// lib/ai/tool-definitions.ts:58
energy: {
  type: 'string',
  enum: ['fired_up', 'focused', 'neutral', 'low', 'stressed'],
}
```

#### 2. Split-Conversation Tools Not Wired (#135)

Client SSE handler had bare `continue` statements for `showPulseCheck` and `showOptions` events, silently dropping them.

**Fix:** `showPulseCheck` triggers existing pulse UI; `showOptions` stores options in new `toolDrivenOptions` state rendered as `SuggestionPills`.

```typescript
// components/chat/chat-view.tsx
const [toolDrivenOptions, setToolDrivenOptions] = useState<string[] | null>(null)

// In SSE handler:
if (parsed.showPulseCheck) {
  const ratings = await getLatestRatingsPerDomain(supabase, userId)
  setPreviousRatings(ratings)
  setShowCheckinPulse(true)
  continue
}
if (parsed.showOptions) {
  const opts = parsed.showOptions as { options?: string[] }
  if (Array.isArray(opts.options)) {
    setToolDrivenOptions(opts.options)
  }
  continue
}
```

#### 3. Post-Session Side Effects Missing (#136)

`onboarding_completed` and `scheduleMidDayNudge` only existed in legacy client-side code paths and never fired via the tool-use completion path.

**Fix:** Added to server-side `route.ts` after `completedViaToolSession`. Track `dayPlanIntention` from `save_file(day-plan)` tool calls during the agentic loop.

```typescript
// app/api/chat/route.ts
if (effectiveType === 'life_mapping') {
  supabase.from('users').update({ onboarding_completed: true }).eq('id', user.id)
}
if (effectiveType === 'open_day' && dayPlanIntention) {
  scheduleMidDayNudge(supabase, user.id, dayPlanIntention, timezone)
}
```

#### 4. Missing File Types in Tool Schema (#137)

`session-insights` and `capture` existed in `FILE_TYPES` constants but were absent from the tool schema enum.

**Fix:** Added to `file_type` enum and added `CAPTURE` case to both `resolveFileUpdatePath()` and `handleFileUpdate()`.

### P2 Fixes (Important)

#### 5. Stale Metadata Snapshot (#138)

`toolContext` was built once at request start. After `enter_structured_arc`, subsequent tool calls still used original session type for permission checks.

**Fix:** Update `toolContext.activeMode` and `toolContext.metadata` after lifecycle tool results. Also fixed shared array mutation: `completedArcs.push()` replaced with spread `[...existingArcs, newArc]`.

#### 6. Legacy FILE_UPDATE References (#140)

System prompts still referenced deprecated `[FILE_UPDATE]` block syntax.

**Fix:** Replaced 3 instances of "write the FILE_UPDATE blocks" with "save the closing artifacts using the save_file tool".

#### 7. Two-Phase Tool Execution (#141)

`save_file` and `complete_session` ran in a single `Promise.allSettled` -- sessions could complete before file writes finished.

**Fix:** Separated into data tools first, lifecycle tools second:

```typescript
const LIFECYCLE_TOOLS = new Set(['complete_session', 'enter_structured_arc'])
const dataBlocks = toolUseBlocks.filter((b) => !LIFECYCLE_TOOLS.has(b.name))
const lifecycleBlocks = toolUseBlocks.filter((b) => LIFECYCLE_TOOLS.has(b.name))

const dataResults = await Promise.allSettled(dataBlocks.map(executeToolBlock))
const lifecycleResults = await Promise.allSettled(lifecycleBlocks.map(executeToolBlock))
```

#### 8. Wall-Clock Abort (#142)

No timeout on individual Claude streams within the agentic loop -- risk of Vercel 504.

**Fix:** `setTimeout`-based abort using remaining wall-clock budget for each stream iteration.

```typescript
const elapsed = Date.now() - REQUEST_START
const remainingMs = MAX_REQUEST_DURATION_MS - elapsed
const streamTimeout = setTimeout(() => messageStream.controller.abort(), remainingMs)
```

#### 9. Conditional router.refresh (#143)

Day tab called `router.refresh()` on every mount, causing unnecessary server round-trips.

**Fix:** Use `sessionStorage` flag set on session completion; only refresh when flag is present.

#### 10. Defense-in-Depth user_id (#145)

Session queries relied solely on RLS without explicit `user_id` filter.

**Fix:** Added `.eq('user_id', context.userId)` to all 4 session queries in `tool-executor.ts`.

## Prevention Strategies

### Enum Drift Prevention

Extract enum definitions into shared constants; derive tool schemas from these constants rather than duplicating values. Add build-time tests that verify schema enums match TypeScript types.

### SSE Event Handler Coverage

Use a discriminated union type for all SSE events. TypeScript's exhaustive checking prevents unhandled event types at compile time.

### Side Effects Migration Checklist

When migrating code paths, create a side effects registry mapping session types to required post-completion actions. Verify legacy path effects are present in new path before removing old code.

### Two-Phase Execution Ordering

Data operations (file writes) must complete before lifecycle operations (session completion). Never run both in a single `Promise.allSettled`.

### Mutable Context in Agentic Loops

Document which `toolContext` fields are mutable during the loop. Update context immediately after lifecycle tool execution so subsequent tool calls use correct permissions.

### Architecture Migration Pre-merge Checklist

1. All enum values in sync across schema, types, and UI
2. All SSE events have client handlers
3. All post-session side effects migrated
4. Tool execution ordering prevents race conditions
5. Context updates propagate within the agentic loop
6. Defense-in-depth filters on all user-scoped queries

## Related Documentation

- [Tool use agentic loop foundation](../code-review-fixes/2026-02-25-tool-use-agentic-loop-foundation.md) -- Phase 1 migration
- [Day plan dual-write missing](2026-02-26-tool-executor-day-plan-storage-write-missing-postgres-dual-write.md) -- Same migration pattern
- [React state guard race condition](2026-02-24-react-state-guard-race-condition-stale-batching.md) -- Informed tool execution state design
- [Postgres CHECK constraint mismatch](../database-issues/2026-02-25-postgres-status-constraint-mismatch-expired-value.md) -- Similar enum drift pattern
- [Context injection sanitization](../security-issues/2026-02-23-context-injection-sanitization-hardening.md) -- Defense-in-depth patterns
- [Model-forward rearchitecture brainstorm](../../brainstorms/2026-02-25-model-forward-rearchitecture-brainstorm.md) -- Strategic design context

## Verification

All quality gates pass:
- `npm run type-check` -- clean
- `npm run lint` -- no warnings or errors
- `npm run build` -- compiled successfully
