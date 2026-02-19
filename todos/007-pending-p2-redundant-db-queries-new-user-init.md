---
status: pending
priority: p2
issue_id: "007"
tags: [code-review, performance, database, chat]
dependencies: []
---

# 007 — Three sequential DB queries in new-user session init where one suffices

## Problem Statement

When an active session exists for a new user, `init()` fires these sequential awaited queries after `loadSessionMessages` has already fetched all messages:

1. `loadSessionMessages` — SELECT all messages for session (already has `role` column)
2. SELECT id FROM messages WHERE session_id = $1 AND role = 'user' LIMIT 1
3. SELECT id FROM messages WHERE session_id = $1 LIMIT 1
4. SELECT id FROM pulse_check_ratings WHERE session_id = $1 LIMIT 1

Queries 2 and 3 are logically redundant — the data they check (`role` column, presence of any message) is already available from the result of query 1. On mobile with 100ms+ RTTs, this adds 200–400ms of avoidable latency to the critical initialization path.

## Findings

- **File:** `components/chat/chat-view.tsx:257–290`
- `loadSessionMessages` returns void; the fetched array is dispatched to state but not returned
- To check `hasNoUserMessages` and `hasNoMessages`, two additional single-purpose queries are made
- Reported by: TypeScript reviewer (P2-C), Performance reviewer (P2)

## Proposed Solutions

### Option A — Derive from already-fetched data (Recommended)

```tsx
// Modify loadSessionMessages to return the fetched messages:
async function loadSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  const { data } = await supabase.from('messages').select(...)...
  setMessages(data ?? [])
  return data ?? []
}

// In init():
const existingMessages = await loadSessionMessages(activeSession.id)
const hasNoUserMessages = !existingMessages.some((m) => m.role === 'user')
const hasNoMessages = existingMessages.length === 0
// Remove the two separate messages queries
```

**Pros:** Eliminates 2 network round-trips; simpler code
**Cons:** Minor refactor of `loadSessionMessages` signature
**Effort:** Small
**Risk:** Low

### Option B — Parallel queries

Run queries 2, 3, 4 in parallel with `Promise.allSettled()`.

**Pros:** Reduces wall-clock time from 3 serial RTTs to 1
**Cons:** Still fires unnecessary queries against data already in memory
**Effort:** Small
**Risk:** Low

## Recommended Action

Option A — return the fetched array from `loadSessionMessages` and derive in-memory.

## Technical Details

- **Affected file:** `components/chat/chat-view.tsx:207–290`

## Acceptance Criteria

- [ ] `loadSessionMessages` returns `ChatMessage[]`
- [ ] `hasNoUserMessages` and `hasNoMessages` derived from the returned array
- [ ] Two separate messages queries removed from `init()`
- [ ] Behavior unchanged for new user flow

## Work Log

- 2026-02-19: Created from PR #19 code review (TypeScript P2-C, Performance P2)
