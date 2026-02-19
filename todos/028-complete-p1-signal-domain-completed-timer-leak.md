---
status: complete
priority: p1
issue_id: "028"
tags: [code-review, typescript, react-hooks, sidebar-context, timer-leak]
dependencies: []
---

# 028 — `signalDomainCompleted` timer leak — cleanup function never consumed by caller

## Problem Statement

`signalDomainCompleted` in `sidebar-context.tsx:34-38` returns a cleanup function that is never consumed by the caller in `chat-view.tsx:872`. Each call creates a new `setTimeout` without clearing the previous one. If called rapidly (two domains complete in quick succession), the first timer fires and resets `lastCompletedDomain` to null prematurely, cutting short the second domain's animation.

## Findings

- **File:** `components/sidebar-context.tsx:34-38`
- **Evidence:**
  ```ts
  // signalDomainCompleted returns () => clearTimeout(timer)
  // but caller does:
  signalDomainCompleted(lastNewDomain)  // return value discarded
  ```
  The function returns `() => clearTimeout(timer)` but the caller at `chat-view.tsx:872` does `signalDomainCompleted(lastNewDomain)` without capturing the return value. Each invocation creates a new `setTimeout` that is never cleared, leaking timers and causing race conditions when domains complete in quick succession.
- Reported by: ALL 7 agents (TypeScript reviewer, Security sentinel, Performance oracle, Architecture strategist, Code simplicity reviewer, Agent-native reviewer, Learnings researcher)

## Proposed Solutions

### Option A — Store timer ID in a `useRef` inside the provider, clear on each new call (Recommended)

```tsx
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const signalDomainCompleted = useCallback((domain: string) => {
  if (timerRef.current) clearTimeout(timerRef.current)
  setLastCompletedDomain(domain)
  timerRef.current = setTimeout(() => {
    setLastCompletedDomain(null)
    timerRef.current = null
  }, COMPLETION_SIGNAL_DURATION)
}, [])
```

**Pros:** Self-cleaning — no caller responsibility, impossible to leak. Each new signal automatically cancels the previous timer before starting a fresh one.
**Cons:** None
**Effort:** Small
**Risk:** Low

## Recommended Action

Option A — move timer management into a ref inside the provider. Remove the returned cleanup function since no caller uses it.

## Technical Details

- **Affected files:** `components/sidebar-context.tsx` lines 34-38, `components/chat/chat-view.tsx` line 872
- **PR:** #20

## Acceptance Criteria

- [ ] `signalDomainCompleted` no longer returns a cleanup function
- [ ] Timer ID stored in a `useRef` inside the `SidebarProvider`
- [ ] Each new call to `signalDomainCompleted` clears the previous timer before setting a new one
- [ ] Rapid successive domain completions show the latest domain's animation for the full duration
- [ ] TypeScript strict check passes
- [ ] ESLint passes (no `// eslint-disable` added)

## Work Log

- 2026-02-19: Created from PR #20 R4.2 code review (ALL 7 agents flagged — TypeScript reviewer, Security sentinel, Performance oracle, Architecture strategist, Code simplicity reviewer, Agent-native reviewer, Learnings researcher)
