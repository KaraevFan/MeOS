---
status: pending
priority: p3
issue_id: "038"
tags: [code-review, performance, scroll, chat-view]
dependencies: []
---

# 038 — Chat scroll effect fires unthrottled on every `streamingText` change — layout thrashing risk

## Problem Statement

`chat-view.tsx` scroll effect fires on every `streamingText` change (~50-200 times per response). Each invocation reads `scrollHeight`, `scrollTop`, `clientHeight` from DOM, potentially causing layout reflows. Without throttling, this can cause layout thrashing on lower-end devices during long streaming responses.

## Findings

- **File:** `components/chat/chat-view.tsx`
- **Evidence:** A `useEffect` depending on `[messages, streamingText, scrollToBottom]` calls `scrollToBottom()` which reads multiple layout properties from the scroll container. During streaming, `streamingText` updates at a high frequency as tokens arrive, triggering this effect on every character/word chunk.
- Reported by: Performance reviewer (R4.2 code review)

## Proposed Solutions

### Option A — Throttle with `requestAnimationFrame` (Recommended)

Use a `requestAnimationFrame` guard so the scroll logic runs at most once per frame (~60Hz), coalescing multiple `streamingText` updates into a single layout read + scroll.

```tsx
const scrollRafRef = useRef<number | null>(null)
useEffect(() => {
  if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current)
  scrollRafRef.current = requestAnimationFrame(() => {
    scrollToBottom()
    scrollRafRef.current = null
  })
}, [messages, streamingText, scrollToBottom])
```

**Pros:** Eliminates layout thrashing; scroll still feels instant (within 16ms). Cleanup on unmount prevents stale RAF callbacks.
**Cons:** Scroll is delayed by at most one frame (~16ms) — imperceptible to users
**Effort:** Small
**Risk:** Low

### Option B — Debounce with a short timeout

Use a `setTimeout` with a small delay (e.g., 50ms) to batch scroll calls.

**Pros:** Simple
**Cons:** Visible scroll lag during fast streaming; less precise than RAF
**Effort:** Small
**Risk:** Medium — scroll jitter may be noticeable

## Recommended Action

Option A — `requestAnimationFrame` throttle. It is the standard approach for scroll synchronization and introduces no perceptible delay.

## Technical Details

- **Affected file:** `components/chat/chat-view.tsx` — scroll `useEffect`
- **PR:** #20

## Acceptance Criteria

- [ ] Scroll effect is throttled via `requestAnimationFrame`
- [ ] `cancelAnimationFrame` is called on cleanup (effect re-run and unmount)
- [ ] Chat still auto-scrolls smoothly during streaming
- [ ] No scroll jank or missed scroll-to-bottom on message completion
- [ ] TypeScript strict check passes

## Work Log

- 2026-02-19: Created from PR #20 R4.2 code review (Performance reviewer)
