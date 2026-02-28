---
title: "Fix Skipped P2 Review Findings (#074, #077, #078)"
type: fix
date: 2026-02-26
---

# Fix Skipped P2 Review Findings

## Overview

Three P2 findings from the model-forward rearchitecture code review were skipped during the initial fix pass because they appeared to require separate PRs. Analysis shows two are coupled (#074 + #078) and all three can be resolved on the current branch without clarification.

## Problem Statement

1. **#074 — YAGNI: `show_pulse_check` + `show_options` tools are defined, dispatched, and ignored.** Claude can call these tools, the server sends SSE events, but the client `continue`s past them. Result: conversation silently dies. ~118 lines of dead code creating a class of silent-failure bugs.

2. **#078 — Split-conversation resume protocol undefined.** `ChatRequestSchema` only accepts `content: z.string()` — no way to send `tool_use`/`tool_result` blocks. If the stream breaks for a split-conversation tool, there's no protocol to resume. **Moot if #074 removes the tools.**

3. **#077 — Day plan Postgres write not wired to `save_file` tool.** When `save_file(type="day-plan")` executes, it writes markdown to Storage but not to the `day_plans` Postgres table. Day Plan page shows "No plan for this day."

## Technical Approach

### #074 + #078: Remove unused split-conversation tools (coupled)

**Rationale:** These tools were forward-deployed for a client integration that doesn't exist yet. The resume protocol (#078) is the hard part — without it, the tools are actively harmful (silent conversation death). Remove both, along with their SSE events. Add them back in the PR that wires the client.

The existing text-based flows continue working:
- Pulse check: triggered via `triggerSageResponse` with `pulseContextMode` (separate mechanism)
- Suggested replies: `[SUGGESTED_REPLIES]` parser still active during transition period

**Changes:**

| File | Change |
|------|--------|
| `lib/ai/tool-definitions.ts` | Remove `SHOW_PULSE_CHECK_TOOL`, `SHOW_OPTIONS_TOOL` exports. Remove from `getToolDefinitions()`. |
| `lib/ai/tool-executor.ts` | Remove `show_pulse_check` and `show_options` cases from `executeTool()` switch. |
| `app/api/chat/route.ts` | Remove split-conversation detection block (lines ~468-490). Remove `showPulseCheck`/`showOptions` from SSE protocol comment. Remove `toolCall`/`roundBoundary` from SSE protocol comment (keep emissions — they serve the agentic loop). |
| `components/chat/chat-view.tsx` | Remove `parsed.showPulseCheck || parsed.showOptions` handler (line ~649). Keep `parsed.toolCall || parsed.roundBoundary` handler (still useful for future shimmer). |
| `lib/ai/context.ts` | Remove `show_options` and `show_pulse_check` lines from `TOOL_USE_GUIDANCE`. |
| `skills/open-conversation.md` | Remove `show_options` from frontmatter `tools:`. Replace body references with text-based equivalents. |
| `skills/weekly-checkin.md` | Remove `show_options`, `show_pulse_check` from frontmatter `tools:`. Replace body references. |
| `skills/open-day.md` | Remove `show_options` from frontmatter `tools:`. Replace body references. |
| `lib/ai/skill-tool-coupling.test.ts` | Remove `SHOW_PULSE_CHECK_TOOL` and `SHOW_OPTIONS_TOOL` from `KNOWN_TOOL_NAMES`. |

### #077: Day plan Postgres dual write

**Rationale:** The client-side code (chat-view.tsx:1042-1076) already does this write for the legacy `[DAY_PLAN_DATA]` path. The tool executor needs the same logic server-side.

**Changes:**

| File | Change |
|------|--------|
| `lib/ai/tool-executor.ts` | In `executeSaveFile`, after the Storage write succeeds and `fileType === 'day-plan'`, call `getOrCreateTodayDayPlan` + `updateDayPlan`. Extract `intention`, `energy_level` from raw attributes. Wrap in try/catch — Postgres failure should NOT fail the tool call (Storage write already succeeded). |

**Data flow:**
```
Claude calls save_file(type="day-plan", attributes={intention: "..."})
  → Storage write (markdown file) ✓ (already works)
  → Postgres write (day_plans table) ← NEW
    - getOrCreateTodayDayPlan(supabase, userId, timezone)
    - updateDayPlan(supabase, userId, date, { intention, energy_level, morning_session_id, morning_completed_at })
```

**Note:** `priorities` and `open_threads` (complex nested arrays) are NOT included in the tool attributes schema and are not extracted from markdown content. The Postgres write covers the fields available as flat attributes: `intention` and `energy_level`. This matches the minimal viable day plan display. Full structured data support is a future enhancement.

## Acceptance Criteria

- [ ] Claude cannot call `show_pulse_check` or `show_options` (tools removed from definitions)
- [ ] No SSE events emitted for split-conversation tools
- [ ] Skills reference only tools that exist in tool-definitions.ts
- [ ] `skill-tool-coupling.test.ts` passes with updated known tools
- [ ] Day plan Postgres row created when `save_file(type="day-plan")` executes
- [ ] Day Plan page shows intention after tool-based open_day session
- [ ] Type-check passes, all tests pass

## References

- Brainstorm: `Docs/brainstorms/2026-02-25-model-forward-rearchitecture-brainstorm.md`
- Architecture plan: `Docs/plans/2026-02-25-feat-model-forward-rearchitecture-plan.md`
- Institutional learning (dead code): `Docs/solutions/logic-errors/dead-code-accumulation-post-redesign.md`
- Institutional learning (tool use foundation): `Docs/solutions/code-review-fixes/2026-02-25-tool-use-agentic-loop-foundation.md`
