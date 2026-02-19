---
title: "Timer Leaks and Render Cascades in Life Map Progress Pill During Streaming"
date: 2026-02-19
category: performance-issues
tags: [react-hooks, useRef, useMemo, timer-cleanup, memory-leaks, streaming-performance, component-memoization]
components: [sidebar-context, life-map-progress-pill, chat-view]
problem_type: performance_issue
severity: p1
root_causes:
  - unconsumed_cleanup_function
  - missing_memoization
  - module_scope_violation
  - incomplete_effect_cleanup
resolution_time: quick
---

# Timer Leaks and Render Cascades in Streaming-Heavy React Components

## Problem Statement

A multi-agent code review of the R4.2 playtest patches identified four P1 issues in the Life Map Progress Pill component system — a mobile-only domain exploration indicator shown during life mapping sessions. The component uses Supabase Realtime subscriptions, Framer Motion animations, and auto-expand/collapse timers.

**Impact:**
- Timer leaks cause race conditions when domains complete rapidly
- Streaming text updates (50-200 per response) cascade unnecessary re-renders
- Memory accumulation from uncleaned timers on unmounted components
- Progressive performance degradation during extended conversations

**Files affected:**
- `components/chat/sidebar-context.tsx`
- `components/chat/life-map-progress-pill.tsx`
- `components/chat/chat-view.tsx`

---

## Root Cause Analysis

### Issue 1: Timer Leak in `signalDomainCompleted`

**File:** `components/chat/sidebar-context.tsx`

The `signalDomainCompleted` callback returned a cleanup function, but the caller in `chat-view.tsx` never captured or used it. When called twice rapidly (two domains explored in quick succession), timers stacked — the first timer would fire and reset `lastCompletedDomain` to null, cutting short the second domain's animation.

**Before (leaked pattern):**
```tsx
const signalDomainCompleted = useCallback((domain: string) => {
  setLastCompletedDomain(domain)
  const timer = setTimeout(() => setLastCompletedDomain(null), COMPLETION_SIGNAL_DURATION)
  return () => clearTimeout(timer)  // return value never consumed by caller
}, [])
```

### Issue 2: Missing `useMemo` During Streaming

**File:** `components/chat/life-map-progress-pill.tsx`

Three expensive computations ran on every render without memoization:
1. `pulseMap` — new `Map` from pulse check ratings
2. `domainFileIndex` — filtered/mapped file index
3. `domains` array — full domain data rebuild

During streaming, `streamingText` updates ~50-200 times per Sage response, causing `ChatView` to re-render, cascading to the pill rebuilding these data structures each time.

Additionally, an inline `.map()` in `chat-view.tsx` created unstable prop references, defeating any potential `React.memo` optimization.

### Issue 3: `createClient()` in Component Body

**File:** `components/chat/life-map-progress-pill.tsx`

Supabase client was instantiated inside the render function rather than at module scope. This created a new reference each render and required `eslint-disable` comments on `useEffect` dependencies.

### Issue 4: Auto-Collapse Timer Not Cleaned on Unmount

**File:** `components/chat/life-map-progress-pill.tsx`

The auto-expand effect cleanup cleared `flashTimer` but not `autoCollapseRef.current`. If the component unmounted while the auto-collapse timer was pending, it would call `setIsExpanded(false)` on an unmounted component.

---

## Working Solution

### Fix 1: Ref-Based Timer Management

Store the timer ID in a `useRef` and clear it before setting a new one:

```tsx
const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

const signalDomainCompleted = useCallback((domain: string) => {
  if (completionTimerRef.current) clearTimeout(completionTimerRef.current)
  setLastCompletedDomain(domain)
  completionTimerRef.current = setTimeout(() => {
    setLastCompletedDomain(null)
    completionTimerRef.current = null
  }, COMPLETION_SIGNAL_DURATION)
}, [])
```

**Key:** Each new call clears the previous timer. Only one completion timer can be active at a time.

### Fix 2: Memoize Derived Data and Stabilize Props

In `life-map-progress-pill.tsx`:
```tsx
const pulseMap = useMemo(
  () => new Map((pulseCheckRatings ?? []).map((r) => [r.domain, r.ratingNumeric])),
  [pulseCheckRatings]
)

const domains: PillDomain[] = useMemo(() => {
  const domainFileIndex = new Map(
    fileIndex
      .filter((r) => r.file_type === 'domain' && r.domain_name)
      .map((r) => [r.domain_name!, r])
  )
  return ALL_DOMAINS.map((name) => {
    const indexRow = domainFileIndex.get(name)
    return {
      name,
      iconName: getIconForDomain(name),
      rating: pulseMap.get(name) ?? null,
      explored: domainsExplored.has(name),
      insight: indexRow ? ((indexRow.frontmatter?.preview_line as string) || null) : null,
    }
  })
}, [fileIndex, domainsExplored, pulseMap])
```

In `chat-view.tsx` — stabilize the prop:
```tsx
const pillRatings = useMemo(
  () => pulseCheckRatings?.map((r) => ({ domain: r.domain, ratingNumeric: r.ratingNumeric })) ?? null,
  [pulseCheckRatings]
)

// In JSX:
<LifeMapProgressPill pulseCheckRatings={pillRatings} />
```

### Fix 3: Module-Scope Client

```tsx
const supabase = createClient()  // module scope — single instance

export function LifeMapProgressPill({ ... }) {
  // supabase is stable across renders
}
```

This also allowed removing two `eslint-disable-next-line react-hooks/exhaustive-deps` comments.

### Fix 4: Complete Timer Cleanup

```tsx
return () => {
  clearTimeout(flashTimer)
  if (autoCollapseRef.current) {
    clearTimeout(autoCollapseRef.current)
    autoCollapseRef.current = null
  }
}
```

---

## Prevention Strategies

### Timer Management Rules

1. **Never return cleanup from `useCallback`** — callers won't use it. Use `useRef` instead.
2. **Always clear-before-set** for imperative timers that can be called rapidly.
3. **Count all `setTimeout`/`setInterval` calls in an effect** — each must have a matching `clearTimeout` in cleanup.
4. **Null out refs after clearing** to prevent double-clears.

### Memoization Guidelines for Streaming Components

A "streaming component" updates state 50-200 times per Sage response. In these components:

| Operation | Memoize? | Notes |
|-----------|----------|-------|
| `new Map(array.map(...))` | Always | O(n) cost, reference identity matters |
| `[...array].sort()` | If array > 10 items | O(n log n) cost |
| `array.filter().map()` | If chain > 1 op | Recompute only on dep change |
| Inline `.map()` as prop | Always | Creates new array ref every render |

### Supabase Client Pattern

```tsx
// Module scope (correct)
const supabase = createClient()

export function MyComponent() { /* use supabase */ }

// Inside component body (incorrect — new ref each render)
export function MyComponent() {
  const supabase = createClient()  // DO NOT DO THIS
}
```

### Code Review Checklist

- [ ] All `setTimeout`/`setInterval` cleared in effect cleanup
- [ ] Ref-based timers nulled after clearing
- [ ] All `new Map()`/`new Set()` in render path wrapped in `useMemo`
- [ ] Inline `.map()` props stabilized with `useMemo`
- [ ] `createClient()` at module scope, not in component body
- [ ] No `eslint-disable` without documented reason

---

## Related Documentation

- `docs/solutions/react-hooks/supabase-client-in-usecallback-deps.md` — Supabase client instability patterns
- `docs/solutions/code-review-fixes/20260219-react-hooks-security-db-hygiene-multi-pass-review.md` — O(n^2) streaming perf, parser memoization
- `docs/solutions/performance-issues/breathing-orb-optimization.md` — Inline style objects defeating memoization
- `todos/028-complete-p1-signal-domain-completed-timer-leak.md`
- `todos/029-complete-p1-pill-missing-usememo-streaming-perf.md`
- `todos/030-complete-p1-autocollapse-timer-unmount-leak.md`
- `todos/032-complete-p2-pill-createclient-in-render.md`

---

## Summary

| Issue | Root Cause | Fix | Impact |
|-------|-----------|-----|--------|
| Timer leak | Cleanup return value never consumed | `useRef` + clear-before-set | Prevents race on rapid domain completions |
| Streaming cascades | Maps/arrays rebuilt 50-200x per response | `useMemo` with proper deps | Eliminates unnecessary re-renders |
| Client in render | New Supabase ref each render | Move to module scope | Single instance, clean deps |
| Unmount leak | Partial effect cleanup | Clear all timers in return | No state-on-unmounted warnings |
