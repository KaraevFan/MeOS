# MeOS R4.4 Implementation Spec

**Date:** 2026-02-19
**Status:** Active — feed to Claude Code
**Context:** Issues discovered during Close the Day playtest (R4 checklist section 2). Close the Day is functional end-to-end but needs consent flow, depth tuning, and minor UI fixes before demos.

---

## Priority Order

| # | Patch | Priority | Type |
|---|-------|----------|------|
| 1 | User consent before session close | P1 — demo quality | Prompt + UI |
| 2 | Tab bar / Back to Home redundancy | P1 — polish | UI |
| 3 | Close the Day conversation depth | P2 — experience quality | Prompt |
| 4 | JournalCard date bug | P1 — trust | Bug fix |

---

## Patch 1: User Consent Before Session Close (P1)

**Problem:** Sage auto-generates the JournalCard and ends the Close the Day session without asking the user if they're done. The user might have more to say, want to add context after seeing the synthesis, or want to correct the mood tag or emphasis.

This is the same problem we solved in life mapping — Sage shouldn't unilaterally produce a closing artifact. The user needs to confirm.

**Fix — Prompt + UI changes:**

After Sage has enough context to synthesize the day (typically after 2–3 exchanges), Sage should:

1. **Offer to wrap** rather than auto-wrapping:
   > "I think I have a good picture of your day. Want me to capture it, or is there anything else on your mind tonight?"

2. **Wait for user confirmation** before generating the JournalCard. Acceptable confirmations: "yes," "capture it," "that's it," "go ahead," or similar affirmative.

3. **If user adds more**, Sage incorporates the additional context, then offers to wrap again.

4. **After JournalCard is generated**, give the user one more beat:
   > "Anything you'd change about that, or does it capture the day?"
   
   If the user says it's good → show "Day logged. Sleep well." + Back to Home. If the user corrects something → regenerate the card with the correction.

**Prompt instructions to add:**
- NEVER generate a JournalCard without user confirmation
- After 2–3 exchanges in a close_day session, offer to synthesize
- After JournalCard renders, ask if it captures the day accurately
- Only show the session-end UI (Back to Home) after user confirms the card

**Acceptance Criteria:**
- [ ] Sage asks permission before generating JournalCard
- [ ] User can add more context after Sage offers to wrap
- [ ] User can correct/amend the JournalCard after seeing it
- [ ] Session-end UI only appears after user confirms the card
- [ ] "Day logged. Sleep well." message appears only after final confirmation

---

## Patch 2: Tab Bar / Back to Home Redundancy (P1)

**Problem:** The tab bar correctly hides during the Close the Day conversation, but reappears after the session completes — alongside the "Back to Home" amber button. This creates two competing exit paths and is visually jarring after the tab bar has been hidden.

**Fix:**

When a session completes and the "Back to Home" button is shown:
- **Keep the tab bar hidden** until the user taps "Back to Home"
- The "Back to Home" button is the sole exit from a completed session
- Once the user taps it and lands on the home screen, the tab bar reappears as normal

This applies to ALL session types (life mapping, close the day, open the day, weekly check-in) — the session-end state should feel intentional and contained, not leak navigation chrome back in prematurely.

**Acceptance Criteria:**
- [ ] Tab bar remains hidden after session completes, while "Back to Home" is visible
- [ ] Tapping "Back to Home" navigates to home screen with tab bar visible
- [ ] This behavior is consistent across all session types
- [ ] No double-exit paths visible at any point during or after a session

---

## Patch 3: Close the Day Conversation Depth (P2)

**Problem:** The current Close the Day session is ~2 exchanges and done. Sage asks about one prior commitment, user gives a brain dump, Sage wraps. This is functional but feels more like a check-in than a journal entry. There's an opportunity for one more conversational beat that turns reflection into insight.

**Fix — Prompt engineering:**

After the user's main day dump (the long message where they describe what happened), Sage should pull ONE thread before offering to wrap. This is the difference between logging and reflecting.

**Thread-pulling patterns Sage should use:**

Pick the most resonant option based on what the user shared:

- **Emotional thread:** "You mentioned [specific thing]. How did that actually feel in the moment?"
- **Anticipation thread:** "You're bringing the MVP to surprise your friend tomorrow — what are you hoping she says?"
- **Pattern recognition:** "The run + the build + the cleaning — sounds like a day where the body and mind were both moving. Is that what a good day feels like for you?"
- **Energy check:** "You said you're a bit worn out. Is that the good kind of tired or the drained kind?"
- **Intention check:** If Open the Day set intentions, ask about them specifically: "This morning you said you wanted to [X]. How'd that land?"

**Session arc for Close the Day:**

1. **Opening** (Sage): Reference a specific prior commitment or context. Ask how it went.
2. **User response** (1st exchange): User reports on the specific thing.
3. **Sage acknowledgment + broader ask**: Affirm progress, then ask "How's the rest of the day landing?"
4. **User dump** (2nd exchange): User gives the full day download.
5. **Sage pulls one thread** (the key beat): One more question that creates a moment of reflection, not just reporting.
6. **User reflects** (3rd exchange): This is where insight lives.
7. **Sage offers to wrap**: "I think I have a good picture. Want me to capture it?"
8. **JournalCard** (after confirmation)

Target session length: 3–5 minutes, 3–4 exchanges. Not longer — this is an evening wind-down, not a therapy session.

**Acceptance Criteria:**
- [ ] Sage asks at least one follow-up question after the user's main day dump before offering to wrap
- [ ] The follow-up pulls a specific thread from what the user shared (not generic)
- [ ] Total session stays under 5 minutes / 4 exchanges
- [ ] Session feels like journaling, not just logging

---

## Patch 4: JournalCard Date Bug (P1)

**Problem:** The JournalCard shows "Friday, Jan 9" but the actual date is February 19, 2026. Either the system clock is wrong, the card is pulling a hardcoded/stale date, or the date formatting logic has a bug.

**Fix:**

- JournalCard date should pull from `new Date()` at the time the card is generated, formatted as `[Day of week], [Month] [Day]`
- Verify the date is correct in the user's timezone (the app should use the browser's timezone)
- Check for any hardcoded dates in the JournalCard component or the close_day prompt

**Acceptance Criteria:**
- [ ] JournalCard displays the correct current date
- [ ] Date respects the user's timezone
- [ ] No hardcoded dates in JournalCard component or close_day system prompt

---

## Appendix: What's Working Well (Don't Break These)

Verified working from this playtest — protect in all future changes:

- **Context injection in Close the Day opener** — Sage references specific prior commitments (Amazon RSU rebalance), not generic "how was your day"
- **JournalCard structure** — Date + mood header, concise synthesis, domain tags, "feeds into your next check-in" forward pointer
- **Conversation tone** — warm without being saccharine ("stacking small wins while protecting the foundation")
- **Session header** — "Close the Day · ~3 min" with user avatar, consistent with life mapping session header
- **Tab bar hidden during conversation** — correctly hides when session is active

## Appendix: Not Yet Testable

These require a full daily arc test (Open the Day → captures → Close the Day):

- Open the Day → Close the Day intention carry-forward
- Morning intentions referenced in evening close
- Quick Capture data synthesized in Close the Day
- JournalCard incorporating full-day context (not just evening conversation)