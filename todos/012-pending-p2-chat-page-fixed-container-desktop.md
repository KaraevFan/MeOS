---
status: pending
priority: p2
issue_id: "012"
tags: [code-review, architecture, layout, desktop]
dependencies: []
---

# 012 — Chat page `fixed inset-0` escapes the 430px phone container on desktop

## Problem Statement

`app/(main)/chat/page.tsx` uses `fixed inset-0 bottom-[84px]` for the chat container. `position: fixed` positions relative to the viewport, not the parent. The `max-w-[430px]` constraint on the layout `div` does not constrain fixed children. On desktop (>430px viewport), the chat area spans the full viewport width — the phone container established by Patch 8 does not apply.

This was not caught in playtest because testing was on mobile (<=430px viewport). It will be visible at any viewport wider than 430px.

There is also a secondary visual issue: the orb button's background mask (`bg-warm-bg/95`) may mismatch the `#F0EDE8` body background on desktop, creating a visible color seam.

## Findings

- **File:** `app/(main)/chat/page.tsx:52` and `:192`
- ```tsx
  <div className="fixed inset-0 bottom-[84px] pb-[env(safe-area-inset-bottom)]">
  ```
- The tab bar and bottom sheet already use `left-1/2 -translate-x-1/2 max-w-[430px]` — chat page needs the same
- Reported by: Architecture reviewer (P2)

## Fix

```tsx
// Replace:
className="fixed inset-0 bottom-[84px] pb-[env(safe-area-inset-bottom)]"

// With:
className="fixed top-0 bottom-[84px] left-1/2 -translate-x-1/2 w-full max-w-[430px] pb-[env(safe-area-inset-bottom)]"
```

Note: Check if there are any child elements that assume full-viewport width and need adjustment.

**Effort:** Small
**Risk:** Low-Medium (test on mobile to ensure layout not broken)

## Acceptance Criteria

- [ ] Chat page constrained to 430px centered column at >430px viewport widths
- [ ] Mobile layout (<=430px) unchanged
- [ ] No child elements break due to the container constraint

## Work Log

- 2026-02-19: Created from PR #19 code review (Architecture reviewer P2)
