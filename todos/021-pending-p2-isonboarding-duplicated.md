---
status: pending
priority: p2
issue_id: "021"
tags: [code-review, typescript, react, chat]
dependencies: [019]
---

# 021 — `isOnboarding` computed twice in `ChatView` — divergence risk

## Problem Statement

`isOnboarding` is independently computed in two places in `chat-view.tsx`: once inside the `handleExit` `useCallback` (line 202) and once at the render-function level (line 971). The two expressions are currently identical, so they cannot diverge in practice. But they are used for different purposes — behavioral logic (decision tree) vs. presentational (which sheet copy to show) — and a future edit to one without the other would silently mismatch: `handleExit` shows the wrong sheet variant while `ExitConfirmationSheet` displays different copy.

## Findings

- **File:** `components/chat/chat-view.tsx:202` (inside `handleExit`) and `chat-view.tsx:971` (render scope)
- Both: `sessionType === 'life_mapping' && initialSessionState?.state === 'new_user'`
- Since `sessionType` and `initialSessionState` are props, the values cannot change mid-lifecycle — no bug today
- Reported by: TypeScript reviewer (MEDIUM), Architecture reviewer (Low), Simplicity reviewer

## Proposed Solutions

### Option A — Single `useMemo` at component scope (Recommended)

```ts
const isOnboarding = useMemo(
  () => sessionType === 'life_mapping' && initialSessionState?.state === 'new_user',
  [sessionType, initialSessionState?.state]
)
```

Then `handleExit` reads `isOnboarding` from the outer closure (add to its deps array).

**Pros:** Single source of truth, correct `useCallback` deps, idiomatic React
**Cons:** Adds `useMemo` for a boolean derivation (minor overhead)
**Effort:** Small
**Risk:** Low

### Option B — Plain constant at component scope (no memo)

Since the inputs are stable props, `useMemo` is not strictly needed:

```ts
const isOnboarding = sessionType === 'life_mapping' && initialSessionState?.state === 'new_user'
```

**Pros:** Zero overhead, single declaration
**Cons:** Not explicitly memoized — but correct since props are stable
**Effort:** Tiny
**Risk:** Negligible

## Recommended Action

Option B — plain constant. Props are stable; `useMemo` would be over-engineering for a boolean. Add `isOnboarding` to `handleExit` dependency array.

## Technical Details

- **Affected file:** `components/chat/chat-view.tsx` lines 202, 971
- **PR:** #20
- Note: depends on 019 (supabase dep fix) since both touch `handleExit` deps array

## Acceptance Criteria

- [ ] `isOnboarding` declared exactly once at render scope
- [ ] `handleExit` `useCallback` reads `isOnboarding` from closure (add to deps)
- [ ] `ExitConfirmationSheet` receives the same `isOnboarding` value

## Work Log

- 2026-02-19: Created from PR #20 code review (TypeScript reviewer MEDIUM, Architecture LOW, Simplicity reviewer)
