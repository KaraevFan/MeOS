---
status: pending
priority: p1
issue_id: "001"
tags: [code-review, typescript, react-hooks, voice]
dependencies: []
---

# 001 — `handleAutoStop` captures stale closure, `eslint-disable` suppresses real warning

## Problem Statement

`handleAutoStop` is a `useCallback` whose only job is to call `transcribeToField(blob)`. `transcribeToField` is a plain `async function` defined inside the component body — it is recreated on every render. The `useCallback` dependency `[mimeType]` means `handleAutoStop` only re-creates when `mimeType` changes, not when the surrounding render produces a new `transcribeToField`. If any state beyond `mimeType` were ever captured by `transcribeToField`, the ref would silently use stale values. The `// eslint-disable-next-line react-hooks/exhaustive-deps` suppresses a legitimate hook warning that signals a broken dependency contract.

The simplicity reviewer confirms this double-indirection is over-engineered: `transcribeToField` already closes over `mimeType` directly — the `useCallback` around `handleAutoStop` solves nothing.

## Findings

- **File:** `components/chat/chat-input.tsx:102–108`
- **Evidence:**
  ```tsx
  const handleAutoStop = useCallback((blob: Blob) => {
    transcribeToField(blob)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mimeType])

  useEffect(() => { autoStopRef.current = handleAutoStop }, [handleAutoStop])
  ```
- `transcribeToField` is not memoized; it is recreated every render
- The `eslint-disable` comment is the signal that the hook contract is being violated
- Reported by: TypeScript reviewer (P1-A), Simplicity reviewer (P2)

## Proposed Solutions

### Option A — Remove `useCallback` wrapper, assign directly in one effect (Recommended)

```tsx
// Replace both handleAutoStop useCallback + the sync useEffect with one effect:
useEffect(() => {
  autoStopRef.current = (blob: Blob) => transcribeToField(blob)
}, [mimeType])
```

**Pros:** Removes 5 LOC, eliminates the eslint suppression, correct by construction
**Cons:** None for this use case
**Effort:** Small
**Risk:** Low

### Option B — Make `transcribeToField` itself a `useCallback`

```tsx
const transcribeToField = useCallback(async (blob: Blob) => {
  // ... body unchanged
}, [mimeType, setText, setVoiceState, showTranscriptionError])
```

Then `handleAutoStop = useCallback((blob) => transcribeToField(blob), [transcribeToField])` would be valid.

**Pros:** Properly memoizes the function, removes the eslint suppression
**Cons:** More invasive; `transcribeToField` has many deps; risk of missed dep
**Effort:** Small-Medium
**Risk:** Low-Medium

## Recommended Action

Option A — inline the assignment into the `mimeType` effect.

## Technical Details

- **Affected file:** `components/chat/chat-input.tsx` lines 102–108
- **PR:** #19

## Acceptance Criteria

- [ ] `handleAutoStop` `useCallback` removed
- [ ] `autoStopRef` assignment moved to a single `useEffect(() => ..., [mimeType])`
- [ ] No `eslint-disable-next-line react-hooks/exhaustive-deps` comments remaining in file
- [ ] Voice auto-stop still triggers `transcribeToField` correctly (manual test)

## Work Log

- 2026-02-19: Created from PR #19 code review (TypeScript reviewer P1-A, Simplicity P2)
