# Playtest 8 Fixes — Brainstorm

**Date:** 2026-02-26
**Source:** `Docs/feedback/20260226_playtest_8.md`
**Status:** Ready for planning

---

## What We're Building

Three fixes from Playtest 8, plus a cross-cutting timezone audit:

1. **P0: Day Plan Not Populating** — Fix the data persistence/query path so the Day view shows the plan after completing "Open the Day"
2. **P1: "Explore with Sage" Drops Context** — Ensure explicit navigation context (reflection prompts) always creates a fresh session instead of resuming an existing one
3. **P2: Unexplored Domains Nudge** — Add a Sage-voice nudge on the Home screen encouraging users to map unmapped life domains
4. **Cross-cutting: Timezone Audit** — Find and fix all date-sensitive DB writes and queries that assume UTC instead of using the user's local date

---

## Why This Approach

### P0: Timezone mismatch in day plan write/query

**Root cause confirmed:** The tester uses JST (+9). When completing "Open the Day" at 8am JST, the server-side code that writes the `day_plans.date` column likely uses `new Date()` (UTC), storing `2026-02-24` instead of `2026-02-25`. The Day view displays "Wednesday, February 25" (local) and queries for that date — no match.

**Evidence:**
- The DayPlanConfirmationCard appeared in chat (data was parsed and rendered client-side)
- This is the same class of bug as the date isolation fix from Feb 21 (`Docs/solutions/logic-errors/2026-02-21-server-side-utc-date-context-injection-bug.md`)
- The dual-write architecture (markdown file + Postgres row) means both paths need timezone-correct dates

**Fix approach:** Ensure `getOrCreateTodayDayPlan()` and `updateDayPlan()` use the user's timezone-aware local date, not UTC. The timezone is available from the cookie/briefingData. The markdown file path `day-plans/{YYYY-MM-DD}.md` also needs the local date.

**Files to investigate:**
- `lib/supabase/day-plan-queries.ts` — `getOrCreateTodayDayPlan()` likely uses `new Date().toISOString().split('T')[0]` which gives UTC date
- `lib/markdown/file-write-handler.ts` — Day plan file path resolution may default to UTC date
- `components/chat/chat-view.tsx` — The `[DAY_PLAN_DATA]` processing block that calls `updateDayPlan()`
- `app/(main)/day/page.tsx` — The Day view query may also need to use local date

### P1: Session resume overrides incoming context

**Root cause:** When navigating with `?mode=reflection&prompt=...`, the chat page correctly sets `nudgeContext`. But `detectSessionState()` returns `mid_conversation` with an `activeSessionId` (from the life mapping session in progress). The session dedup/resume logic routes to the existing session, ignoring the incoming reflection context.

**Decision:** Explicit context (reflection prompt, explore domain, session context) should ALWAYS bypass session resume and create a fresh `open_conversation` session.

**Fix approach:** In `chat/page.tsx`, add a guard: if any context payload is present (`nudgeContext`, `exploreDomain`, `sessionContext`), skip the session resume path entirely. Force fresh session creation regardless of `detectSessionState()` result.

**Files to change:**
- `app/(main)/chat/page.tsx` — Session dedup logic (lines ~102-129) needs a context-present guard
- `components/chat/chat-view.tsx` — Ensure `init()` creates new session when context props are present, even if `initialSessionState` says `mid_conversation`

### P2: Sage-voice nudge for unexplored domains

**Design decision:** Use Sage's conversational voice, not a progress bar or metric. Placement: Home screen only (not Day view — that should feel present-tense).

**Content pattern:**
> *There are parts of your map we haven't explored yet — want to go deeper?*

Or context-aware variants:
> *We've mapped Career and Relationships, but haven't touched Health or Finances yet. Want to explore one?*

**Behavior:**
- Tapping the CTA opens a life mapping continuation session pre-seeded with unmapped domains as quick-reply options
- The nudge disappears once all domains are mapped (or could shift to "Your life map is complete — time for a check-in?")
- Should appear in the "orientation" section of the Home screen, below any active session CTAs
- Gentle — this is an invitation, not homework

**Data source:** `detectSessionState()` already returns `unexploredDomains`. The Home screen can use this to conditionally render the nudge.

**Files to create/modify:**
- New component: `components/home/life-map-nudge.tsx` — Sage-voice card with domain-aware copy
- `components/home/home-screen.tsx` — Render the nudge in the appropriate section
- Navigation: link to `/chat?type=life_mapping` (the existing life mapping flow handles domain pills)

### Cross-cutting: Timezone Audit

**Pattern to find:** Any code that derives a date string from `new Date()` without accounting for the user's timezone. Common offenders:
- `new Date().toISOString().split('T')[0]` → gives UTC date
- `new Date().toLocaleDateString()` → gives server's locale, not user's
- SQL `CURRENT_DATE` or `NOW()` → gives DB server timezone

**Pattern to enforce:** All user-facing date derivation should use the user's timezone from the cookie/context. Centralize this in a utility like `getUserLocalDate(timezone: string): string`.

**Scope:** Audit all files that:
- Write date-keyed rows (day_plans, daily_logs, captures, check-ins)
- Query by date (getDayPlan, getDayPlanWithCaptures, session expiry)
- Generate date-based file paths (day-plans/, daily-logs/, check-ins/)
- Compare dates for display logic (isToday, canGoForward, etc.)

---

## Key Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | P0 is a timezone bug, not a write failure | DayPlanConfirmationCard appeared in chat = data was parsed. JST (+9) morning session stores UTC date, Day view queries local date. |
| 2 | Explicit navigation context always creates fresh session | Reflection prompts, explore domains, and session context payloads represent user intent to start something new. Resuming an old session breaks that intent. |
| 3 | Sage-voice nudge, not progress metric | Matches the app's conversational tone. "3 of 8 domains mapped" feels like homework; Sage saying "want to go deeper?" feels like an invitation. |
| 4 | Include timezone audit in scope | This is the second timezone bug in a week. Fixing it piecemeal leads to whack-a-mole. A one-time audit prevents recurrence. |

---

## Resolved Questions

- **Is the P0 a data generation issue?** No — the confirmation card appeared in chat. The data is generated and parsed correctly.
- **Is the AmbientCard on the Day view?** No — the "Explore with Sage" tap came from the Home screen's AmbientCard, which does have the correct routing code.
- **Fresh session vs inject into existing?** Always fresh session when explicit context is present.

---

## Open Questions

_None — all questions resolved during brainstorming._

---

## Build Order Recommendation

1. **Timezone audit** first (cross-cutting, unblocks P0 and prevents future issues)
2. **P0 day plan fix** (highest priority, depends on timezone audit findings)
3. **P1 session context fix** (independent, can parallel with P0)
4. **P2 unexplored domains nudge** (lowest priority, purely additive)
