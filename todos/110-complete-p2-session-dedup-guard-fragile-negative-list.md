---
status: complete
priority: p2
issue_id: "110"
tags: [code-review, architecture, chat-routing]
dependencies: []
---

# Session Dedup Guard Uses Fragile Negative-List Pattern

## Problem Statement

The session dedup guard at `app/(main)/chat/page.tsx:105-112` enumerates every context parameter that should bypass session resume using negation. This means every new context parameter added to the chat page must be manually added to this guard, or it will be silently ignored — the exact bug that caused P1 in Playtest 8.

```typescript
if (
  sessionType === 'open_conversation' &&
  !params.explore &&
  !params.nudge &&
  !params.session_context &&
  !params.precheckin &&
  !params.mode  // <-- had to be added to fix P1
)
```

## Findings

- Flagged by: architecture-strategist, agent-native-reviewer, code-simplicity-reviewer
- This is the same class of bug that caused P1 — `mode` was a navigation parameter not in the guard
- Five negated conditions and growing

## Proposed Solutions

### Option A: Extract `hasExplicitContext` boolean (Recommended)
```typescript
const hasExplicitContext = !!(
  params.explore || params.nudge || params.session_context ||
  params.precheckin || params.mode
)

if (sessionType === 'open_conversation' && !hasExplicitContext) {
  // dedup logic
}
```
- Pros: Self-documenting; one place to update when new params added
- Cons: None
- Effort: Small (~5 min)

### Option B: Define context params as a constant array
```typescript
const CONTEXT_PARAMS = ['explore', 'nudge', 'session_context', 'precheckin', 'mode'] as const
const hasExplicitContext = CONTEXT_PARAMS.some(p => params[p])
```
- Pros: Even more maintainable; discoverable via grep
- Cons: Slightly more indirection
- Effort: Small

## Recommended Action

_To be filled during triage_

## Technical Details

- **Affected files:** `app/(main)/chat/page.tsx:105-112`
- **Components:** Chat page routing, session dedup

## Acceptance Criteria

- [ ] Dedup guard uses a centralized "has context" check
- [ ] Adding a new context parameter only requires updating one location
- [ ] No behavior change from current logic

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-25 | Created from PR #34 code review | Negative-list guards are regression magnets |

## Resources

- PR: #34
- Known pattern: P1 bug was caused by this exact omission
