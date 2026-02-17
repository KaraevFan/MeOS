---
title: "fix: Post-onboarding pulse check not recognized in conversation"
type: fix
date: 2026-02-17
---

# fix: Post-onboarding pulse check not recognized in conversation

## Overview

After completing onboarding (pulse check + spider chart), users land on `/chat` and see a generic "I'm here whenever. Anything on your mind?" greeting instead of Sage acknowledging their pulse check data. The console shows multiple 406 errors from Supabase. Root cause: the session state machine has a gap where post-onboarding users are misclassified as `mapping_complete`, which cascades into wrong session type, wrong greeting, and no pulse-aware Sage trigger.

## Problem Statement

Three interrelated bugs create this broken experience:

1. **State machine gap** (`session-state.ts`): `detectSessionState()` returns `mapping_complete` for a user who just finished onboarding. The logic checks `onboarding_completed` (true) → skips `new_user`, finds the active onboarding session but it has no user messages or explored domains → falls through, no `next_checkin_at` → defaults to `mapping_complete`.

2. **Empty session not handled** (`chat-view.tsx`): The active session path (line 228+) assumes any active session has messages. When it finds the onboarding session with 0 messages, it doesn't generate an opening message or trigger Sage — the user gets an empty conversation.

3. **Noisy 406 errors** (`life-map.ts`): `upsertDomain()` uses `.single()` on line 60 to check if a domain exists before insert/update. For new users with no domains, PostgREST returns 406. The insert still works (code falls to else branch), but the console fills with errors.

### Impact chain

```
detectSessionState → mapping_complete (wrong)
  → chat/page.tsx sets sessionType = 'ad_hoc' (wrong, should be life_mapping)
    → ChatView queries for active ad_hoc session → none → .single() returns 406
      → Creates new ad_hoc session with generic greeting
        → Ad-hoc auto-trigger fires with "Generate your opening message" (generic)
          → Sage never gets pulse-specific instruction
            → User sees generic response, pulse data ignored
```

## Proposed Solution

### Fix 1: `lib/supabase/session-state.ts` — Recognize post-onboarding users

After the active session checks (line 98), before the check-in timing logic (line 100), add a check: if `onboarding_completed` is true but no sessions have ever been **completed**, return `new_user`.

This reuses the existing `new_user` state rather than adding a new state, because all downstream consumers already handle `new_user` correctly when combined with `hasOnboardingPulse`:
- `chat/page.tsx`: `new_user` → `sessionType` stays as default `'life_mapping'`
- `chat-view.tsx`: `new_user` + `hasOnboardingPulse` → pulse-aware opening + auto-trigger
- `getSageOpening('new_user', name, true)` → "Hey, Tom — thanks for sharing that snapshot..."

```typescript
// After line 98 (end of active session block), before line 100:

// Post-onboarding: user completed onboarding but hasn't finished a real conversation yet
if (!lastCompleted) {
  return {
    state: 'new_user',
    activeSessionId: activeSession?.id,
    activeSessionType: activeSession?.session_type,
    userName,
  }
}
```

### Fix 2: `components/chat/chat-view.tsx` — Handle empty active sessions

The active session path (line 228) finds the onboarding session but doesn't generate an opening message or trigger Sage when there are no messages. Add handling for this case:

When an active session has 0 messages:
1. Check for baseline pulse data
2. Generate an opening message via `getSageOpening(state, userName, hasOnboardingPulse)`
3. Save the opening message to the session
4. If pulse data exists, fetch onboarding context (intent, name, quick replies) and auto-trigger Sage with pulse-check-aware instruction

This mirrors the logic already in the "else" branch (lines 270-421) but for the active-session-found case.

Also fix `.single()` → `.maybeSingle()` on line 226 (active session query).

### Fix 3: `lib/supabase/life-map.ts` — Fix `.single()` → `.maybeSingle()`

Line 60: change `.single()` to `.maybeSingle()` in `upsertDomain()`. This eliminates the 406 console errors without changing behavior (the code already handles null correctly via the if/else on line 73).

## Technical Considerations

- **Why reuse `new_user` instead of adding a new state?** Adding `post_onboarding` would require changes in `session-state.ts`, `chat/page.tsx`, `chat-view.tsx`, and `getSageOpening()`. Reusing `new_user` works because `hasOnboardingPulse` already distinguishes "never onboarded" from "just onboarded" in all consumer code.

- **Race condition:** Onboarding uses `await Promise.allSettled(...)` before redirecting, so domain seeding and metadata storage complete before `/chat` loads. No race condition.

- **Idempotency:** If user refreshes `/chat` after the opening message is saved, the active session path will find the session with 1 assistant message, load it, and not re-trigger. Safe.

- **Duplicate opening messages:** The empty-messages check (`!existingMessages?.length`) ensures the opening is only generated once. Subsequent loads find existing messages and skip.

## Acceptance Criteria

- [x] New user completes onboarding → lands on `/chat` → sees "Hey, [name] — thanks for sharing that snapshot..." opening
- [x] Sage auto-responds with pulse-check-aware pattern read (references domains, proposes starting with lowest-rated)
- [x] Onboarding context (intent, name, quick replies) is woven into Sage's response
- [x] No 406 errors in browser console during onboarding or chat initialization
- [x] Existing flows unaffected: returning users, session resume, check-in routing, ad-hoc conversations
- [x] Purged-and-re-registered user follows same post-onboarding flow correctly

## Files to Change

| File | Change | Risk |
|---|---|---|
| `lib/supabase/session-state.ts` | Add `!lastCompleted` check after line 98 | Low — additive, existing tests still pass |
| `components/chat/chat-view.tsx` | Handle empty active sessions (opening + pulse trigger); `.single()` → `.maybeSingle()` on line 226 | Medium — new code path, needs careful testing |
| `lib/supabase/life-map.ts` | `.single()` → `.maybeSingle()` on line 60 | Trivial — one word change, no behavior change |

## Test Plan

1. **Primary flow (the bug):** Create fresh account → complete onboarding → verify pulse-aware Sage greeting
2. **Purged user:** Run purge-user.sql → re-register → same as above
3. **Returning user:** User with completed sessions → verify `mapping_complete` state still works
4. **Session resume:** User mid-conversation → navigate away → return → verify messages load
5. **Check-in routing:** User with `next_checkin_at` due → verify check-in flow
6. **Console clean:** No 406 errors during any of the above flows
7. **Refresh safety:** Complete onboarding → land on chat → refresh page → verify no duplicate opening messages

## References

- Documented solution: `Docs/solutions/security-issues/rls-auth-data-leak-fix.md` — idempotency patterns for fire-and-forget endpoints
- Documented solution: `Docs/solutions/security-issues/markdown-storage-security-review-fixes.md` — `Promise.allSettled` pattern, deny-by-default
- Codebase convention: `.maybeSingle()` is established pattern for optional lookups (used correctly in 15+ locations)
