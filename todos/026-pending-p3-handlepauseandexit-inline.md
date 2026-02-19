---
status: pending
priority: p3
issue_id: "026"
tags: [code-review, typescript, react, simplicity, chat]
dependencies: [019]
---

# 026 — `handlePauseAndExit` is a named `useCallback` wrapping a single expression — should be inlined

## Problem Statement

`handlePauseAndExit` is a `useCallback` whose entire body is `router.push('/home')`. It is called from exactly one place (`onPause` prop of `ExitConfirmationSheet`). `router.push` is already a stable function reference from `useRouter`. There is no reason to name or memoize this callback — it adds 4 lines and one `useCallback` for no benefit. Inlining the lambda at the call site is clearer and removes a dead abstraction.

## Findings

- **File:** `components/chat/chat-view.tsx:224–227`
- **Evidence:**
  ```ts
  const handlePauseAndExit = useCallback(() => {
    // Leave session active (resume via ActiveSessionCard on home screen)
    router.push('/home')
  }, [router])
  ```
  Used only at: `chat-view.tsx:1191 — onPause={handlePauseAndExit}`
- Reported by: Simplicity reviewer

## Proposed Solutions

### Option A — Inline at call site (Recommended)

Remove `handlePauseAndExit` entirely. At the `ExitConfirmationSheet` render:

```tsx
<ExitConfirmationSheet
  open={showExitSheet}
  isOnboarding={isOnboarding}
  onPause={() => router.push('/home')}
  onContinue={() => setShowExitSheet(false)}
/>
```

**Pros:** -4 lines, same behavior, comment moves inline or is dropped (it is self-explanatory)
**Cons:** Technically creates a new lambda every render (negligible for a sheet that opens rarely)
**Effort:** Tiny
**Risk:** None

## Recommended Action

Option A.

## Technical Details

- **Affected file:** `components/chat/chat-view.tsx` lines 224–227, 1191
- **PR:** #20

## Acceptance Criteria

- [ ] `handlePauseAndExit` removed
- [ ] `onPause` receives inline `() => router.push('/home')`

## Work Log

- 2026-02-19: Created from PR #20 code review (Simplicity reviewer)
