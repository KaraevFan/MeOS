---
status: pending
priority: p3
issue_id: "107"
tags: [code-review, documentation, api]
dependencies: []
---

# Document `/api/chat` SSE Event Protocol

## Problem Statement

The `/api/chat` SSE stream now emits a new event type `{ sessionCompleted: true }` alongside the existing `{ text: string }`, `{ error: string }`, and `[DONE]` sentinel. This protocol is not documented anywhere. Any API consumer other than the built-in `chat-view.tsx` will not know how to handle this event.

## Findings

- **Source**: agent-native-reviewer
- **Location**: `app/api/chat/route.ts` lines 379, 389

## Proposed Solutions

Add a comment block at the top of the route documenting the SSE event types:

```typescript
/**
 * SSE Event Protocol:
 * - { text: string }           — Streaming token from Claude
 * - { error: string }          — Error message
 * - { sessionCompleted: true } — Session was completed server-side
 * - [DONE]                     — Terminal sentinel, stream ends
 */
```

- **Effort**: Trivial
- **Risk**: None

## Acceptance Criteria

- [ ] SSE event types documented in code comment
