---
status: pending
priority: p2
issue_id: "034"
tags: [code-review, typescript, react-hooks, stale-closure, life-map-pill]
dependencies: []
---

# 034 — Stale `isExpanded` closure in pill auto-expand effect

## Problem Statement

In `life-map-progress-pill.tsx:132-154`, the auto-expand effect has `[lastCompletedDomain]` as its dependency but reads `isExpanded` in the closure (line 139: `if (!isExpanded)`). Since `isExpanded` is not in the dependency array (suppressed by eslint-disable), the closure captures a stale value. If `isExpanded` changes between renders — e.g., the user manually collapses the pill, then a domain completes — the effect uses an outdated `isExpanded` value and may incorrectly skip or trigger the auto-expand.

## Findings

- **File:** `components/chat/life-map-progress-pill.tsx:132-154`
- **Evidence:**
  ```tsx
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!lastCompletedDomain) return
    setFlashText(...)
    if (!isExpanded) {       // <-- stale closure: isExpanded not in deps
      // auto-expand logic
    }
    return () => clearTimeout(flashTimer)
  }, [lastCompletedDomain])  // <-- missing isExpanded
  ```
  The `isExpanded` value is captured when the effect is created but never refreshed. If the user toggles expand state between domain completions, the effect reads stale data.
- Reported by: TypeScript reviewer (MEDIUM)

## Proposed Solutions

### Option A — Use a ref to track expanded state (Recommended)

```tsx
const isExpandedRef = useRef(isExpanded)
isExpandedRef.current = isExpanded

useEffect(() => {
  if (!lastCompletedDomain) return
  setFlashText(...)
  if (!isExpandedRef.current) {
    // auto-expand logic
  }
  return () => clearTimeout(flashTimer)
}, [lastCompletedDomain])
```

**Pros:** Effect still only fires when `lastCompletedDomain` changes (correct behavior — we don't want it to re-fire when `isExpanded` toggles), but always reads the current `isExpanded` value via the ref
**Cons:** One extra ref
**Effort:** Small
**Risk:** Low

### Option B — Add `isExpanded` to dependency array

```tsx
useEffect(() => {
  // ...
}, [lastCompletedDomain, isExpanded])
```

**Pros:** No ref needed
**Cons:** Effect re-runs when `isExpanded` changes, which may trigger unintended `setFlashText` calls even without a new domain completion. Would need an additional guard.
**Effort:** Small
**Risk:** Medium — side effects of re-running on `isExpanded` change need careful testing

## Recommended Action

Option A — ref approach. The effect should only trigger on domain completion, but needs a current read of `isExpanded`. A ref is the idiomatic React pattern for this.

## Technical Details

- **Affected file:** `components/chat/life-map-progress-pill.tsx` lines 132-154
- **PR:** #20

## Acceptance Criteria

- [ ] `isExpanded` read via a ref inside the auto-expand effect, not from a stale closure
- [ ] Effect dependency array remains `[lastCompletedDomain]` (does not re-fire on expand toggle)
- [ ] `eslint-disable` comment for `react-hooks/exhaustive-deps` removed (ref makes it unnecessary)
- [ ] Manual collapse followed by domain completion correctly triggers auto-expand
- [ ] TypeScript strict check passes
- [ ] ESLint passes

## Work Log

- 2026-02-19: Created from PR #20 R4.2 code review (TypeScript reviewer MEDIUM)
