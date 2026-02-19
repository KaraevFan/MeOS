---
title: "fix: R4.4 Close the Day Playtest Patches"
type: fix
date: 2026-02-19
source: Docs/feedback/20260219_R4d_close_day.md
---

# Fix: R4.4 Close the Day Playtest Patches

## Overview

Four patches from the Close the Day playtest (R4 checklist section 2). Close the Day works end-to-end but needs consent flow, depth tuning, tab bar fix, and a date bug fix before demos.

**Priority order:** Patch 4 (date bug) > Patch 2 (tab bar) > Patch 1 (consent) > Patch 3 (depth). This differs from the spec's ordering because Patches 4 and 2 are surgical, low-risk fixes that unblock demo quality, while Patches 1 and 3 are prompt + state machine changes that interact with each other and should be done together.

## Patch 4: JournalCard Date Bug (P1 — trust)

### Problem

JournalCard shows "Friday, Jan 9" instead of the actual date (Feb 19, 2026). Root cause: the JournalCard date comes from `data.name` — whatever Sage puts in `[FILE_UPDATE name="..."]`. If Sage hallucinates the date, the card shows a wrong date. There is no system-level override.

### Fix

**Override Sage's date with the system clock on the client side.** The JournalCard should always display the current local date, not trust Sage's output.

**File: `components/chat/journal-card.tsx`**

Change line 32 from:
```tsx
const date = data.name
```
to:
```tsx
// Always use client's current date for display — Sage's name attr may be hallucinated.
// For close_day sessions spanning midnight, this shows the date the card rendered,
// which matches the user's perception of "today."
const date = undefined // forces formatDate() to use new Date()
```

The existing `formatDate()` function (lines 20-29) already has the fallback:
```tsx
if (!dateStr) return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
```

**File: `lib/ai/prompts.ts` (getCloseDayPrompt)**

Inject today's date into the prompt so Sage uses the correct date for the `name` attribute (which determines the file path via `file-write-handler.ts`):

In `getCloseDayPrompt()`, add a parameter for today's date and inject it:
```
Today's date is ${todayDate} (YYYY-MM-DD format). Use this exact value for the name attribute.
```

**File: `app/api/chat/route.ts`**

Pass the client's local date to the prompt builder. Add `clientDate` to the request body (sent from ChatView), or compute it server-side with a note that server timezone may differ.

Simpler approach: compute in the prompt function using `new Date().toLocaleDateString('en-CA')` (yields YYYY-MM-DD). This uses the server's timezone, which may differ from the client by a few hours, but is sufficient for MVP.

### Acceptance Criteria

- [x] JournalCard always displays the correct current date (client-side `new Date()`)
- [x] Sage's `[FILE_UPDATE name="..."]` attribute uses today's date (injected into prompt)
- [x] No hardcoded dates in JournalCard component or close_day system prompt
- [x] `formatDate()` still gracefully handles edge cases (missing date, malformed date)

### Files Changed

| File | Change |
|------|--------|
| `components/chat/journal-card.tsx` | Ignore `data.name` for display, always use `new Date()` |
| `lib/ai/prompts.ts` | Inject today's date into `getCloseDayPrompt()` |

---

## Patch 2: Tab Bar / Back to Home Redundancy (P1 — polish)

### Problem

Tab bar reappears after session completes alongside the "Back to Home" button, creating two competing exit paths.

**Root cause:** `chat-view.tsx:166` — `setHasActiveSession(!!sessionId && !sessionCompleted)`. When `sessionCompleted` becomes `true`, `hasActiveSession` flips to `false`, and the tab bar reappears.

### Fix

**One-line change:** Remove `!sessionCompleted` from the `hasActiveSession` derivation. The tab bar stays hidden as long as the user is on `/chat` with a session (active or completed). The cleanup on unmount (`return () => setHasActiveSession(false)`) already handles navigation away.

**File: `components/chat/chat-view.tsx`**

Change line 166 from:
```tsx
setHasActiveSession(!!sessionId && !sessionCompleted)
```
to:
```tsx
setHasActiveSession(!!sessionId)
```

And remove `sessionCompleted` from the dependency array on line 167.

**Why this is safe:**
- `SessionHeader.onExit` is already set to `undefined` when `sessionCompleted` is true (line 1055), so the exit button correctly disappears after completion
- The "Back to Home" button in `SessionCompleteCard` navigates to `/home`, which unmounts `ChatView`, triggering the cleanup that resets `hasActiveSession` to `false`
- The session header remains visible (good — provides context)
- This applies to ALL session types uniformly

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Session completes, user stays on /chat | Tab bar hidden, "Back to Home" is sole exit |
| User taps "Back to Home" | Navigates to /home, ChatView unmounts, tab bar reappears |
| Browser refresh on completed session | Session loaded from DB, `sessionId` is set, tab bar hidden — BUT `sessionCompleted` initializes to `false` in state. Need to detect completed session on load. |
| Life mapping completion | Shows "View your Life Map" instead of "Back to Home" — still sole exit, tab bar hidden |

**Browser refresh edge case:** When resuming a completed session after refresh, the init logic loads messages but does not check `session.status === 'completed'`. This is a pre-existing issue and out of scope for this patch (users almost never refresh on the completion screen).

### Acceptance Criteria

- [x] Tab bar remains hidden after session completes, while "Back to Home" is visible
- [x] Tapping "Back to Home" navigates to home screen with tab bar visible
- [x] This behavior is consistent across all session types
- [x] No double-exit paths visible at any point during or after a session

### Files Changed

| File | Change |
|------|--------|
| `components/chat/chat-view.tsx` | Remove `!sessionCompleted` from `setHasActiveSession` condition (line 166) |

---

## Patch 1: User Consent Before Session Close (P1 — demo quality)

### Problem

Sage auto-generates the JournalCard and ends the session without asking if the user is done. The user might have more to say or want to correct the card.

### Architecture Decision: Two-Phase Session Completion

Currently, `hasDailyLog` in the FILE_UPDATE handler (chat-view.tsx:945-951) immediately triggers `completeSession()`. This must become a two-phase flow:

**Phase A — Card generated, session still active:**
- Sage emits `[FILE_UPDATE type="daily-log"]` block
- File is written to storage (existing behavior)
- JournalCard renders in chat (existing behavior)
- Session stays active — `completeSession()` is NOT called
- ChatInput stays visible — user can respond
- Sage's message after the card asks: "Does this capture the day?"

**Phase B — User confirms, session completes:**
- User sends a response (affirmative or correction)
- If affirmative → Sage closes warmly, no new FILE_UPDATE → session completes
- If correction → Sage regenerates the FILE_UPDATE → new JournalCard appears → Sage asks again

**How to signal final completion:** Introduce an `awaitingJournalConfirmation` state. When a `daily-log` FILE_UPDATE is detected:
1. Set `awaitingJournalConfirmation = true`
2. Do NOT call `completeSession()`
3. On the NEXT assistant response after `awaitingJournalConfirmation` is true:
   - If it contains another `daily-log` FILE_UPDATE → keep `awaitingJournalConfirmation = true` (correction cycle)
   - If it does NOT contain a `daily-log` FILE_UPDATE → this is Sage's closing message → call `completeSession()` and set `sessionCompleted = true`

This avoids needing a new block type or NLP-based confirmation detection. The heuristic is simple: Sage's closing message after the card (without a new FILE_UPDATE) signals the session is done.

### Prompt Changes

**File: `lib/ai/prompts.ts` (getCloseDayPrompt)**

Replace the current session flow (lines 299-312) and journal output section (lines 315-339) with:

```
## Session Flow

1. OPEN: Ask ONE specific question drawn from their priorities, commitments, or recent context.
2. RESPOND: Acknowledge their response. Ask "How's the rest of the day landing?" to invite a broader download.
3. THREAD-PULL: After their main response, pull ONE thread — the most resonant moment, feeling, or pattern. (See Thread-Pulling Patterns below.)
4. REFLECT: Let them respond to the thread-pull. This is where insight lives.
5. OFFER TO WRAP: "I think I have a good picture of your day. Want me to capture it, or is there anything else on your mind?"
   - If user says yes/confirms → proceed to step 6
   - If user adds more → incorporate, then offer to wrap again
6. JOURNAL: After user confirms, emit the [FILE_UPDATE type="daily-log"] block.
7. CONFIRM CARD: After the journal block, ask: "Anything you'd change about that, or does it capture the day?"
   - If user confirms → close with a warm one-liner ("Day logged. Sleep well." or similar). Do NOT ask another question.
   - If user requests changes → regenerate the [FILE_UPDATE type="daily-log"] block with corrections, then ask again.

## Critical Rules

- NEVER generate a [FILE_UPDATE type="daily-log"] block without explicit user confirmation to wrap up.
- After the JournalCard renders, ALWAYS ask if it captures the day accurately.
- Only close the session (warm one-liner, no more questions) after the user confirms the card.
- NEVER push for more depth than offered. If they say "it was fine," skip the thread-pull and offer to wrap.
- NEVER suggest action items. Action planning is morning territory.
- NEVER reference more than one priority or commitment in your opening question.
- Do NOT turn this into a performance review. No "did you accomplish X?" framing.

## Thread-Pulling Patterns

After the user's main day dump, pick the most resonant option:
- **Emotional thread:** "You mentioned [specific thing]. How did that actually feel?"
- **Anticipation thread:** "You're [doing X tomorrow] — what are you hoping happens?"
- **Pattern recognition:** "The [A] + the [B] + the [C] — sounds like [observation]. Is that what a good day feels like for you?"
- **Energy check:** "You said you're [tired/energized]. Is that the good kind or the drained kind?"
- **Intention check:** If Open the Day set intentions, reference them: "This morning you said you wanted to [X]. How'd that land?"

Skip the thread-pull if the user's response is brief (1-2 sentences) or they signal they want to wrap up.

## Response Format Rules

- MAXIMUM 2-3 sentences per response. This is a hard limit.
- End your response with exactly ONE question.
- The only exception: when emitting a [FILE_UPDATE] block, the block content does not count toward the sentence limit.

Target: 3-5 minutes, 3-5 exchanges total (including the consent/confirmation exchange).
```

### UI Changes

**File: `components/chat/chat-view.tsx`**

Add state and modify the `hasDailyLog` handler:

```tsx
// New state
const [awaitingJournalConfirmation, setAwaitingJournalConfirmation] = useState(false)

// In the FILE_UPDATE handler (around line 945):
if (hasDailyLog) {
  // Phase A: card generated, but don't complete session yet
  // File write already happened above via handleAllFileUpdates()
  if (!awaitingJournalConfirmation) {
    setAwaitingJournalConfirmation(true)
  }
  // Do NOT call completeSession() here
}

// Add new logic after the FILE_UPDATE handler block (around line 996):
// Phase B: If we're awaiting confirmation and Sage's response has NO daily-log FILE_UPDATE,
// this is Sage's closing message → complete the session
if (awaitingJournalConfirmation && !hasDailyLog) {
  completeSession(supabase, sessionId).then(() => {
    setSessionCompleted(true)
  }).catch(() => {
    console.error('Failed to complete close_day session')
  })
}
```

**Suggestion pills for consent step:** Add `[SUGGESTED_REPLIES]` to the prompt's consent and confirmation steps so the user sees discoverable options like "Capture it" / "I have more to say" and "Looks good" / "One change".

### Acceptance Criteria

- [x] Sage asks permission before generating JournalCard ("Want me to capture it?")
- [x] User can add more context after Sage offers to wrap
- [x] User can correct/amend the JournalCard after seeing it
- [x] Session-end UI (SessionCompleteCard) only appears after user confirms the card
- [x] ChatInput stays visible until user confirms the card
- [x] "Day logged. Sleep well." message appears only after final confirmation
- [x] Multiple correction cycles work without breaking session state

### Files Changed

| File | Change |
|------|--------|
| `lib/ai/prompts.ts` | Rewrite `getCloseDayPrompt()` session flow with consent + thread-pulling |
| `components/chat/chat-view.tsx` | Add `awaitingJournalConfirmation` state, defer `completeSession()` |

---

## Patch 3: Close the Day Conversation Depth (P2 — experience quality)

### Problem

Current session is ~2 exchanges. Sage asks about one commitment, user gives a brain dump, Sage wraps. No reflection happens.

### Fix

**Handled entirely within the prompt rewrite in Patch 1.** The new session flow adds:
- Step 3 (THREAD-PULL): Sage pulls one specific thread from the user's day dump
- Step 4 (REFLECT): User responds — this is where insight lives
- Conditional skip: If user gives a minimal response, Sage skips the thread-pull and moves to wrap

No code changes beyond what Patch 1 already covers. The thread-pulling patterns and conditional logic are all prompt-level.

### Acceptance Criteria

- [x] Sage asks at least one follow-up question after the user's main day dump before offering to wrap
- [x] The follow-up pulls a specific thread from what the user shared (not generic)
- [x] Total session stays under 5 minutes / 5 exchanges
- [x] Session feels like journaling, not just logging
- [x] Sage skips thread-pull for minimal responses ("it was fine")

### Files Changed

| File | Change |
|------|--------|
| `lib/ai/prompts.ts` | Already covered by Patch 1 prompt rewrite |

---

## Implementation Order

```
Phase 1: Surgical fixes (low risk, independent)
├── Patch 4: JournalCard date override          (~15 min)
└── Patch 2: Tab bar one-line fix               (~5 min)

Phase 2: Prompt + state machine (coupled changes)
├── Patch 1+3: Prompt rewrite (consent + depth) (~30 min)
└── Patch 1: awaitingJournalConfirmation state   (~20 min)

Phase 3: Manual playtest
└── Full close_day session end-to-end            (~10 min)
```

Patches 4 and 2 can be done in parallel. Patches 1 and 3 are a single unit of work.

## What NOT to Break (from spec appendix)

- Context injection in Close the Day opener — Sage references specific prior commitments
- JournalCard structure — date + mood header, synthesis, domain tags, forward pointer
- Conversation tone — warm without being saccharine
- Session header — "Close the Day ~ 3 min" with user avatar
- Tab bar hidden during active conversation

## Open Questions (deferred)

1. **Midnight boundary:** If a session spans midnight, the journal date may be "tomorrow." For MVP, accept this — it's rare and the file overwrites gracefully. A future fix could capture session start date.
2. **Multiple JournalCards in thread:** If the user corrects the card, both the old and new JournalCards appear in the message thread. Acceptable for MVP — the latest one is at the bottom and represents the final version.
3. **Server vs. client timezone for file paths:** `file-write-handler.ts` uses `new Date().toISOString().split('T')[0]` (UTC), which may differ from the client's local date. For MVP, this is acceptable — the display date (client-side) is correct even if the file path uses UTC date.

## References

- Close the Day prompt: `lib/ai/prompts.ts:281-341`
- JournalCard component: `components/chat/journal-card.tsx`
- Session complete card: `components/chat/session-complete-card.tsx`
- Tab bar visibility: `components/ui/bottom-tab-bar.tsx:109-111`
- Active session context: `components/chat/chat-view.tsx:165-168`
- FILE_UPDATE handler: `components/chat/chat-view.tsx:839-996`
- Daily-log completion trigger: `components/chat/chat-view.tsx:945-951`
- Tab bar stale visibility plan (already shipped): `Docs/plans/2026-02-19-fix-tab-bar-stale-visibility-plan.md`
- R4.4 spec: `Docs/feedback/20260219_R4d_close_day.md`
