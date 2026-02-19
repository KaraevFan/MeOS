---
status: pending
priority: p1
issue_id: "020"
tags: [code-review, typescript, error-handling, sentry, chat]
dependencies: []
---

# 020 — `abandonSession` error silently swallowed — no Sentry capture

## Problem Statement

`abandonSession()` in `sessions.ts` explicitly throws on Supabase error (`if (error) throw error`). The callsite in `chat-view.tsx` catches and silently discards that error with an empty `.catch(() => {})`. If abandonment fails, the session remains `active` in the database, will reappear in the `ActiveSessionCard` on home, and the user will be confused. The codebase already uses `captureException` from Sentry for all meaningful async failures — this callsite is the only exception. The institutional learning `20260219-react-hooks-security-db-hygiene-multi-pass-review.md` flags empty `.catch()` as an anti-pattern: "every `.catch()` handler either logs, retries, or rethrows — never silently swallows."

## Findings

- **File:** `components/chat/chat-view.tsx:214`
- **Evidence:**
  ```ts
  abandonSession(supabase, sessionIdRef.current).catch(() => {})  // ← empty catch
  ```
- `abandonSession` at `lib/supabase/sessions.ts:113`: `if (error) throw error` — caller's catch contract is real
- `captureException` already imported at `components/chat/chat-view.tsx:38`
- Reported by: TypeScript reviewer (HIGH), Simplicity reviewer (HIGH)

## Proposed Solutions

### Option A — Log to Sentry, keep fire-and-forget UX (Recommended)

```ts
abandonSession(supabase, sessionIdRef.current).catch((err) => {
  captureException(err, { tags: { component: 'chat-view', stage: 'abandon_session' } })
})
router.push('/home')
```

**Pros:** User experience unchanged (still navigates away), error visible in Sentry, consistent with rest of codebase
**Cons:** None
**Effort:** Tiny (1 line)
**Risk:** None

### Option B — Await with toast on failure

Show a toast if abandonment fails, allow user to retry.

**Pros:** User-visible feedback
**Cons:** Adds error state UI; over-engineered for MVP — navigating away is still correct behavior even if the DB write fails
**Effort:** Medium
**Risk:** Low

## Recommended Action

Option A — swap empty catch for `captureException`. One line change.

## Technical Details

- **Affected file:** `components/chat/chat-view.tsx` line 214
- **PR:** #20

## Acceptance Criteria

- [ ] `.catch(() => {})` replaced with `captureException(err, { tags: { component: 'chat-view', stage: 'abandon_session' } })`
- [ ] No other empty `.catch()` introduced in this PR

## Work Log

- 2026-02-19: Created from PR #20 code review (TypeScript reviewer HIGH, Simplicity reviewer HIGH)
