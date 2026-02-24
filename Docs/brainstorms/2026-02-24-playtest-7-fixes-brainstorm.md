# Playtest 7 Fixes — Brainstorm

**Date:** 2026-02-24
**Source:** `Docs/feedback/202624_playtest_7.md`
**Goal:** Fix all P0 + P1 issues before external user testing

---

## What We're Building

A batch of fixes addressing session lifecycle bugs, history screen gaps, and conversation UX polish identified in playtest 7. These are pre-user-testing blockers.

### Issues in scope

| Priority | Issue | Approach |
|----------|-------|----------|
| **P0** | Session auto-completion not firing | Server-side detection in API route |
| **P0** | Exit modal shows "Pause" for completed sessions | Client-side artifact detection fallback |
| **P1** | History screen — missing types, no summaries | Add labels + LLM post-session summaries |
| **P1** | Duplicate send-off in Open the Day | Strip from LLM output client-side |
| **P1** | Energy check component reconciliation | Audit and consolidate |

### Issues out of scope (separate tasks)

| Priority | Issue | Why separate |
|----------|-------|-------------|
| **P0** | Google Calendar integration not working | Debugging task, not design |
| **P2** | Day Plan screen polish (Day 5 badge, progress diamond, checkbox) | Post-user-testing |

---

## Why This Approach

### P0: Server-Side Session Completion

**Problem:** Session completion detection exists in `ChatView` (client-side) but fails silently. The `completeSession()` calls at lines 968, 1021, and 1061 of `chat-view.tsx` are present but unreliable — likely due to streaming race conditions, parsing edge cases, or silent failures.

**Decision:** Move completion detection to the API route (`/api/chat/route.ts`). When the streaming response finishes and the full assistant message is known, the API route parses it, detects terminal artifacts, and updates session status server-side.

**Why server-side:**
- Eliminates client-side race conditions with streaming/parsing
- Atomic with file writes (same request context)
- Works even if the client disconnects mid-stream
- Single source of truth for "is this session done"

**Terminal artifacts by session type:**
- `open_day` → `[FILE_UPDATE type="day-plan"]` or `[DAY_PLAN_DATA]`
- `close_day` → `[FILE_UPDATE type="daily-log"]` (note: two-phase flow — first emission = pending, Sage's next response without another daily-log = complete)
- `life_mapping` → `[FILE_UPDATE type="overview"]` or `[LIFE_MAP_SYNTHESIS]`
- `weekly_checkin` → `[FILE_UPDATE type="check-in"]` or `[SESSION_SUMMARY]`

**Close the Day two-phase nuance:** The close_day flow uses a deliberate two-phase confirmation pattern. When the journal card is emitted, the session isn't done yet — Sage asks "Does this capture the day?" After the user confirms and Sage responds without another journal block, THEN the session completes. Server-side detection needs to respect this by tracking state across request pairs (e.g., a `pending_completion` flag on the session row).

**Client-side cleanup:** Keep the existing `completeSession()` calls in ChatView as a fallback, but they should check DB state first to avoid double-completion. The primary path is now server-side.

### P0: Exit Modal for Completed Sessions

**Problem:** Even when a session completes conversationally, the X button still shows "Pause & Exit" because `sessionCompleted` state wasn't set (consequence of the completion bug above).

**Decision:** Two-layer fix:
1. **Server-side completion** (above) prevents most cases
2. **Client-side artifact detection** as safety net: If a terminal artifact card has been rendered in the chat (JournalCard, DayPlanConfirmationCard, SynthesisCard), the exit modal should offer "Close Session" instead of "Pause this session?"

**Implementation:** Track `hasTerminalArtifact` state in ChatView. Set it when a terminal card component renders. The exit handler checks: if `sessionCompleted` OR `hasTerminalArtifact`, show "Close" modal variant; else show "Pause" variant.

### P1: History Screen Fixes

**Three sub-problems:**

1. **Missing session type labels:** `SESSION_TYPE_LABELS` in `session-card.tsx` only has `life_mapping`, `weekly_checkin`, `ad_hoc`. Missing: `close_day` → "Evening Reflection", `open_day` → "Morning Session", `quick_capture` → "Quick Capture". Same gap in the history detail page.

2. **No summaries for open_day/close_day:** `updateSessionSummary` is only called on `[SESSION_SUMMARY]` blocks, which open_day/close_day don't emit.

   **Decision:** LLM-generated post-session summaries. After `completeSession()` fires (server-side), make a follow-up Claude call with the session's recent messages to generate: `ai_summary` (1-2 sentence summary), `key_themes` (string[]), `sentiment`, and `energy_level`. This gives the History page rich, human-readable content.

   **Implementation options:**
   - A: Inline in the API route after completion detection (synchronous, delays response)
   - B: Fire-and-forget from the API route (async, no delay, summary appears after refresh)
   - C: Background job / edge function triggered by session status change

   **Recommendation:** Option B (fire-and-forget). Summary generation doesn't need to block the user. The history page will show the summary once it's populated.

3. **History query only returns completed/abandoned:** Currently `status IN ('completed', 'abandoned')`. Once auto-completion works, this is fine. But we should also ensure `expired` sessions don't show up (they shouldn't — those are stale sessions cleaned up by the system).

### P1: Duplicate Send-Off in Open the Day

**Problem:** "You're set. Go make it happen." appears twice — once as a Sage chat bubble and again in the SessionCompleteCard.

**Decision:** Strip from LLM output client-side when a Day Plan card is detected. Specifically: if the parsed response contains both a `day_plan_data` block and text content, remove the trailing text after the last structured block. The SessionCompleteCard provides the exit UX.

**Why not prompt-only fix:** Prompt changes are probabilistic. Client-side stripping is deterministic and works regardless of Sage's output.

### P1: Energy Check Component Reconciliation

**Current state:** `EnergyCheckCard` in `components/chat/energy-check-card.tsx` is a horizontal chip layout with 5 emoji-decorated options. It's triggered by a heuristic: `sessionType === 'open_day' && activePills.length >= 4 && messages.length <= 3`.

**Investigation needed:** Are there other energy/mood check components? The feedback mentions a possible vertical layout used elsewhere (pulse check). Need to:
1. Confirm `EnergyCheckCard` is the canonical component for 5-option mood checks
2. Verify the pulse check (8 domains x 5 ratings) uses a separate `PulseCheckCard` component (different use case)
3. Ensure emoji and label consistency across instances

---

## Key Decisions

1. **Server-side session completion** — detection moves from ChatView to API route, atomic with file writes
2. **Client-side artifact detection as exit modal fallback** — belt-and-suspenders with server-side
3. **LLM-generated post-session summaries** — fire-and-forget after completion, populates History
4. **Strip duplicate send-off client-side** — deterministic removal, not prompt-dependent
5. **Derive from artifacts for summary source** — not the decision: user wants full LLM-generated summaries
6. **Google Calendar is a separate investigation** — not part of this fix batch

---

## Open Questions

_None — all key decisions resolved during brainstorm._

---

## Implementation Sequence (suggested)

1. **Server-side completion detection** — this unblocks History, exit modal, and home screen fixes
2. **Exit modal artifact detection** — safety net for edge cases
3. **History screen labels + summary generation** — depends on completion working
4. **Duplicate send-off stripping** — independent, small scope
5. **Energy check audit** — independent, small scope
