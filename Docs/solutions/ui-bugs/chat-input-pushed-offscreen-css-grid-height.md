---
title: Chat input pushed below viewport due to CSS Grid implicit auto rows
date: 2026-02-19
category: ui-bugs
tags: [css-layout, grid, flexbox, viewport, desktop, onboarding, code-review]
severity: high
components: [components/chat/chat-container.tsx, components/chat/chat-layout.tsx, components/chat/chat-view.tsx]
root_cause_type: css-layout
time_to_fix: 15-20 minutes
verified: true
commit: 870586e
---

# Chat Input Pushed Off-Screen by CSS Grid Implicit Auto Rows

## Problem

On the onboarding conversation (and likely all conversations), on desktop, as messages accumulate the chat input area (text field, send button, voice button) gets pushed below the viewport with no scroll, making it inaccessible.

**Symptom:** Input disappears off the bottom of the screen after ~10 messages. No scrollbar appears at the page level. The only way to interact is to reload.

**Affected paths:** Any session type that routes through `ChatLayout` with the CSS Grid wrapper (specifically `life_mapping` sessions with the sidebar grid, but the `min-h-0` fix applies to all session types).

## Root Cause

CSS Grid implicit auto rows combined with the grid item default `min-height: auto` broke the height constraint chain.

When `ChatLayout` used `grid grid-cols-1 lg:grid-cols-[1fr_auto]` without explicit row sizing, the single grid row was implicitly `auto`. This meant `h-full` on the `ChatView` grid item resolved to the content's intrinsic height rather than the container's height, which disabled the `flex-1` + `overflow-y-auto` scroll behavior on the messages area.

Additionally, CSS Grid items have a default `min-height: auto` which prevents them from shrinking below their content size, compounding the overflow issue.

**The three interacting CSS behaviors:**
1. Grid implicit rows use `auto` sizing (not `1fr`) — rows expand to fit content
2. Grid items have `min-height: auto` by default — prevents shrinking below content size
3. These two defaults break the `flex-1 + overflow-y-auto` scroll pattern that depends on being able to shrink

## Solution

Three-part fix addressing the height constraint chain:

### 1. ChatLayout — Definite Row Sizing

**File:** `components/chat/chat-layout.tsx`

```tsx
// Before:
<div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_auto]">

// After:
<div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_auto] grid-rows-[1fr]">
```

`grid-rows-[1fr]` gives the grid row a definite fractional size, making `h-full` on children resolve to the container's actual height rather than content-based sizing.

### 2. ChatView — Override min-height: auto

**File:** `components/chat/chat-view.tsx`

```tsx
// Before:
<div className="flex flex-col h-full">

// After:
<div className="flex flex-col h-full min-h-0">
```

`min-h-0` overrides the CSS Grid item default `min-height: auto`, allowing the flex column to shrink below content size and enabling overflow scroll on the messages area.

### 3. ChatContainer — Defensive Overflow Containment

**File:** `components/chat/chat-container.tsx`

```tsx
// Added overflow-hidden to the fixed container
<div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[430px]
     pb-[env(safe-area-inset-bottom)] overflow-hidden"
     style={{ bottom: hasActiveSession ? 0 : TAB_BAR_HEIGHT_PX }}>
```

`overflow-hidden` acts as a defensive backstop, preventing any content from escaping the fixed viewport container.

## Verification

- `npm run type-check` passed
- `npm run build` passed
- 7-agent code review: all PASS, zero P1/P2 findings

## Post-Fix Architecture

```
ChatContainer (fixed, top:0/bottom:0|TAB_BAR, overflow-hidden)
  -> ChatLayout (h-full, grid, grid-rows-[1fr]) or passthrough
    -> ChatView (h-full, flex-col, min-h-0)
      -> SessionHeader (auto height)
      -> Messages div (flex-1, overflow-y-auto) — SCROLLS correctly
      -> ChatInput (auto height)
```

Every intermediate wrapper propagates height constraints from the fixed container down to the scrollable messages area. Breaking any link in this chain reproduces the bug.

## Prevention Strategies

### Checklist for Scrollable Layouts Inside Grid

- [ ] Grid container has a fixed/constrained height (`h-full`, `h-screen`, etc.)
- [ ] Rows are explicitly sized with `grid-rows-[...]` — no implicit auto rows
- [ ] Scrollable grid items have `min-h-0` to allow shrinking
- [ ] Grid container has `overflow-hidden` as backstop
- [ ] Flex constraint chain is intact: `flex-1` + `overflow-y-auto` + `min-h-0`
- [ ] Tested with long content (50+ messages / 100+ list items)

### CSS Grid Height Constraint Rules

**Rule 1:** Grid rows size themselves to content by default (`auto`). Explicit `grid-template-rows` with `1fr` or fixed sizes is required when height constraints matter.

**Rule 2:** Grid items have `min-height: auto` by default, preventing shrinking below content size. Override with `min-h-0` when the item needs to participate in flex/scroll layout.

**Rule 3:** The height constraint chain must be unbroken from viewport to scrollable area. Every intermediate wrapper must propagate height constraints.

### Code Review Red Flags

- `display: grid` without explicit row sizing + scrollable children
- Grid items without `min-h-0` that contain flex scroll layouts
- Chat/message layouts using implicit grid rows
- `flex-1 overflow-y-auto` inside a grid item without `min-h-0`

## Related Documentation

- [Chat layout constraint fix (Bug 10)](../code-review-fixes/20260219-react-hooks-security-db-hygiene-multi-pass-review.md) — `fixed inset-0` escaping 430px container
- [Bottom-anchor chat scroll](../../Docs/plans/2026-02-19-fix-r4-2-playtest-patches-plan.md) — Patch 4: proximity-aware scroll
- [Tab bar stale visibility](../../Docs/plans/2026-02-19-fix-tab-bar-stale-visibility-plan.md) — Dynamic bottom offset for ChatContainer

## Resources

- [CSS Grid implicit vs explicit tracks (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Auto-placement_in_grid_layout)
- [min-height: auto in grid/flex (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/min-height)
- Commit: `870586e`
