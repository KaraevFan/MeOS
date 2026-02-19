---
status: complete
priority: p1
issue_id: "030"
tags: [code-review, typescript, react-hooks, timer-leak, life-map-pill]
dependencies: []
---

# 030 — Auto-collapse timer not cleared on unmount — state update on unmounted component

## Problem Statement

In `life-map-progress-pill.tsx:132-154`, the auto-expand effect's cleanup function clears `flashTimer` but does NOT clear `autoCollapseRef.current`. If the component unmounts while the auto-collapse timer is pending (e.g., user navigates away), the timer fires and calls `setIsExpanded(false)` on an unmounted component. This causes a React state-update-on-unmounted-component warning and is a memory leak from the closure holding stale refs.

## Findings

- **File:** `components/chat/life-map-progress-pill.tsx:132-154`
- **Evidence:**
  ```tsx
  return () => {
    clearTimeout(flashTimer)
    // NOTE: autoCollapseRef.current is NOT cleared here
  }
  ```
  The cleanup function only clears the `flashTimer` local variable but leaves the `autoCollapseRef.current` timer running. When the component unmounts mid-animation, the auto-collapse timeout fires against a now-unmounted component, triggering a React warning and leaking memory through the retained closure.
- Reported by: Performance oracle (P1)

## Proposed Solutions

### Option A — Add `autoCollapseRef` cleanup to the effect teardown (Recommended)

```tsx
return () => {
  clearTimeout(flashTimer)
  if (autoCollapseRef.current) {
    clearTimeout(autoCollapseRef.current)
    autoCollapseRef.current = null
  }
}
```

**Pros:** Complete cleanup — no dangling timers on unmount. Eliminates React warning and memory leak. Minimal change.
**Cons:** None
**Effort:** Tiny (2 lines)
**Risk:** None

## Recommended Action

Option A — add `autoCollapseRef.current` cleanup alongside the existing `flashTimer` cleanup in the effect's return function.

## Technical Details

- **Affected file:** `components/chat/life-map-progress-pill.tsx` lines 132-154
- **PR:** #20

## Acceptance Criteria

- [ ] Effect cleanup function clears both `flashTimer` and `autoCollapseRef.current`
- [ ] `autoCollapseRef.current` set to `null` after clearing
- [ ] No React state-update-on-unmounted-component warnings when navigating away during pill animation
- [ ] TypeScript strict check passes
- [ ] ESLint passes (no `// eslint-disable` added)

## Work Log

- 2026-02-19: Created from PR #20 R4.2 code review (Performance oracle P1)
