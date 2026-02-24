---
status: pending
priority: p2
issue_id: "100"
tags: [code-review, architecture, react-hooks]
dependencies: []
---

# Dual Completion Race Condition — Server + Client Both Call `completeSession()`

## Problem Statement

The PR adds server-side completion detection but preserves all client-side `completeSession()` calls as fallback, guarded by `!sessionCompleted`. However, React state updates are batched — when the SSE `sessionCompleted` event arrives and calls `setSessionCompleted(true)`, the state is not yet `true` when the subsequent client-side code checks it synchronously. Result: both server and client call `completeSession()`, causing redundant DB writes.

## Findings

- **Source**: kieran-typescript-reviewer, architecture-strategist, performance-oracle, simplicity-reviewer, agent-native-reviewer
- **Location**: `components/chat/chat-view.tsx` lines 625-627 (SSE handler), 987-989, 1040-1054, 1074-1088 (client guards)
- **Known Pattern**: `docs/solutions/react-hooks/supabase-client-in-usecallback-deps.md` documents similar stale closure issues
- **Impact**: `completeSession()` is effectively idempotent (UPDATE is a no-op on already-completed rows), so no data corruption — but wastes DB round-trips and `next_checkin_at` is set twice

## Proposed Solutions

### Option A: Ref-based guard (Recommended)

Use a `useRef` that is updated synchronously when the SSE event arrives:

```typescript
const sessionCompletedRef = useRef(false)

// In streamAndFinalize SSE handler:
if (parsed.sessionCompleted) {
  sessionCompletedRef.current = true
  setSessionCompleted(true)
}

// In sendMessage guards:
if (hasDayPlan && !sessionCompletedRef.current) { ... }
```

- **Effort**: Small
- **Risk**: Low

### Option B: Make `completeSession()` idempotent with WHERE guard

Add `WHERE status != 'completed'` to the UPDATE query so double-calls are no-ops at the DB level.

- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] Only one `completeSession()` call fires per session completion
- [ ] No redundant Supabase writes visible in logs
