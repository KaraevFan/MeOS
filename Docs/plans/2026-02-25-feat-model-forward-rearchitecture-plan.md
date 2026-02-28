---
title: "Model-Forward Rearchitecture"
type: feat
date: 2026-02-25
---

## Enhancement Summary

**Deepened on:** 2026-02-25
**Research agents used:** Architecture Strategist, Security Sentinel, Performance Oracle, Frontend Races Reviewer, Agent-Native Reviewer, Code Simplicity Reviewer, Best Practices Researcher, Framework Docs Researcher, Learnings Researcher, Agent-Native Architecture Skill

### Critical Findings (Must Address)

1. **Phase 2.3 depends on Phase 1** — removing format instructions requires tool use to be active. Phase 2 is NOT fully parallel with Phase 1. Mark dependency explicitly.
2. **`show_options` should be restored as a tool** — eliminates the last text-block parsing dependency. Without it, `[SUGGESTED_REPLIES]` parser stays alive indefinitely.
3. **`save_file` should await writes honestly** — returning `{ success: true }` before the write completes creates observability/debugging problems. Supabase Storage writes are fast (~50-150ms). Await them.
4. **Streaming lifecycle needs 4 states, not a boolean** — `idle` → `streaming` → `toolExecuting` → `streaming`. The `isStreaming` boolean pattern caused a deadlock before (institutional learning).
5. **Sanitization required in unified context pipeline** — `stripBlockTags()` must be called on all context file reads to prevent stale block tags from re-injecting into prompts.
6. **`complete_session` must handle Postgres CHECK constraint** — the `sessions.status` column has a CHECK constraint that silently rejects `'expired'` → `'completed'` transitions. Tool executor must check current status first.
7. **Wall-clock timeout guard in agentic loop** — Vercel edge timeout is 30s (Pro: 300s). Loop must check elapsed time before each iteration.

### High-Value Improvements

8. **Parallel tool execution** — use `Promise.allSettled` not serial `for` loop. Claude can emit 3+ tool calls in one turn.
9. **Truncate `save_file` content in re-sent messages** — the full markdown body is re-sent every loop iteration. Truncating to first 50 chars + byte count saves 50-60% of token growth.
10. **Paragraph separator between agentic loop rounds** — emit a `roundBoundary` SSE event so the client inserts `\n\n` between rounds. Without this, text from round 2 concatenates directly to round 1.
11. **Shimmer needs a ref counter, not boolean** — concurrent tool calls (3 `save_file` calls in one turn) would toggle the shimmer off after the first completes.
12. **Merge `save_day_plan` into `save_file`** — one tool handles all writes. Day plan data goes to both Postgres and Storage via `file_type: 'day-plan'` with structured attributes.
13. **Cut `emit_reflection_prompt` as a separate tool** — use `save_file` with `file_type: 'reflection-prompt'`.
14. **Use existing `metadata` JSONB column** — don't add a new `tool_calls` column. Store tool call records in `metadata.tool_calls`.

### Simplifications

15. **Remove `toolResult` and `fileSaved` SSE events** — only `toolCall` is needed for shimmer. The tool result is internal to the server loop.
16. **Trim context header to 4 fields** — user name, last session, time bracket, check-in status. Remove domain count, calendar count, intention (these are in the standing context).
17. **SDK v0.39.0 is sufficient** — `toolRunner` requires v0.62.0+ but manual loop gives more control over SSE. No upgrade needed.

---

# Model-Forward Rearchitecture

## Overview

Replace regex-parsed text blocks with Claude tool use, rewrite prescriptive session scripts as goal-oriented skills, and unify the context injection pipeline. The goal: give Sage rich tools and lightweight skills, then let the model figure out the conversation.

**Timing:** After Wave 1 testing completes. The rearchitecture is the bridge to Milestone 2.

**Source documents:**
- Strategic plan: `Docs/model_forward_rearchitecture.md`
- Brainstorm (resolved decisions): `Docs/brainstorms/2026-02-25-model-forward-rearchitecture-brainstorm.md`

## Problem Statement

The current architecture constrains the model with:
- **No tool use** — all structured output via regex parsing of 6+ custom block types (`[FILE_UPDATE]`, `[SUGGESTED_REPLIES]`, `[DAY_PLAN_DATA]`, `[ENTER_MODE]`, etc.)
- **Prescriptive session scripts** — 3,000-4,000 token prompts with rigid beat sequences and "NEVER deviate" instructions
- **Session-type-branched context** — 450-line `fetchAndInjectFileContext()` with ~15 conditional blocks
- **Client-side file writes** — file persistence happens in `chat-view.tsx` (1,416 lines), not server-side

This creates brittleness (regex parsing), constrains conversation quality (prescriptive scripts), and makes the client overly complex (lifecycle management + file writes).

## Technical Approach

### Architecture

**Three-layer change:**

1. **Tool use** — Add Claude function calling with a hybrid execution model
2. **Skill rewrites** — Rewrite 4 existing skills from scripts to goals, add 6 new approach skills
3. **Context unification** — Single pipeline that injects all available context

**Key architectural decision — tool execution model:**

Claude's tool use API requires a `tool_result` message before the model generates more text. This means true "fire-and-forget" is impossible — every tool call pauses text generation. The practical model is:

| Tool Category | Execution | `tool_result` Return | UX |
|---|---|---|---|
| **Instant tools** (`save_file`) | Server awaits write, returns `{ success: true, path, bytes }` | Fast (~50-150ms) | Brief pause, shimmer indicator, text resumes |
| **Lifecycle tools** (`complete_session`, `enter_structured_arc`) | Server executes, returns enriched result | Fast (~200ms) | Sage reacts to result |
| **Interactive tools** (`show_options`) | Server sends options to client via SSE, closes current API call | Tool result sent in NEXT API call with user's selection | User taps option pill, new API call resumes |
| **Split-conversation tools** (`show_pulse_check`) | Server sends UI event to client, closes current API call | Tool result sent in NEXT API call when user completes interaction | User interacts with UI, then conversation resumes |

> **Design revision (from agent-native review):** `show_options` is restored as a tool (interactive category) to eliminate the last text-block parsing dependency (`[SUGGESTED_REPLIES]`). This also makes option selection available to agent-native flows. `save_day_plan` and `emit_reflection_prompt` are merged into `save_file` using `file_type` enums — one tool for all content writes. `save_file` now awaits the actual write (Supabase Storage writes are ~50-150ms) rather than returning success before completion, which prevents observability gaps and silent data loss.

**Critical insight on `show_pulse_check`:** This tool requires user interaction (30-120 seconds). The Claude API connection cannot stay open that long. Solution: **split-conversation pattern** — the first API call ends with the tool call, the client renders the pulse check UI, and when the user submits, a new API call starts with the tool result injected into message history. This matches the current architecture's approach (separate `triggerSageResponse` call after pulse check).

### SSE Protocol (Extended)

Current events:
```
data: { text: string }              — Streaming token
data: { error: string }             — Error message
data: { sessionCompleted: true }    — Session completed
data: { modeChange: string }        — Entered structured arc
data: { arcCompleted: string }      — Arc completed
data: [DONE]                        — Terminal sentinel
```

New events added:
```
data: { toolCall: { id, name } }            — Tool call detected (triggers shimmer indicator)
data: { roundBoundary: true }               — Paragraph break between agentic loop rounds
data: { showPulseCheck: { context } }       — Render pulse check UI (split-conversation)
data: { showOptions: { options[] } }        — Render option pills (interactive tool)
```

> **Simplified (from simplicity review):** `toolResult` and `fileSaved` events removed — the tool result is internal to the server loop and the client doesn't need it. Only `toolCall` is needed to trigger the shimmer indicator. The `roundBoundary` event (from frontend races review) ensures the client inserts `\n\n` between agentic loop rounds so text doesn't concatenate without whitespace.

**Multi-round streaming:** Each round of the agentic loop produces a separate stream of text events. The client concatenates them into a single assistant message. Between rounds, `toolCall` events trigger the shimmer indicator, and `roundBoundary` inserts a paragraph break.

### Message Storage

New messages from tool-use sessions need a different storage format:

```typescript
// Current: messages.content is the full text including [FILE_UPDATE] blocks
content: "Here's your career domain summary.\n[FILE_UPDATE type=\"domain\" name=\"career\"]..."

// New: messages.content is text-only. Tool calls stored in existing metadata column.
content: "Here's your career domain summary. I've saved it to your life map."
// metadata: { tool_calls: [{ name: "save_file", input: { file_type: "domain", ... } }] }
```

> **Simplified (from simplicity review):** Use the existing `metadata` JSONB column — no new column needed. Historical messages with `[FILE_UPDATE]` blocks continue to render via the parser.

### Implementation Phases

#### Phase 1: Tool Use Foundation (Sprint A) — 4-5 days

**Goal:** Add Claude tool use with `save_file` as the first tool. Validate streaming + tool execution UX.

**Depends on:** Nothing. This is the critical path.

##### 1.1 Tool Definitions Module

**New file: `lib/ai/tool-definitions.ts`**

```typescript
import type Anthropic from '@anthropic-ai/sdk'

export const SAVE_FILE_TOOL: Anthropic.Tool = {
  name: 'save_file',
  description: 'Save or update a markdown file in the user\'s data store...',
  input_schema: {
    type: 'object' as const,
    required: ['file_type', 'content'],
    properties: {
      file_type: {
        type: 'string',
        enum: ['domain', 'overview', 'life-plan', 'check-in', 'daily-log',
               'day-plan', 'weekly-plan', 'sage-context', 'sage-patterns', 'capture'],
      },
      file_name: { type: 'string' },
      content: { type: 'string' },
      attributes: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['thriving', 'good', 'okay', 'needs_attention', 'in_crisis'] },
          updated_rating: { type: 'string' },
          energy: { type: 'string' },
          mood_signal: { type: 'string' },
          domains_touched: { type: 'array', items: { type: 'string' } },
          preview_line: { type: 'string' },
        },
      },
    },
  },
}

export const COMPLETE_SESSION_TOOL: Anthropic.Tool = {
  name: 'complete_session',
  description: 'Mark the current session or structured arc as complete...',
  input_schema: {
    type: 'object' as const,
    required: ['type'],
    properties: {
      type: { type: 'string', enum: ['session', 'arc'] },
      summary: { type: 'string' },
    },
  },
}

// ... additional tool definitions
```

##### 1.2 Tool Executor Module

**New file: `lib/ai/tool-executor.ts`**

Reuses existing `handleFileUpdate()` from `file-write-handler.ts`:

```typescript
import { handleFileUpdate } from '@/lib/markdown/file-write-handler'
import { UserFileSystem } from '@/lib/markdown/user-file-system'
import type { FileUpdateData } from '@/types/chat'

export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  context: { userId: string; sessionType: string; timezone: string }
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  switch (toolName) {
    case 'save_file':
      return executeSaveFile(toolInput, context)
    case 'complete_session':
      return executeCompleteSession(toolInput, context)
    // ... etc
    default:
      return { success: false, error: `Unknown tool: ${toolName}` }
  }
}
```

**Key:** Write permissions enforced server-side using `SESSION_WRITE_PERMISSIONS` from `constants.ts`, scoped to the active arc mode (not base session type) when in a structured arc.

##### 1.3 Agentic Loop in Route Handler

**Modified file: `app/api/chat/route.ts`**

Replace the single `anthropic.messages.stream()` call with an agentic loop:

```typescript
// Pseudocode for the agentic loop (enhanced with research findings)
const MAX_TOOL_ITERATIONS = 5
const REQUEST_START = Date.now()
const MAX_REQUEST_DURATION_MS = 55_000 // 5s buffer before Vercel timeout
let messages = apiMessages
let iteration = 0
let consecutiveFailures = 0

while (iteration < MAX_TOOL_ITERATIONS) {
  // Wall-clock timeout guard (Architecture Strategist)
  if (Date.now() - REQUEST_START > MAX_REQUEST_DURATION_MS) {
    enqueue({ text: '\n\n[Wrapping up — session took longer than expected.]' })
    break
  }

  const messageStream = anthropic.messages.stream({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,  // bumped from 1024
    system: systemPrompt,
    messages,
    tools: toolDefinitions,
  })

  // Abort propagation on client disconnect (Best Practices)
  request.signal.addEventListener('abort', () => messageStream.controller.abort())

  // Stream text events to client
  for await (const event of messageStream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      enqueue({ text: event.delta.text })
    }
  }

  const finalMessage = await messageStream.finalMessage()

  // Check for tool calls
  const toolUseBlocks = finalMessage.content.filter(b => b.type === 'tool_use')

  if (toolUseBlocks.length === 0 || finalMessage.stop_reason === 'end_turn') {
    break // No more tool calls, done
  }

  // Check for split-conversation tools (show_pulse_check, show_options)
  const splitTool = toolUseBlocks.find(b =>
    b.name === 'show_pulse_check' || b.name === 'show_options'
  )
  if (splitTool) {
    // Emit UI event, end this API call. Client resumes with tool_result.
    if (splitTool.name === 'show_pulse_check') {
      enqueue({ showPulseCheck: { context: splitTool.input, toolUseId: splitTool.id } })
    } else {
      enqueue({ showOptions: { options: splitTool.input.options, toolUseId: splitTool.id } })
    }
    // Store partial conversation state for the resume call
    break
  }

  // Emit toolCall event for shimmer indicator
  for (const toolUse of toolUseBlocks) {
    enqueue({ toolCall: { id: toolUse.id, name: toolUse.name } })
  }

  // Execute tools in PARALLEL (Performance Oracle: Promise.allSettled, not serial for loop)
  const toolResults = await Promise.allSettled(
    toolUseBlocks.map(async (toolUse) => {
      try {
        const result = await executeTool(toolUse.name, toolUse.input, context)
        return {
          type: 'tool_result' as const,
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        }
      } catch (error) {
        // Graceful degradation with is_error (Best Practices)
        return {
          type: 'tool_result' as const,
          tool_use_id: toolUse.id,
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          is_error: true,
        }
      }
    })
  )

  const resolvedResults = toolResults.map(r =>
    r.status === 'fulfilled' ? r.value : {
      type: 'tool_result' as const,
      tool_use_id: 'unknown',
      content: 'Tool execution failed',
      is_error: true,
    }
  )

  // Circuit breaker for repeated failures (Best Practices)
  const allErrored = resolvedResults.every(r => r.is_error)
  if (allErrored) {
    consecutiveFailures++
    if (consecutiveFailures >= 2) {
      enqueue({ error: 'Multiple tool executions failed. Please try again.' })
      break
    }
  } else {
    consecutiveFailures = 0
  }

  // Truncate large tool results before re-sending (Performance Oracle: -50-60% token savings)
  const assistantContent = finalMessage.content.map(block => {
    if (block.type === 'tool_use' && block.name === 'save_file') {
      // Replace full content with truncated version for re-send
      return { ...block, input: { ...block.input, content: `[saved: ${block.input.content?.length ?? 0} chars]` } }
    }
    return block
  })

  // Paragraph separator between rounds (Frontend Races)
  enqueue({ roundBoundary: true })

  // Append assistant message + tool results for next iteration
  messages = [
    ...messages,
    { role: 'assistant', content: assistantContent },
    { role: 'user', content: resolvedResults },
  ]
  iteration++
}
```

> **SDK note (Framework Docs):** SDK v0.39.0 fully supports this manual loop pattern. `toolRunner()` requires v0.62.0+ and gives less control over SSE event emission between iterations. The `inputJson` event on `MessageStream` can detect tool calls as they stream (before `content_block_stop`), enabling earlier shimmer indication if needed.

> **Key implementation patterns (Best Practices):**
> - **`is_error: true`** on failed `tool_result` blocks — Claude adapts its response to acknowledge the failure
> - **Circuit breaker** — 2 consecutive all-error iterations → force end loop
> - **AbortController** — propagate `request.signal.abort` to the inner messageStream
> - **Content truncation** — `save_file` content is the largest token consumer. Replace with byte count on re-send.
> - **`tool_choice: { type: 'auto' }` (default)** is correct. Use `disable_parallel_tool_use: true` only if parallel saves cause ordering issues.

##### 1.4 Client-Side SSE Handler Updates

**Modified file: `components/chat/chat-view.tsx`**

In `streamAndFinalize()` (line 596-679), add handling for new SSE events:

```typescript
// 4-state streaming lifecycle (Frontend Races: boolean isStreaming is insufficient)
type StreamPhase = 'idle' | 'streaming' | 'toolExecuting' | 'completing'
const [streamPhase, setStreamPhase] = useState<StreamPhase>('idle')

// Ref counter for shimmer (Frontend Races: concurrent tools need counter, not boolean)
const activeToolCountRef = useRef(0)

if (parsed.toolCall) {
  activeToolCountRef.current++
  setStreamPhase('toolExecuting')
}
if (parsed.roundBoundary) {
  // Paragraph break between agentic loop rounds
  appendToMessage('\n\n')
  activeToolCountRef.current = 0 // All tools for this round are done
  setStreamPhase('streaming')
}
if (parsed.showPulseCheck) {
  // Split-conversation: end stream, render pulse check UI
  setStreamPhase('idle')
  setPendingToolResult({ toolUseId: parsed.showPulseCheck.toolUseId, type: 'pulse_check' })
  setShowCheckinPulse(true)
}
if (parsed.showOptions) {
  // Split-conversation: end stream, render option pills
  setStreamPhase('idle')
  setPendingToolResult({ toolUseId: parsed.showOptions.toolUseId, type: 'options' })
  setSuggestionPills(parsed.showOptions.options)
}
```

> **Shimmer UX detail (Performance Oracle):** Show shimmer for minimum 200ms even if tool execution is faster, to prevent a distracting flash. Use `Math.max(actualDuration, 200)` delay before clearing.

**Critical: Remove client-side file writes.** Currently lines 888-909 of `chat-view.tsx` create a `UserFileSystem` and call `handleAllFileUpdates()` client-side. With tool use, this moves to the server's tool executor. Remove this entire block for migrated sessions.

**Critical: Move `markCapturesFolded` server-side.** Currently runs client-side after close_day journal write (lines 240-253 of `file-write-handler.ts`). Must move to the `save_file` tool executor as post-processing when `file_type === 'daily-log'`.

**Guard with useRef (institutional learning):** The streaming handler processes events from multiple agentic loop rounds. Use `useRef` guards for any state that gates side effects (session completion, domain tracking) to prevent the race condition documented in `Docs/solutions/logic-errors/2026-02-24-react-state-guard-race-condition-stale-batching.md`.

> **Split-conversation race conditions (Frontend Races):** Three specific risks:
> 1. **Message history gap** — when resuming after pulse check, the client must reconstruct the assistant message (including tool_call) + user message (tool_result) to maintain conversation coherence
> 2. **User navigates away** — if user leaves the chat during a split-conversation, store `pendingToolResult` in session metadata so the flow can resume
> 3. **Double-submission guard** — disable the pulse check submit button after first tap. Use a ref, not state, to avoid React batching delay

##### 1.5 Max Tokens Analysis

Current: `max_tokens: 1024`
Proposed: `max_tokens: 4096`

Token budget for a synthesis turn (worst case — life mapping final step):
- Conversational text: ~200-400 tokens
- `save_file(overview)` tool call JSON: ~500-700 tokens (content field is the overview markdown)
- `save_file(life-plan)` tool call JSON: ~400-600 tokens
- `save_file(sage-context)` tool call JSON: ~300-400 tokens
- `complete_session` tool call JSON: ~50 tokens
- JSON overhead per tool call: ~50 tokens

Worst case total: ~1,500-2,200 tokens. **4096 is sufficient with comfortable margin.**

For the second agentic loop round (Sage's closing remarks after tools execute): ~100-200 tokens. Well within budget.

##### 1.6 Database Migration

> **Simplified:** No new column needed. Use existing `metadata` JSONB column on `messages` table. Store tool call records in `metadata.tool_calls`.

Tool call metadata format:
```json
{ "tool_calls": [
  { "name": "save_file", "input": { "file_type": "domain", "file_name": "career" } },
  { "name": "complete_session", "input": { "type": "session" } }
]}
```

Historical messages with `content` containing `[FILE_UPDATE]` blocks continue to render via the parser. New messages store text-only in `content` and tool calls in `metadata.tool_calls`.

##### 1.7 Testing Checklist

- [ ] `save_file` produces equivalent files to `[FILE_UPDATE]` blocks in all session types
- [ ] Streaming UX feels natural — text streams, brief pause for tool execution (~100-200ms), text resumes
- [ ] "Saving..." shimmer indicator appears and disappears correctly
- [ ] Multiple tool calls in one turn (e.g., 3 `save_file` calls in life mapping synthesis) work correctly
- [ ] Parser still renders historical messages with `[FILE_UPDATE]` blocks
- [ ] Session completion via `complete_session` tool works correctly
- [ ] Write permission enforcement: Sage cannot write to unauthorized paths
- [ ] `useRef` guards prevent duplicate side effects in streaming handler
- [ ] No regression in conversation quality

##### 1.8 Rollback

Remove `tools` parameter from `anthropic.messages.stream()`. Re-add `[FILE_UPDATE]` format instructions to prompts. Parser is still functional. Revert `max_tokens` to 1024.

---

#### Phase 2: Skill Rewrites (Sprint B) — 2-3 days

**Goal:** Rewrite 4 existing skills from scripts (~3,000-4,000 tokens) to goals (~300-500 tokens).

**Depends on:** Phase 2.1-2.2 (skill rewrites) can parallel with Phase 1. **Phase 2.3 (remove format instructions) depends on Phase 1** — you cannot remove `[FILE_UPDATE]` format instructions until tool use is active, or Sage will stop producing structured output entirely.

##### 2.1 Rewrite Existing Skills

| Skill | Current File | Current Tokens | Target Tokens | Key Changes |
|---|---|---|---|---|
| `open_day` | `skills/open-day.md` (270 lines) | ~4,000 | ~350 | Remove 5-beat script, 7 HARD RULES. Keep: 2-min timing, intention focus, tool references |
| `close_day` | `skills/close-day.md` (84 lines) | ~1,300 | ~300 | Remove 7-step sequence. Keep: 2-3 min timing, journal metadata requirements |
| `life_mapping` | `prompts.ts:51-281` | ~3,400 | ~500 | Move to `skills/life-mapping.md`. Remove 6-step arc, prescribed depth. Keep: domain coverage, output requirements |
| `weekly_checkin` | `prompts.ts:365-460` | ~1,500 | ~450 | Move to `skills/weekly-checkin.md`. Remove 6-step sequence. Keep: timing, artifact requirements |

**Skill file format (from brainstorm):**
```markdown
# Skill Name

## Goal
What this skill achieves (1-2 sentences).

## When to Use
Context signals that suggest this skill.

## Context Needed
What data to prioritize from the unified context.

## Tools to Use
Which tools and what artifacts to produce.

## Constraints
Real product boundaries (time limits, output reqs).

## Guidance
Light principles (2-5 bullets, NOT step-by-step).
```

##### 2.2 Migrate prompts.ts to Skill Files

Currently `life_mapping` and `weekly_checkin` have no skill files — they use functions in `prompts.ts`. Create:
- `skills/life-mapping.md` — replaces `getLifeMappingPrompt()` (lines 51-281)
- `skills/weekly-checkin.md` — replaces `getWeeklyCheckinBasePrompt()` (lines 365-460)

Keep `prompts.ts` functions as fallback until all skills are validated.

##### 2.3 Remove Format Instructions from Skills

When tool use is active (Phase 1 complete), remove from each skill:
- `[FILE_UPDATE]` format instructions
- `[SUGGESTED_REPLIES]` format instructions
- `[DAY_PLAN_DATA]` format instructions

Replace with brief tool usage guidance:
```
Use the save_file tool to persist artifacts. Use complete_session when the conversation reaches its natural conclusion.
```

##### 2.4 Testing

- [ ] Run 3-5 sessions of each type with rewritten skills
- [ ] Morning sessions stay under 2 minutes / 5-6 exchanges
- [ ] All required output fields present (day plan intention/priorities, journal metadata, domain fields, check-in themes)
- [ ] Conversations feel more natural than scripted versions (qualitative)
- [ ] Users don't feel "lost" without the rigid structure

**Rollback:** `git revert` on individual skill files. Each skill is independent.

---

#### Phase 3: Context Injection Unification (Sprint C) — 2-3 days

**Goal:** Replace session-type-branched `fetchAndInjectFileContext()` with a unified pipeline.

**Depends on:** Nothing. Can parallel with Phases 1-2.

##### 3.1 Context Header Generator

**New function in `lib/ai/context.ts`:**

```typescript
async function buildContextHeader(
  userId: string,
  timezone: string,
  supabase: SupabaseClient
): Promise<string> {
  // Parallel queries for header data
  const [userProfile, lastSession, domainCount, captureCount, checkInStatus] =
    await Promise.allSettled([
      supabase.from('users').select('display_name').eq('id', userId).single(),
      supabase.from('sessions').select('session_type, created_at')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single(),
      // domain count from file_index
      // capture count since last session
      // check-in due calculation
    ])

  return `<session_context>
User: ${name}
Life map: ${domainsMapped}/8 domains mapped
Last session: ${daysSince} days ago (${lastType})
Time: ${dayOfWeek} ${timeBracket} (${localTime})
Calendar today: ${eventCount} events
Active intention: "${currentIntention}"
Check-in: ${dueStatus}
Captures since last session: ${captureCount}
</session_context>`
}
```

##### 3.2 Unified Context Pipeline

Replace the 450-line `fetchAndInjectFileContext()` with:

```typescript
async function buildUnifiedContext(userId: string, timezone: string): Promise<string> {
  const ufs = new UserFileSystem(userId)
  const supabase = await createClient()

  // 1. Context header (~200 tokens)
  const header = await buildContextHeader(userId, timezone, supabase)

  // 2. Standing context (always, parallel reads)
  const [sageContext, overview, lifePlan, weeklyPlan, patterns, pulseBaseline] =
    await Promise.allSettled([
      ufs.readSageContext(),
      ufs.readOverview(),
      ufs.readLifePlan(),
      ufs.readWeeklyPlan(),
      ufs.readPatterns(),
      getBaselineRatings(supabase, userId),
    ])

  // 3. Temporal context (always, parallel reads)
  const [checkIns, dailyLogs, captures, todayDayPlan, yesterdayPlan, calendarEvents, flaggedDomains] =
    await Promise.allSettled([
      ufs.listCheckIns(3),
      ufs.listDailyLogs(7),
      // ... remaining reads
    ])

  // Assemble in consistent order with XML section tags
  const parts = [header]
  if (sageContext) parts.push(`<sage_context>\n${sageContext}\n</sage_context>`)
  if (overview) parts.push(`<life_map_overview>\n${overview}\n</life_map_overview>`)
  // ... all sections
  return parts.join('\n\n')
}
```

**No session-type branching.** All context injected. Model uses the context header to orient.

> **Research Insights for Phase 3:**
>
> **Sanitization (CRITICAL — from Learnings):** Call `stripBlockTags()` on ALL context file reads to prevent stale `[FILE_UPDATE]` or `[SUGGESTED_REPLIES]` tags embedded in markdown files from re-injecting format instructions into the prompt. The current branched pipeline already has this in some paths but not others — the unified pipeline must sanitize universally.
>
> **Flatten all queries (Performance Oracle):** Collapse the two-stage `Promise.allSettled` pattern (standing + temporal) into a single `Promise.allSettled` with all 13+ reads. The sequential await between stages adds 120-210ms of unnecessary latency. Since all reads are independent, execute them all in one parallel batch.
>
> **Context header simplification (Simplicity Review):** Trim to 4 fields: user name, last session (type + days ago), time bracket (morning/afternoon/evening), check-in status. Domain count, calendar count, and active intention are already available in the standing/temporal context sections — duplicating them in the header wastes tokens.

##### 3.3 Update buildConversationContext

Modify `buildConversationContext()` to call `buildUnifiedContext()` instead of `fetchAndInjectFileContext()`. The skill loading logic stays (it's separate from context injection).

##### 3.4 Testing

- [ ] All session types receive relevant context without branching
- [ ] `context.ts` shrinks by ~200 lines
- [ ] Morning sessions still reference calendar (because it's in the unified context, timestamped as today)
- [ ] Evening sessions still reference captures (same reason)
- [ ] No increase in irrelevant context references (qualitative)
- [ ] Token usage increase is ~30% as predicted

**Rollback:** `git revert` on context.ts.

---

#### Phase 4: Extended Tool Set (Sprint D) — 2-3 days

**Goal:** Add remaining tools and replace remaining text-block mechanisms.

**Depends on:** Phase 1 (tool infrastructure).

##### 4.1 New Tools

| Tool | Replaces | Category |
|---|---|---|
| `complete_session` | `detectTerminalArtifact()` string matching | Lifecycle |
| `show_pulse_check` | Client-side `showCheckinPulse` state | Split-conversation |
| `show_options` | `[SUGGESTED_REPLIES]` blocks | Interactive (split-conversation) |
| `enter_structured_arc` | `[ENTER_MODE]` regex detection | Lifecycle |

> **Simplified (from reviews):** `save_day_plan` merged into `save_file` (file_type: 'day-plan', server routes to both Postgres + Storage). `emit_reflection_prompt` merged into `save_file` (file_type: 'reflection-prompt'). `show_options` restored as an interactive tool to eliminate the last text-block parsing dependency.

##### 4.1b `complete_session` CHECK Constraint Handling

> **From institutional learning (Postgres CHECK constraint):** The `sessions.status` column has a CHECK constraint. If a session has auto-expired (status = 'expired'), the tool executor MUST handle this case:

```typescript
async function executeCompleteSession(input, context) {
  const { data: session } = await supabase
    .from('sessions')
    .select('status')
    .eq('id', context.sessionId)
    .single()

  if (session?.status === 'expired') {
    // Can't transition expired → completed. Return informative result.
    return {
      success: false,
      error: 'session_expired',
      message: 'Session expired before completion. Starting fresh next time.'
    }
  }

  // Normal completion flow...
  await supabase.from('sessions').update({ status: 'completed' }).eq('id', context.sessionId)
  return { success: true, next_checkin_due: calculateNextCheckin() }
}
```

##### 4.2 Split-Conversation Pattern for show_pulse_check

```
Round 1:
  Sage: "Let's check in on how your domains are feeling." + tool_call(show_pulse_check)
  Server: Sends { showPulseCheck: { context } } SSE event, then [DONE]
  Client: Renders pulse check UI

User interaction:
  User completes pulse check ratings

Round 2:
  Client: New POST /api/chat with messages including tool_result(show_pulse_check, { ratings })
  Sage: "I see your health rating went from 3 to 2. Let's talk about that."
```

This matches the current flow — `showCheckinPulse` state gates the UI, `triggerSageResponse` sends a new request with the ratings context.

##### 4.3 Two-Phase close_day with Tools

The close_day two-phase flow maps to tool calls:

```
Phase A:
  Sage: [conversation] -> calls save_file(daily-log) -> tool_result: success
  Sage: "Here's what I captured. Does this feel right, or would you change anything?"
  [User confirms or requests edits]

Phase B:
  If user confirms: Sage says goodbye + calls complete_session(type: "session")
  If user edits: Sage calls save_file(daily-log) again with updated content, then repeats Phase B
```

No `pending_completion` metadata flag needed — the flow is natural. The skill guidance tells Sage to ask for confirmation before completing.

##### 4.4 Remove completion-detection.ts

Once `complete_session` tool is active for all session types, `detectTerminalArtifact()` is no longer needed. The entire `lib/ai/completion-detection.ts` file can be deleted.

##### 4.5 Remove ENTER_MODE regex

Replace the regex detection in `route.ts` (lines 454-464) with the `enter_structured_arc` tool handler.

---

#### Phase 5: New Skill Files (Sprint E) — 2-3 days

**Goal:** Expand the skill library with 6 new approach skills.

**Depends on:** Phase 1 (tool references in skills).

##### 5.1 New Approach Skills

Create 6 new files in `skills/`:
- `skills/domain-deep-dive.md` (~350 tokens)
- `skills/crisis-support.md` (~300 tokens)
- `skills/decision-helper.md` (~300 tokens)
- `skills/pattern-review.md` (~250 tokens)
- `skills/life-plan-revision.md` (~250 tokens)
- `skills/capture-review.md` (~250 tokens)

Content defined in `Docs/model_forward_rearchitecture.md` Section 3.3.

##### 5.2 Base Sage Prompt — Skill Awareness

Add to `skills/open-conversation.md`:

```markdown
## Available Approaches

You have these skill approaches available. Draw on them when the conversation calls for it:
- domain_deep_dive: Go deep on a single life domain
- crisis_support: Emotional grounding when user is overwhelmed
- decision_helper: Values-based decision support
- pattern_review: Surface and discuss behavioral patterns
- life_plan_revision: Revisit the quarterly plan
- capture_review: Process accumulated quick captures

You don't need to announce when you're using a skill. Just shift your approach naturally.
```

##### 5.3 Approach Skill Loading Strategy

Approach skills are listed as **one-line summaries** in the base prompt (~200 tokens total). Full skill text is loaded by the context-driven loader ONLY when signals match the "When to Use" criteria. This keeps the base prompt lean while giving Sage full guidance when a skill is contextually relevant.

---

#### Phase 6: Skill Invocation Mechanism (Sprint F) — 2-3 days

**Goal:** Enable context-driven skill loading and composition.

**Depends on:** Phases 4 + 5.

##### 6.1 Context-Driven Skill Loader

Update the API route's skill loading to use context signals:

| Signal | Skill Loaded |
|---|---|
| New user, no life map | `life_mapping` |
| Morning, no day plan today | `open_day` |
| Evening, day plan exists, no journal | `close_day` |
| Check-in due or overdue | `weekly_checkin` |
| Domain flagged `needs_attention`/`in_crisis` | `domain_deep_dive` (full text appended) |
| High emotional intensity detected | `crisis_support` (full text appended) |
| None of the above | Base Sage only |

##### 6.2 Skill Composition Testing

Test these composition scenarios:
- [ ] Weekly check-in surfaces domain crisis -> Sage shifts to domain_deep_dive approach
- [ ] Morning session reveals overwhelm -> Sage shifts to crisis_support approach
- [ ] Open conversation + "should I take this job?" -> Sage draws on decision_helper
- [ ] Pattern review surfaces life plan misalignment -> Sage shifts to life_plan_revision

---

#### Phase 7: Legacy Cleanup (Sprint G) — 1-2 days

**Goal:** Remove scaffolding code no longer needed.

**Depends on:** All above stable for 1+ week.

##### 7.1 Removals

- [ ] Remove `[FILE_UPDATE]`, `[SUGGESTED_REPLIES]`, `[DAY_PLAN_DATA]`, `[ENTER_MODE]` handling from `parser.ts` for new messages (keep for historical rendering)
- [ ] Remove block format instruction assembly from `context.ts` and skill files
- [ ] Delete `lib/ai/completion-detection.ts`
- [ ] Remove client-side file write logic from `chat-view.tsx` (lines 888-1089)
- [ ] Remove client-side session completion detection
- [ ] Remove `getStatePills()` fallback function
- [ ] Clean up deprecated session metadata fields (`pending_completion`)
- [ ] Remove `getLifeMappingPrompt()`, `getWeeklyCheckinBasePrompt()`, `getCloseDayPrompt()` from `prompts.ts` (replaced by skill files)

## Acceptance Criteria

### Functional Requirements

- [ ] All session types work with tool-based output (no regression from text-block parsing)
- [ ] Files saved via `save_file` tool are identical to files saved via `[FILE_UPDATE]` blocks
- [ ] Session completion via `complete_session` tool works for all session/arc types
- [ ] `show_pulse_check` split-conversation flow works end-to-end
- [ ] Historical messages with text blocks still render correctly
- [ ] Structured arc transitions via `enter_structured_arc` tool work correctly
- [ ] Write permissions enforced server-side for all tool calls

### Non-Functional Requirements

- [ ] Streaming UX: tool execution pause is <500ms for instant tools
- [ ] Token budget: 4096 max_tokens sufficient for synthesis-heavy turns
- [ ] Latency: unified context injection adds <200ms vs. current branched injection
- [ ] System prompt size: <15,000 tokens (context header + standing context + skill + tools)

### Quality Gates

- [ ] All existing tests pass (if any)
- [ ] 3-5 manual sessions per session type with rewritten skills
- [ ] No client-side file writes for migrated sessions
- [ ] `useRef` guards on all streaming side effects (institutional learning)
- [ ] No self-fetch patterns (institutional learning — use shared functions)

## Risk Analysis & Mitigation

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Tool call streaming UX feels laggy | Medium | High | Prototype with one tool first. Measure pause duration. Add shimmer indicator with 200ms minimum display. |
| Rewritten skills produce incomplete artifacts | Medium | Medium | A/B test scripted vs. goal-oriented skills during Wave 1. Keep format instructions as fallback. |
| Unified context causes irrelevant references | Low | Low | Context header orients the model. Monitor qualitatively. |
| `max_tokens: 4096` insufficient for synthesis | Low | Medium | Measure actual token usage. Bump to 8192 if needed. |
| Multi-round agentic loop exceeds timeout | Medium | High | `MAX_TOOL_ITERATIONS = 5` + wall-clock timeout (55s) + circuit breaker (2 consecutive failures). |
| Client-side file write removal breaks edge cases | Medium | Medium | Keep parser + client write code as dead path during Phase 1-6. Only delete in Phase 7 after 1+ week stability. |
| **Token cost increase ~2.25x per session** | High | Medium | Truncate `save_file` content in re-sent messages (-50-60% savings). Dynamic `max_tokens` based on turn type. Target ~1.5x actual increase. |
| **Double-write during transition** | Medium | High | While parser and tools coexist, ensure write permissions check blocks duplicate paths. Add a `source: 'tool' \| 'parser'` tag to file writes and reject parser writes for sessions using tools. |
| **Split-conversation state loss** | Medium | Medium | Store `pendingToolResult` in session metadata (not just React state) so flow survives page navigation. |
| **Multi-round text concatenation without whitespace** | High | Low | Emit `roundBoundary` SSE event. Client inserts `\n\n`. |
| **Shimmer flicker on concurrent tools** | Medium | Low | Use ref counter, not boolean. Shimmer stays visible until counter reaches 0. |

### Security Considerations

> **From Security Sentinel review:**
> - **Input validation on all tool parameters** — validate `file_type` enum, `file_name` format (no path traversal), `content` length limits
> - **Write permission bypass** — tool executor must check `SESSION_WRITE_PERMISSIONS` using the effective session type (active arc mode, not base type) before every write
> - **Content injection** — `save_file` content must not contain executable code or script tags that could render in the UI. Sanitize markdown output.
> - **Rate limiting** — existing 20 req/60s rate limit applies to the outer request, but tool execution within a request is not rate-limited. Add per-session tool call limits (e.g., 15 tool calls per request).

## Dependencies & Prerequisites

- Wave 1 testing must complete first (timing decision)
- Anthropic SDK ^0.39.0 supports tool use and streaming (confirmed — `toolRunner` needs v0.62.0+ but is not required)
- `max_tokens` bump from 1024 to 4096 (no dependency, just a config change)
- No new database migration needed (use existing `metadata` column)

## Cross-Cutting Concerns (Span All Phases)

### Tool Executor: UserFileSystem Initialization

The `UserFileSystem` constructor requires a user ID and creates a Supabase client internally. The tool executor runs server-side in the API route where the Supabase client already exists. Either pass the existing client to avoid double-initialization, or accept the overhead (~5ms). Recommendation: pass the client.

### Double-Write Guard During Transition (Phases 1-6)

While the parser and tool executor coexist, a malformed response could trigger both paths. Add a `source` tag:

```typescript
// In tool executor
await handleFileUpdate(fileData, userId, { source: 'tool' })

// In parser path (chat-view.tsx)
if (sessionUsesTools) return // Skip parser-based writes for tool-enabled sessions
await handleAllFileUpdates(parsedBlocks, userId, { source: 'parser' })
```

### Rerender Optimization for Multi-Round Streaming

From institutional learning: streaming handlers fire `setState` on every token, causing rerenders. With multi-round loops, this amplifies. Use the existing patterns:
- Batch text into `requestAnimationFrame` chunks
- `React.memo` on message components with stable keys
- Avoid re-rendering the message list on every token (only the active message)

### `isStreaming` Deadlock Prevention

From institutional learning: a boolean `isStreaming` flag that gates both render AND trigger creates deadlocks. The 4-state `StreamPhase` machine (`idle` → `streaming` → `toolExecuting` → `completing`) prevents this by making each state transition explicit. Never gate the submit button on `streamPhase !== 'idle'` alone — also check for `pendingToolResult` state (split-conversation).

## References & Research

### Internal References

- Architecture audit (previous session): comprehensive analysis of 11 prompts, 6-state state machine, 10+ parser formats
- Strategic plan: [model_forward_rearchitecture.md](Docs/model_forward_rearchitecture.md)
- Brainstorm (resolved decisions): [brainstorm](Docs/brainstorms/2026-02-25-model-forward-rearchitecture-brainstorm.md)
- Race condition learning: [react-state-guard](Docs/solutions/logic-errors/2026-02-24-react-state-guard-race-condition-stale-batching.md)
- Self-fetch auth learning: [self-fetch-auth](Docs/solutions/security-issues/2026-02-24-server-side-self-fetch-missing-auth-check.md)
- Context starvation learning: [context-starvation](Docs/solutions/logic-errors/2026-02-25-code-review-batch-p2-p3-guards-context-paths.md)

### Key Files to Modify

| File | Phase | Change |
|---|---|---|
| `app/api/chat/route.ts` | 1, 4 | Add tool definitions, agentic loop, remove post-stream regex processing |
| `lib/ai/context.ts` | 3 | Replace `fetchAndInjectFileContext` with unified pipeline |
| `lib/ai/skill-loader.ts` | 2 | Extend to support new skill format |
| `components/chat/chat-view.tsx` | 1, 4, 7 | New SSE event handling, remove client-side file writes |
| `lib/ai/parser.ts` | 7 | Keep for backward compat, remove for new messages |
| `lib/ai/completion-detection.ts` | 4 | Delete (replaced by complete_session tool) |
| `lib/ai/prompts.ts` | 2, 7 | Migrate to skill files, then remove |
| `lib/markdown/file-write-handler.ts` | 1 | Reuse as tool executor (no changes needed) |

### New Files to Create

| File | Phase | Purpose |
|---|---|---|
| `lib/ai/tool-definitions.ts` | 1 | Anthropic tool schemas |
| `lib/ai/tool-executor.ts` | 1 | Tool execution dispatch |
| `skills/life-mapping.md` | 2 | Goal-oriented life mapping skill |
| `skills/weekly-checkin.md` | 2 | Goal-oriented weekly check-in skill |
| `skills/domain-deep-dive.md` | 5 | New approach skill |
| `skills/crisis-support.md` | 5 | New approach skill |
| `skills/decision-helper.md` | 5 | New approach skill |
| `skills/pattern-review.md` | 5 | New approach skill |
| `skills/life-plan-revision.md` | 5 | New approach skill |
| `skills/capture-review.md` | 5 | New approach skill |

### External References

- Anthropic SDK TypeScript: tool use with streaming (`anthropic.messages.stream()` with `tools` parameter)
- Anthropic SDK: `client.beta.messages.toolRunner()` — requires SDK v0.62.0+, not needed for initial implementation
- Anthropic SDK: `betaZodTool` helper — requires SDK v0.62.0+, consider for Phase 7 cleanup
- Anthropic: [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- Anthropic: [Advanced Tool Use](https://www.anthropic.com/engineering/advanced-tool-use)
- Anthropic: [Streaming Messages Documentation](https://platform.claude.com/docs/en/build-with-claude/streaming)
- Anthropic: Context management betas (`compact-2026-01-12`, `clear_tool_uses_20250919`) — evaluate for post-launch optimization
- Simon Willison: [Designing Agentic Loops](https://simonwillison.net/2025/Sep/30/designing-agentic-loops/)
- Stream event types for tool use: `content_block_start` (with `ToolUseBlock`), `content_block_delta` (with `InputJSONDelta`), `content_block_stop`, `message_delta` (with `stop_reason: 'tool_use'`)
- `tool_choice` parameter: `auto` (default), `any` (force tool use), `tool` (force specific), `none` (prevent)
- `disable_parallel_tool_use: true` — limits Claude to one tool call per response if ordering matters

### Institutional Learnings Applied

| Learning | Applied In | How |
|---|---|---|
| React state guard race condition | Phase 1.4 | `useRef` guards on all streaming side effects |
| Self-fetch auth bypass | All phases | Shared functions, never HTTP self-fetch between routes |
| Context starvation | Phase 3 | Unified pipeline eliminates branching gaps |
| isStreaming deadlock | Phase 1.4 | 4-state `StreamPhase` machine replaces boolean |
| Postgres CHECK constraint | Phase 4 | `complete_session` checks current status before transition |
| Rerender optimization | Phase 1.4 | `requestAnimationFrame` batching, `React.memo` |
