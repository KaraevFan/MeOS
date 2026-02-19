---
status: pending
priority: p1
issue_id: "003"
tags: [code-review, performance, typescript, chat]
dependencies: []
---

# 003 — O(n²) `.some()` computed inside `.map()` in chat render

## Problem Statement

`hasNoUserMessages` is computed by calling `.some((m) => m.role === 'user')` inside the `messages.map()` render loop. For a conversation with 40 messages, this runs a full array scan over all 40 messages, 40 times — O(n²) for the render. The result is identical on every iteration; it should be hoisted above the map.

At 30+ messages (a typical life mapping session), this compounds with the pre-existing `parseMessage` call (598-line parser) also inside the map, making every streaming tick progressively more expensive.

## Findings

- **File:** `components/chat/chat-view.tsx:1006`
- **Evidence:**
  ```tsx
  // Inside messages.map() — runs O(n) per message, O(n²) total
  const hasNoUserMessages = !messages.some((m) => m.role === 'user')
  ```
- Messages is the full array, scanned fresh on each iteration
- Reported by: TypeScript reviewer (P1-C)

## Proposed Solutions

### Option A — Hoist above the map (Recommended)

```tsx
// Before the messages.map():
const hasNoUserMessages = !messages.some((m) => m.role === 'user')

{messages.map((message, index) => {
  // hasNoUserMessages is now from outer scope — computed once
  ...
})}
```

**Pros:** O(n) total, trivial change, no logic change
**Cons:** None
**Effort:** Tiny (2-line change)
**Risk:** None

### Option B — Memoize with `useMemo`

```tsx
const hasNoUserMessages = useMemo(
  () => !messages.some((m) => m.role === 'user'),
  [messages]
)
```

Slightly better than Option A since it only re-runs when `messages` changes, not on every render.

**Pros:** Optimal memoization
**Cons:** Minor overhead of `useMemo` for a cheap computation; messages changes on every streaming tick anyway
**Effort:** Tiny
**Risk:** None

## Recommended Action

Option B — `useMemo` since `messages` changes frequently during streaming.

## Technical Details

- **Affected file:** `components/chat/chat-view.tsx:1006`
- **PR:** #19

## Acceptance Criteria

- [ ] `hasNoUserMessages` computed outside the `messages.map()` loop
- [ ] No behavioral change to quick reply button visibility

## Work Log

- 2026-02-19: Created from PR #19 code review (TypeScript reviewer P1-C)
