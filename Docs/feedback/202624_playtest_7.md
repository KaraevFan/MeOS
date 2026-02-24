# MeOS Playtest 7 — Findings & Bug Fixes

**Date:** Tuesday, February 24, 2026
**Tester:** Tom (founder self-test)
**Build:** Current production (Vercel + Supabase)
**Focus areas:** Home screen, Close the Day lifecycle, Open the Day flow, Day Plan view, History screen

---

## Critical Context

This is a pre-user-testing audit. External user tests are being scheduled this week. Everything flagged here needs to be resolved or consciously deferred before putting the app in front of outside users. Bugs are prioritized P0 (blocks user testing) through P2 (polish, can ship after).

---

## P0 — Session Lifecycle / Auto-Completion Bug

**The core issue:** Sessions that complete naturally (Sage delivers a closing message + structured artifact) are not having their status updated from `in_progress` to `completed`. This is causing cascading problems across multiple screens.

### Symptoms

1. **Home screen shows stale "Continue your evening reflection" card** even after the Close the Day session completed naturally. Sage said "Rest well, Tom," generated the journal card with date, mood tag, summary, domain tags, and "This feeds into your next check-in" — the session is clearly done, but the system still thinks it's in progress.

2. **Exit modal shows wrong affordance for completed sessions.** Tapping the stale "Continue" card (or the X on the session header) shows a "Pause this session?" bottom sheet with "Pause & Exit" / "Keep Going" options. There is no way to simply close/dismiss a completed session. A completed session should never show pause options.

3. **History screen shows nearly all sessions as "Incomplete."** The wall of `open_day | Incomplete` entries (see History section below) is likely the same root cause — sessions complete conversationally but are never marked as such in the database.

### Root Cause Analysis

The system needs to detect session completion signals — the structured output blocks that mark the end of each session type:

- **Close the Day:** Journal card emission (the structured block with date, mood tag, summary, domain tags, "This feeds into your next check-in")
- **Open the Day:** Day Plan card emission (the `DAY PLAN SET` block with headline intention, context, mood, priorities)
- **Life Mapping:** `[LIFE_MAP_SYNTHESIS]` block
- **Weekly Check-In:** `[SESSION_SUMMARY]` block

When the structured output parser detects the completion artifact for the active session type, it should update the session status to `completed` in the same database transaction that stores the artifact.

### Required Fixes

1. **Add auto-completion detection to the structured output parser.** When a session's terminal artifact is parsed and stored, set `session.status = 'completed'` in the same transaction.

2. **Add a dismiss/close affordance for completed-but-not-closed sessions.** As a fallback (edge cases will happen), the home screen's "Continue" card needs to handle a third state: session that looks complete but wasn't formally marked. Options:
   - Add an X/dismiss button directly on the "Continue" card
   - Change the exit modal to detect the completed state: "This session looks finished — close it?" with "Close Session" / "Actually, keep going"

3. **The exit modal should never show "Pause & Exit" for a completed session.** If the session has a terminal artifact (journal card, day plan card, synthesis), the modal should offer "Close" not "Pause."

### Verification

After fixing, confirm:
- Complete a Close the Day session → home screen should NOT show "Continue" card
- Complete an Open the Day session → home screen should NOT show "Continue" card
- History screen should show these sessions as "Completed"

---

## P0 — Google Calendar Integration Not Working

**Symptom:** During the Open the Day session, Sage said "no calendar events today — open runway." However, Google Calendar OAuth was previously set up and reported as successful. The home screen also still shows a "Connect your calendar" prompt at the bottom.

### Required Investigation

1. **Is the OAuth token being stored correctly?** Check whether the Google OAuth token is persisted in the database after the initial authorization flow.
2. **Is the token being refreshed?** Google OAuth tokens expire. If the refresh flow isn't working, calendar access would silently fail after the initial session.
3. **Is the calendar fetch happening before the session prompt is assembled?** The Open the Day system prompt needs today's calendar events injected as context. If the fetch is failing silently or happening after prompt assembly, Sage won't have the data.
4. **Is the home screen checking OAuth status correctly?** The "Connect your calendar" card should not appear if OAuth has been completed.

### Why This Matters

The morning flow's value multiplies significantly when Sage can reference the user's actual schedule. "You have 3 meetings this afternoon, so protect your morning for deep work" is dramatically more useful than "open runway." This should be working before user testing.

---

## P1 — History Screen

**Current state:** The History screen is a wall of `open_day | Incomplete` badges with timestamps. No summaries, no titles, no human-readable content. This looks like a debug log, not a product screen.

### Issues

1. **Missing session types.** Only `open_day` entries appear. No `close_day` or `capture` sessions are shown. Either these aren't being written to the sessions table, or the query is filtering by type and only matching `open_day`.

2. **No summaries or content previews.** Per the PRD spec, each History entry should show: date, session type (with a human-readable label), AI-generated summary snippet, and key themes as tags. Currently it's just raw enum values and timestamps.

3. **"Incomplete" proliferation.** Nearly every entry shows "Incomplete" — this is a downstream effect of the P0 session lifecycle bug. Fixing auto-completion detection will clean up most of these.

4. **Session type labels are raw enum values.** `open_day` should display as "Morning Session" or "Open the Day." Use human-readable labels, not database enum strings.

### Required Fixes (minimum for user testing)

1. Fix session type filtering to include all types (close_day, open_day, capture, life_mapping, weekly_checkin)
2. Display AI summary snippets for each session (these should already exist from post-session processing)
3. Use human-readable labels for session types
4. Session completion status should reflect actual state (depends on P0 fix)

### Nice-to-Have (post user testing)

- Key themes as tappable tags
- Expandable detail view per session
- Visual differentiation between session types (icons, colors)

---

## P1 — Duplicate Send-Off in Open the Day

**Symptom:** At the end of the Open the Day flow (screenshot 5), "You're set. Go make it happen." appears twice:
1. First as a regular Sage chat bubble, before the Day Plan card
2. Again as a styled card with a "Back to Home" button, after "Day plan's locked. Have a good one, Tom."

### Root Cause

The LLM is emitting a send-off message as part of its conversational response, AND the system is rendering a separate completion card with the same text. These are two separate outputs that both fire.

### Fix

Suppress the duplicate. The structured completion card with "Back to Home" is the correct one to keep — it provides a clear exit path. Options:
- Strip the send-off text from the LLM response if a Day Plan card is detected in the same message
- Or update the system prompt to instruct Sage NOT to include a send-off message after emitting the Day Plan block (let the system handle the completion UX)

---

## P1 — Energy Check UI Component Reconciliation

**Context:** The "How are you showing up today?" energy check in Open the Day uses a horizontal chip layout with 5 options: 🔥 Energized / 😊 Good / 😐 Neutral / 😔 Low / 😤 Rough.

**Issue:** There was previously a different version of this component (possibly vertical layout, possibly different option labels) used elsewhere (pulse check). Need to determine which is the canonical component.

### Decision Needed

The horizontal chip layout shown in the current Open the Day screenshots reads well for 5 options. **Recommendation:** Keep the horizontal chip layout as the standard energy/mood check component. But reconcile with Claude Code on:
- Which component file is the source of truth
- Whether the pulse check (8 domains × 5 ratings) uses a different component (it should — different use case, more data)
- Ensure consistent emoji and label usage across all instances

---

## P2 — Day Plan Screen Feedback

The Day Plan screen (Your Day view) is in good shape overall. The layout works: headline intention at top, morning snapshot, priorities with checkbox, open threads, capture input. Specific notes:

### "Day 5" Badge

- What is this counting? Consecutive days using the app? Days since onboarding? If it's a streak indicator, it aligns with the "warm acknowledgment, not a score" principle — but it needs context on first appearance. Consider a tooltip or a one-time explanation.

### Progress Diamond on Horizontal Line

- The diamond marker on the line between the headline card and "Day in motion" tag is ambiguous. What does it represent? If it's tracking day progress (morning → midday → evening), it needs a legend or clearer visual language. If it's purely decorative, cut it — it creates a false affordance.

### Open Threads Section

- "Start learning to sketch / From Saturday morning" — this is great. It demonstrates memory and continuity. Verify that these are being populated from actual captured thoughts and prior session data, not just static life map content.

### Priority Checkbox

- Does tapping the checkbox on "Schedule at least one user test" actually do anything? If so, does the completion feed into the Close the Day session? ("You checked off your main priority today — how did that go?") This would be a tight and satisfying loop.
- If it doesn't work yet, either make it functional or remove the checkbox affordance so it doesn't feel broken.

---

## P2 — Open the Day Conversation Quality

The conversation quality is strong. Specific highlights:

- **Good:** Sage anchoring on "schedule at least one user test" after the user expressed fuzziness about next milestones. This is exactly the right coaching behavior — taking a vague feeling and making it concrete.
- **Good:** Quick-reply buttons for carried-over items (calendar integration, contact lenses pickup) show continuity and give the user control over scope.
- **Good:** "Keep it focused" as the default/first option respects the user's time and aligns with "choose less, not more."

No conversation design fixes needed here — this flow is demo-ready.

---

## Summary: Fix Priority for User Testing

| Priority | Issue | Effort Est. | Impact |
|----------|-------|-------------|--------|
| **P0** | Session auto-completion detection | Medium | Fixes home screen, history, exit modal |
| **P0** | Google Calendar integration debug | Unknown | Core morning flow value |
| **P1** | History screen — missing types + summaries | Medium | Screen is unusable without this |
| **P1** | Duplicate send-off in Open the Day | Small | Looks buggy |
| **P1** | Energy check component reconciliation | Small | Consistency |
| **P2** | Day Plan — Day 5 badge context | Small | Clarity |
| **P2** | Day Plan — progress diamond | Small | Remove or explain |
| **P2** | Day Plan — checkbox functionality | Small-Medium | Tight loop if functional |

**Minimum for user testing:** P0s + History fixes + duplicate send-off suppression. P2s can ship after first round of external tests.