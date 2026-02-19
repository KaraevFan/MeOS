# Playtest R4 — Test Checklist
**Date:** 2026-02-19
**Scope:** Everything shipped since Playtest R3

---

## 1. R3 Fix Verification (PR #11)

- [ ] **Session length cap:** Sage opens life mapping by proposing 2-3 priority domains (not all 8), names them explicitly, and tells the user they won't cover everything today
- [ ] **Soft wrap-up:** After 2-3 domains, Sage defaults toward wrapping up ("Want to keep going or synthesize?") — natural pressure, no hard stop
- [ ] **Deferred prescriptions:** During domain exploration, Sage does NOT propose specific commitments, schedules, or routines — only bookmarks them ("we'll come back to this")
- [ ] **Synthesis-grounded commitments:** Active Commitments on home screen reflect cross-domain recommendations from synthesis, not mid-exploration suggestions
- [ ] **Artifact sidebar (desktop):** Right sidebar visible during life-mapping; shows compact spider chart + 8 domain slots; slots fill in as domains complete; collapsible
- [ ] **Emerging patterns:** Sidebar "Emerging Patterns" section appears after 2+ domains explored
- [ ] **Domain preview lines:** Life Map collapsed domain cards show `preview_line` (a salient insight), not truncated `current_state`
- [ ] **Spider chart on Life Map:** Radar chart appears at top of Life Map view
- [ ] **Spider chart blurb:** Post-pulse-check blurb is specific to the user's actual ratings, not generic
- [ ] **Reflection nudge:** Home screen "Something to sit with" shows a Sage-generated specific provocation from the session, not a generic prompt
- [ ] **Pulse check polish:** Rating circles show numbers 1–5; subtle color gradient hint on unselected circles; satisfying tap animation on selection

---

## 2. "Close the Day" Session (Milestone 1 — PR #13)

- [ ] **Evening CTA:** Home screen shows "Close your day" CTA after 5pm
- [ ] **Session launch:** Tapping it starts a `close_day` conversation — Sage auto-triggers opening greeting immediately (no empty chat)
- [ ] **JournalCard:** Journal summary card appears in chat at the appropriate point during the session
- [ ] **Session completion:** Session completes cleanly with a closing artifact/card
- [ ] **Context injection:** Sage references earlier life-mapping content and the day's captures during the close_day session (feels personalized, not generic)
- [ ] **Chat input position:** Input bar does not overlap the tab bar

---

## 3. "Open the Day" Session (Milestone 2 — PR #14)

- [ ] **Morning briefing card:** Pre-chat card shown before the conversation starts; contextual to morning state
- [ ] **Single-use:** After completing an Open the Day session, the CTA changes — can't re-open for the same day
- [ ] **Intention carry-forward:** Intentions from Open the Day carry forward into Close the Day (or next day) when relevant
- [ ] **Session expiry:** Stale/previous-day sessions don't appear as "active" on the home screen
- [ ] **Google Calendar OAuth:** Authorize calendar → data appears in the home card-stack contextual line
- [ ] **Home card-stack:** New card-stack layout renders correctly with calendar card, contextual greeting line, and time-appropriate CTAs

---

## 4. Quick Capture + Mid-Day (Milestone 3 — PR #15)

- [ ] **Capture bar visible:** Quick capture input surface is accessible from the home screen
- [ ] **Text capture:** Typing and submitting a capture stores it correctly (fire-and-forget; no blocking UI)
- [ ] **AI classification:** Captures are auto-classified correctly by Haiku — verify by checking close_day synthesis
- [ ] **Capture → synthesis:** When closing the day, Sage references and synthesizes the day's captures in the conversation
- [ ] **Mid-day nudge:** Nudge notification triggers at mid-day (or configured schedule)
- [ ] **CheckinCard:** Mid-day check-in response surfaces a CheckinCard on the home screen
- [ ] **Home screen breadcrumbs:** Live capture data and checkin response appear on the home screen correctly
- [ ] **Daily rhythm layout:** Home screen shows the M3 daily rhythm layout even when an active session exists

---

## 5. Ghost Session / Home Screen Reliability (PRs #16–18)

- [ ] **No ghost sessions:** Home screen active session card doesn't show stale/completed sessions from previous days
- [ ] **Correct home layout:** Right home screen variant shows based on time of day and session state — morning, mid-day, and evening all render the correct layout

---

## 6. Regression

- [ ] Session persistence: navigate away from chat → return → conversation still there
- [ ] Browser refresh preserves conversation
- [ ] Voice recording and transcription still works
- [ ] Weekly check-in flow still launches and completes correctly
- [ ] Life Map view loads domain data correctly after a life-mapping session
- [ ] "Explore with Sage" CTA on unexplored domain cards launches a domain-specific conversation

---

## Key Question for This Round

> Does the full daily rhythm loop — Open the Day → captures throughout → Close the Day — feel like something you'd actually do again tomorrow?
