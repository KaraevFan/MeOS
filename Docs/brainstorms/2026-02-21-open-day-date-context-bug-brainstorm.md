# Open the Day: Date Context + Capture Injection + Opening Flow Fix

**Date:** 2026-02-21
**Status:** Draft
**Triggered by:** Playtest bug — Open the Day asking close-day questions and confusing yesterday's captures with "today"

---

## What We're Fixing

Three root causes combine to produce a single bug: Sage asks "How did today actually land for you?" during a morning Open the Day session, referencing yesterday's captures as if they happened today.

### Root Cause 1: No date in system prompt

`context.ts` injects yesterday's day plan labeled `=== YESTERDAY'S DAY PLAN (2026-02-20) ===` but never states "Today is 2026-02-21." Claude infers the date from context labels but gets confused, using "today" to refer to yesterday's events.

### Root Cause 2: Hardcoded opening breaks the 5-step flow

The hardcoded greeting `"Good morning, Tom. Let's set the tone for today."` satisfies Step 1's greeting but skips the energy check. Then `"Let's open the day"` is sent as a user message. Claude sees a completed greeting + a user trigger and tries to jump to Step 2, but without proper grounding it falls into close-day phrasing.

### Root Cause 3: Captures referenced in prompt but not injected

The open_day skill Step 2 says to reference "recent captures." But `context.ts` only injects captures for `close_day` sessions. Claude finds capture info in `sage/context.md` or yesterday's day plan and presents it with wrong temporal framing.

---

## Why This Approach

The implementation spec (Section 4, Step 2) explicitly describes the morning briefing pattern:

> "Here's what I'm seeing for today: You've got [calendar events]. Your current focus area is [Life Map priority]. **Yesterday you captured a thought about [X].** And [open thread from last session] is still on the table."

The spec wants yesterday's captures in the briefing. The bug is that they're not properly labeled and Claude lacks date awareness to frame them correctly.

---

## Key Decisions

### 1. Inject today's date into the system prompt

Add `Today is [YYYY-MM-DD, Day of Week].` at the top of the context block in `fetchAndInjectFileContext()`. Applies to all session types — universal temporal grounding.

### 2. Inject yesterday's captures for open_day sessions

Add a new block in `context.ts` for `open_day` that reads yesterday's capture files (full content, same format as close_day's capture injection). Label as `=== YESTERDAY'S CAPTURES (N) ===` so Claude can reference them with correct "yesterday" framing.

### 3. Fix the briefing card handoff (auto-trigger, no user message)

Keep the briefing card as a pre-conversation UI moment. When user taps "Begin":
- **Current:** `handleSend("Let's open the day")` — sends a visible user message that Claude has to interpret
- **New:** `triggerSageResponse('none')` — auto-trigger Claude with no user message, same pattern as close_day

Claude sees only `[assistant: greeting]` and generates Step 1 (energy check + pills) as its first response. No ambiguous user message to derail the flow.

---

## Scope

| Change | File | Description |
|--------|------|-------------|
| Date injection | `lib/ai/context.ts` | Add today's date string at top of context block |
| Capture injection | `lib/ai/context.ts` | New `open_day` block reading yesterday's captures (full content) |
| Briefing card handoff | `components/chat/chat-view.tsx` | Replace `handleSend("Let's open the day")` with `triggerSageResponse('none')` in briefing card's `onStart` |

Three files, three focused changes. No prompt rewrites needed — the open_day skill is correct, the issue is context + flow.

---

## Open Questions

None — all decisions resolved during brainstorming.
