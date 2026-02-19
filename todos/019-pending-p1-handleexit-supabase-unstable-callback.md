---
status: pending
priority: p1
issue_id: "019"
tags: [code-review, typescript, react-hooks, chat]
dependencies: []
---

# 019 — `handleExit` includes `supabase` in `useCallback` deps — unstable reference every render

## Problem Statement

`createClient()` is called at the `ChatView` component body level (not in `useMemo`/`useRef`). While `@supabase/ssr`'s `createBrowserClient` returns a singleton internally, each `createClient()` call produces a new JavaScript object reference. Including `supabase` in the `handleExit` `useCallback` dependency array therefore causes a new `handleExit` function identity on every render, defeating memoization. This is inconsistent with every other handler in `ChatView` (which close over `supabase` without listing it as a dep) and inconsistent with the `UserMenuSheet` pattern (which calls `createClient()` inside the handler at the point of use).

The pattern was explicitly flagged in the institutional learning `20260219-react-hooks-security-db-hygiene-multi-pass-review.md` — the approved fix is ref-based stable callbacks, not `useCallback` + broad dependency lists.

## Findings

- **File:** `components/chat/chat-view.tsx:201–222`
- **Evidence:**
  ```ts
  const supabase = createClient()  // line 184 — new object ref every render

  const handleExit = useCallback(() => {
    ...
    abandonSession(supabase, sessionIdRef.current).catch(...)
    ...
  }, [sessionType, initialSessionState?.state, supabase, router])  // supabase in deps
  ```
- Reported by: TypeScript reviewer, Architecture reviewer, Learnings researcher (known pattern)
- Pre-existing pattern throughout `ChatView` for other handlers correctly omits `supabase` from deps

## Proposed Solutions

### Option A — Move `createClient()` inside the handler (Recommended, matches UserMenuSheet)

```ts
const handleExit = useCallback(() => {
  const isOnboarding = ...
  const userMessageCount = ...

  if (isOnboarding) { setShowExitSheet(true); return }

  if (userMessageCount < 3) {
    if (sessionIdRef.current) {
      const supabase = createClient()  // created at point of use — stable semantics
      abandonSession(supabase, sessionIdRef.current).catch(...)
    }
    router.push('/home')
    return
  }

  setShowExitSheet(true)
}, [sessionType, initialSessionState?.state, router])  // no supabase dep
```

**Pros:** Matches `UserMenuSheet` pattern, `handleExit` identity stable across renders
**Cons:** Creates client object on each exit tap (negligible — singleton under the hood)
**Effort:** Small
**Risk:** Low

### Option B — Move supabase to `useRef`

```ts
const supabaseRef = useRef(createClient())
// Use supabaseRef.current in handleExit, no supabase in deps
```

**Pros:** Correct by construction, stable ref
**Cons:** More invasive change; pre-existing `supabase` used throughout the component
**Effort:** Medium
**Risk:** Low

## Recommended Action

Option A — call `createClient()` inside the handler, remove `supabase` from deps array.

## Technical Details

- **Affected file:** `components/chat/chat-view.tsx` lines 184, 201–222
- **PR:** #20

## Acceptance Criteria

- [ ] `supabase` removed from `handleExit` `useCallback` dependency array
- [ ] `createClient()` called inside `handleExit` at point of use (or via ref)
- [ ] TypeScript strict check passes
- [ ] ESLint passes (no `// eslint-disable` added)

## Work Log

- 2026-02-19: Created from PR #20 code review (TypeScript reviewer CRITICAL, Architecture reviewer LOW, Learnings researcher Known Pattern)
