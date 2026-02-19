---
status: pending
priority: p2
issue_id: "022"
tags: [code-review, typescript, ux, chat]
dependencies: []
---

# 022 — `onExit` always active even after session completes — misleading exit sheet

## Problem Statement

`SessionHeader` is rendered with `onExit={handleExit}` unconditionally in `ChatView`, regardless of `sessionCompleted` state. After a session completes, the `SessionCompleteCard` is shown and `ChatInput` is hidden — but the × button in the session header remains visible and active. Tapping it after completion triggers `handleExit()`, which counts 3+ user messages and shows "Pause & Exit / Keep Going" — a modal that makes no semantic sense for an already-complete session.

## Findings

- **File:** `components/chat/chat-view.tsx:976–981`
- **Evidence:**
  ```tsx
  <SessionHeader
    sessionType={sessionType}
    exploreDomain={exploreDomain}
    nudgeContext={nudgeContext}
    onExit={handleExit}  // ← always passed, even when sessionCompleted=true
  />
  ```
- `sessionCompleted` state already exists (line 165) and is used to hide `ChatInput` — same guard should apply to `onExit`
- Reported by: TypeScript reviewer (MEDIUM), Architecture reviewer (Low)

## Proposed Solutions

### Option A — Conditional `onExit` prop (Recommended)

```tsx
<SessionHeader
  sessionType={sessionType}
  exploreDomain={exploreDomain}
  nudgeContext={nudgeContext}
  onExit={sessionCompleted ? undefined : handleExit}
/>
```

When `onExit` is `undefined`, `SessionHeader` already suppresses the × button (line 42 of `session-header.tsx`: `{onExit && (...)}`) — no `SessionHeader` changes needed.

**Pros:** One-line fix, no component API change, consistent with existing `onExit?` optionality
**Cons:** None
**Effort:** Tiny
**Risk:** None

### Option B — Different exit action post-completion

After completion, repurpose the × as a "Back to Home" button (navigate without confirmation).

**Pros:** Better UX — completed sessions should have a clear home button
**Cons:** Requires `handleExit` to branch on `sessionCompleted`; more complex
**Effort:** Small
**Risk:** Low

## Recommended Action

Option A as a quick fix. Option B is a desirable UX enhancement for a follow-up.

## Technical Details

- **Affected file:** `components/chat/chat-view.tsx` line 980
- **PR:** #20

## Acceptance Criteria

- [ ] `onExit={sessionCompleted ? undefined : handleExit}` in `ChatView` render
- [ ] After session completes, × button does not appear in session header
- [ ] Manual test: complete a session, confirm × is gone

## Work Log

- 2026-02-19: Created from PR #20 code review (TypeScript reviewer MEDIUM, Architecture reviewer LOW)
