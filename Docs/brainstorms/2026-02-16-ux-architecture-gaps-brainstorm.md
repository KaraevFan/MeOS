# UX Architecture Gaps — Brainstorm

**Date:** 2026-02-16
**Status:** Approved
**Source:** Remaining "Important" tier gaps from `Docs/feedback/20260216_MeOS_UX_Architecture.md`

---

## What We're Building

Four UX improvements that close gaps identified in the Feb 16 UX Architecture audit. These are the remaining "Important" severity items after all "Critical" items were shipped.

### 1. Domain Editing UX (Gap 5)

Add a "Talk to Sage about this" button on explored domain cards in the Life Map. When tapped, opens an ad-hoc conversation with that domain as context. The `?explore=` chat routing already works for unexplored domains — extend the same pattern to explored ones.

No inline quick-edit for MVP. Conversations are how content changes in MeOS.

### 2. Session Type Indication (Gap 6)

Add a lightweight header to the active chat view showing the session type label and approximate duration. Examples:
- "Life Mapping ~ 20 min"
- "Weekly Check-In ~ 10 min"
- "Talking to Sage"

Keeps the user oriented on what kind of conversation they're in and sets time expectations.

### 3. Change-Over-Time in Life Map (Gap 7)

**Data collection:** Sage asks users to do a quick domain re-rating at the end of each weekly check-in. Ratings stored as new rows in `pulse_check_ratings` table (history already preserved).

**Visualization:** Simple trend arrows on domain cards — small arrow icon + label ("improving", "declining", "steady") based on direction of most recent rating vs. previous. No charts, no dashboards. Warm and minimal.

**Query:** New function to fetch a user's rating history per domain across sessions and compute trend direction.

### 4. History View Actions (Gap 9)

Add a "Talk to Sage about this" button on the session detail view. Opens a new ad-hoc conversation with the session's summary + themes injected as system context. Clean separation — no resuming or appending to completed sessions.

---

## Why This Approach

- **Conversation-first editing** — MeOS's core loop is "talk to Sage, see structured output." Inline editing would be a second paradigm. Keep it one paradigm.
- **Re-rating in check-ins** — Clean, comparable data points at consistent intervals. Lower friction than a separate rating flow. Sage can make it feel natural ("quick gut check before we wrap up").
- **Simple arrows over charts** — Matches the warm, non-dashboard design language. Arrows say "things are getting better" without feeling like a quantified-self tracker.
- **New conversation over resume** — Session boundaries matter for data integrity and Sage's prompting. A new ad-hoc with context injection is architecturally cleaner.

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Domain edit mechanism | "Talk to Sage" (no inline edit) | Conversation is the product |
| Trend data source | Explicit re-rating in weekly check-ins | Clean, comparable, user-authored |
| Trend visualization | Simple arrows + labels | Warm, not dashboard-y |
| History action model | New ad-hoc conversation with context | Clean session boundaries |

---

## Open Questions

None — all resolved during brainstorm.
