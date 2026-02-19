---
status: pending
priority: p2
issue_id: "011"
tags: [code-review, performance, react, chat]
dependencies: ["003"]
---

# 011 — `parseMessage` + `renderInlineMarkdown` called on every render with no memoization

## Problem Statement

`parseMessage(message.content)` is called inside `messages.map()` during render — a 598-line parser running on every message, on every render cycle. PR #19 adds paragraph splitting and `renderInlineMarkdown` calls downstream. During streaming, each token causes a re-render, meaning 20+ parse operations per streaming tick at a 20-message conversation. At 30+ messages (typical life mapping), this is a credible source of jank on mobile.

## Findings

- **File:** `components/chat/chat-view.tsx:984` — `parseMessage` inside `messages.map()`
- **File:** `components/chat/message-bubble.tsx:34, 47` — paragraph split + `renderInlineMarkdown` called on each Sage message render
- `TextSegment` not wrapped in `React.memo`
- Reported by: Performance reviewer (P2), TypeScript reviewer noted the O(n²) aspect

## Proposed Solutions

### Option A — Memoize parsed messages in `chat-view.tsx` (Recommended)

```tsx
const parsedMessages = useMemo(
  () => messages.map((m) => ({ message: m, parsed: parseMessage(m.content) })),
  [messages]
)

// Then in the render:
{parsedMessages.map(({ message, parsed }, index) => (
  <MessageBubble message={message} parsedContent={parsed} ... />
))}
```

**Pros:** Eliminates redundant parsing on streaming ticks; `messages` only changes when a new message arrives or content changes
**Cons:** `messages` changes on every streaming tick (content update), so `useMemo` recomputes on every tick for the streaming message. Need to key by message `id` + content length or use `useRef` cache.
**Effort:** Medium
**Risk:** Low

### Option B — `React.memo` on `MessageBubble` + `TextSegment`

Wrap `MessageBubble` and `TextSegment` in `React.memo`. Since `parsedContent` is derived during render, the memo would break unless `parsedContent` is memoized upstream first.

**Effort:** Medium (needs Option A first)
**Risk:** Low

### Option C — Message-keyed parse cache (Optimal)

```tsx
const parseCacheRef = useRef<Map<string, ParsedMessage>>(new Map())

// Inside messages.map():
const cacheKey = `${message.id}:${message.content.length}`
if (!parseCacheRef.current.has(cacheKey)) {
  parseCacheRef.current.set(cacheKey, parseMessage(message.content))
}
const parsed = parseCacheRef.current.get(cacheKey)!
```

**Pros:** O(1) cache lookup for completed messages; only re-parses streaming message
**Cons:** Cache grows unbounded (bounded by session message count — acceptable)
**Effort:** Small
**Risk:** Low

## Recommended Action

Option C — ref-based message cache. Zero re-renders for stable messages; only active streaming message re-parses.

## Technical Details

- **Affected files:**
  - `components/chat/chat-view.tsx:984`
  - `components/chat/message-bubble.tsx`

## Acceptance Criteria

- [ ] `parseMessage` not called for messages that haven't changed since last render
- [ ] Streaming tick causes parse of only the streaming message (not all messages)
- [ ] No visual regression in message rendering

## Work Log

- 2026-02-19: Created from PR #19 code review (Performance reviewer P2)
