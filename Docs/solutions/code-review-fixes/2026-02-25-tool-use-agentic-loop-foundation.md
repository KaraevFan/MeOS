---
title: "Phase 1 Tool Use Foundation: Agentic Loop and Server-Side Tool Execution"
date: 2026-02-25
category: code-review-fixes
severity: high
tags:
  - tool-use
  - agentic-loop
  - claude-api
  - sse
  - server-side-writes
  - session-lifecycle
  - rate-limiting
  - split-conversation
status: resolved
component:
  - app/api/chat/route.ts
  - lib/ai/tool-definitions.ts
  - lib/ai/tool-executor.ts
  - components/chat/chat-view.tsx
  - lib/markdown/file-write-handler.ts
symptoms:
  - "Sage emitting 6+ custom text block types ([FILE_UPDATE], [SUGGESTED_REPLIES], etc.) parsed by client-side regex"
  - "File persistence in chat-view.tsx (1,400-line client component) instead of server-side"
  - "No mechanism for Claude to call tools — all structured output encoded as freeform text blocks"
  - "Session lifecycle managed via regex-detected sentinel strings, not explicit model intent"
  - "Single-round streaming: no multi-turn agentic loop for chained actions"
root_cause: >
  The original architecture predated Claude's tool use API and relied on
  prompt-injected custom text block formats with client-side regex parsing.
  This created a fragile parsing layer, placed file persistence in a client
  component, and gave Claude no explicit mechanism to signal intent for
  structured actions. The absence of an agentic loop meant Claude could not
  chain actions (write file → confirm → complete session) within a single request.
---

# Phase 1 Tool Use Foundation: Agentic Loop and Server-Side Tool Execution

## Problem Statement

MeOS relied on regex-parsed text blocks embedded in Claude's prose output — `[FILE_UPDATE]`, `[SESSION_COMPLETE]`, `[ENTER_MODE:]`, `[SUGGESTED_REPLIES]` — to drive all server-side side effects. This approach had three structural weaknesses:

1. **Fragility.** Claude could hallucinate or misformat the delimiter syntax, silently dropping a write or lifecycle event. Regex parsers have no schema enforcement.
2. **No parallel execution.** Text blocks are sequential; the parser processed them after the full stream finished.
3. **No first-class streaming contract.** There was no formal protocol between Claude's output and the server's action surface — the boundary was implicit in prompt wording, not in a typed API.

## Solution Architecture

A three-layer replacement stack:

**Layer 1 — Tool Definitions** (`lib/ai/tool-definitions.ts`): Five Anthropic `Tool` objects with JSON Schema `input_schema`. Active tools assembled dynamically per session type via `getToolDefinitions(sessionType, activeMode)`.

**Layer 2 — Tool Executor** (`lib/ai/tool-executor.ts`): Single `executeTool(toolName, toolInput, context)` dispatcher. Validates input, enforces session-scoped write permissions, rate-limited to 15 calls per serverless invocation.

**Layer 3 — Agentic Loop** (`app/api/chat/route.ts`): `while (iteration < MAX_TOOL_ITERATIONS)` loop (max 5 rounds, 55s wall-clock budget) with streaming, parallel tool execution, circuit breaker, and content truncation.

### Tool Categories

**Execute-and-continue** (server runs tool, appends result, Claude continues):
- `save_file` — writes any markdown file type with typed attributes
- `complete_session` — marks session or arc done
- `enter_structured_arc` — transitions open_conversation into a named arc

**Split-conversation** (server breaks loop; client renders UI; user resumes):
- `show_pulse_check` — renders domain ratings UI
- `show_options` — renders option pills

### Key Implementation Patterns

**Parallel tool execution with error isolation:**
```typescript
const toolResults = await Promise.allSettled(
  toolUseBlocks.map(async (toolUse) => executeTool(toolUse.name, toolUse.input, toolContext))
)
```

**Circuit breaker** (2 consecutive all-error iterations force-terminates):
```typescript
const allErrored = resolvedResults.every((r) => r.is_error)
if (allErrored) {
  consecutiveFailures++
  if (consecutiveFailures >= 2) break
} else {
  consecutiveFailures = 0
}
```

**Content truncation** (saves 50-60% of re-submitted tokens per round):
```typescript
if (block.type === 'tool_use' && block.name === 'save_file') {
  return { ...block, input: { ...blockInput, content: `[saved: ${content.length} chars]` } }
}
```

**Effective type resolution** (consistent pattern across both files):
```typescript
const effectiveType = activeMode ?? sessionType
```

## Bugs Found During Review

### Bug 1: Double `generateSessionSummary` call

**Problem:** Both `tool-executor.ts` and `route.ts` called `generateSessionSummary()` when `complete_session` tool was used, generating the summary twice.

**Fix:** Removed the call from the executor; the route is the single authoritative caller. Added comment documenting the responsibility boundary:
```typescript
// Note: summary generation is handled by the route after all text has been streamed.
// Generating here would cause a double-call since the route also fires generateSessionSummary.
```

### Bug 2: `stop_reason` check logic

**Problem:** Original `toolUseBlocks.length === 0 || stop_reason === 'end_turn'` could theoretically skip valid tool_use blocks.

**Fix:** Inverted to `stop_reason !== 'tool_use' || toolUseBlocks.length === 0` — only continue the loop when Claude explicitly signals tool use:
```typescript
if (finalMessage.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
  break  // no tool use requested — natural end of turn
}
```

### Bug 3: `max_tokens` truncation not handled

**Problem:** If Claude hit `max_tokens`, the loop broke silently with no indication to the user.

**Fix:** Added explicit check with user-visible message:
```typescript
if (finalMessage.stop_reason === 'max_tokens') {
  enqueue({ text: '\n\n[Response was cut short. Please continue the conversation.]' })
  break
}
```

### Bug 4: `UserFileSystem` constructor arity

**Problem:** Early draft passed only `userId` instead of `(supabase, userId)`. Would have caused all tool-based file writes to fail at runtime.

**Fix:** `new UserFileSystem(context.supabase, context.userId)`

## Prevention Strategies

### Responsibility Boundaries
- **Tool executor** owns DB state mutations. **Route** owns SSE event emission and post-stream side effects. If a function inside `tool-executor.ts` needs to emit a client event, surface the intent through the return value and let the route act on it.

### `stop_reason` Handling
- Never infer Claude's intent from the content array alone. `stop_reason` is the authoritative signal; content filtering is secondary.
- If `stop_reason === 'tool_use'` but `toolUseBlocks.length === 0`, capture a Sentry exception — that is an API contract violation.

### Type Safety
- Run `npm run type-check` as a CI gate on every PR. The constructor arity bug is a compile-time error.
- Use `Record<string, unknown>` with explicit narrowing guards for all tool input — no blind casts.

## Architectural Risks for Future Phases

### Module-level `requestToolCallCount`
Safe on Vercel serverless (each invocation gets its own isolate). Would race on long-lived servers. Permanent fix: pass counter through `ToolExecutionContext`.

### `detectTerminalArtifact` cannot see tool-based writes
By design for Phase 1. When prompts are updated (Phase 2), legacy text markers will stop appearing. The `!completedViaToolSession` guard in the route prevents double-completion during the transition. Add Sentry breadcrumbs when the legacy path fires to monitor usage and know when to remove it.

### Legacy text-block parsing still active
Both the tool path and the text path run in the same request. The tool path has permission checks and input validation; the text path does not. Remove the legacy path atomically with prompt updates in the same PR.

### Content truncation limits self-reference
`save_file` content is replaced with `[saved: N chars]` in re-sent messages. Claude cannot reference content from previous tool calls in the same request. Future prompts must not instruct Claude to cross-reference earlier writes.

## Testing Recommendations

- **Agentic loop**: Test `stop_reason` handling for `tool_use`, `end_turn`, `max_tokens`; verify `loopMessages` are not appended after non-tool-use breaks
- **Session completion deduplication**: Mock `generateSessionSummary` and assert `toHaveBeenCalledTimes(1)` even when both tool and legacy paths run
- **Tool executor**: Path traversal rejection, content length boundary (100,000 chars), arc completion with null `activeMode`, double completion guard
- **Rate limiting**: 15-call ceiling, counter reset between requests
- **Permission enforcement**: Verify session-type-specific write restrictions across all session types

## Related Documentation

- [isStreaming deadlock](../runtime-errors/2026-02-24-open-day-flow-isstreaming-deadlock.md) — directly informed the multi-state streaming lifecycle design
- [React state guard race condition](../logic-errors/2026-02-24-react-state-guard-race-condition-stale-batching.md) — `useRef` guard pattern applies to tool execution state
- [Server-side self-fetch auth](../security-issues/2026-02-24-server-side-self-fetch-missing-auth-check.md) — all DB calls use the authenticated Supabase client, never self-fetches
- [Context injection sanitization](../security-issues/2026-02-23-context-injection-sanitization-hardening.md) — `stripBlockTags()` required for all context injected into prompts
- [Postgres CHECK constraint mismatch](../database-issues/2026-02-25-postgres-status-constraint-mismatch-expired-value.md) — executor checks session status before state transitions
- [Conversation architecture type safety](../code-review-fixes/2026-02-24-conversation-architecture-type-safety-fixes.md) — `SessionMetadata` interface and `CompletedArc.mode` field naming

### Planning Documents

- `Docs/plans/2026-02-25-feat-model-forward-rearchitecture-plan.md` — implementation plan with Critical Findings and sprint sequence
- `Docs/brainstorms/2026-02-25-model-forward-rearchitecture-brainstorm.md` — design decisions
- `Docs/model_forward_rearchitecture.md` — strategic direction document

## Verification

All three quality gates pass on the `feat/tool-use-foundation` branch:
- `npm run build` — production build completes with no errors
- `npm run type-check` — TypeScript strict mode passes
- `npm run lint` — ESLint passes
