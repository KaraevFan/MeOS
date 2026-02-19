---
status: pending
priority: p1
issue_id: "005"
tags: [code-review, agent-native, api, weekly-checkin]
dependencies: ["004"]
---

# 005 — No API endpoint for weekly check-in pulse re-rating (agent-native gap)

## Problem Statement

When Sage emits a `[PULSE_CHECK]` marker during a weekly check-in, the UI shows a `PulseRatingCard`. On submit, `savePulseCheckRatings()` is called directly from the client component, then `triggerSageResponse('checkin_after_rerate')` is called. There is no API route for this action.

Without this endpoint, an agent driving a weekly check-in conversation cannot submit the pulse re-ratings that Sage needs to write the closing `FILE_UPDATE` synthesis blocks. The `checkin_after_rerate` pulse context mode reads from `pulse_check_ratings where is_baseline = false` — without a writable API, an agent hits this path with no data.

## Findings

- **File:** `components/chat/chat-view.tsx:480–494` (`handleCheckinPulseSubmit`)
- Called only from the `PulseRatingCard` UI component
- No equivalent `POST /api/pulse-check` route exists
- Reported by: Agent-Native reviewer (P1)

## Proposed Solutions

### Option A — Create `POST /api/pulse-check` route (Recommended)

```typescript
// app/api/pulse-check/route.ts
interface PulseCheckRequest {
  sessionId: string
  ratings: { domain: string; rating: string; ratingNumeric: number }[]
  isBaseline: boolean  // false for check-in re-rating
}
```

The route calls `savePulseCheckRatings()` with the provided data. Caller then triggers `triggerSageResponse('checkin_after_rerate')` via the existing `/api/chat` endpoint.

**Pros:** Clean, minimal API primitive; enables full agent-driven weekly check-in loop
**Cons:** Caller must make two sequential API calls (pulse submit + chat trigger)
**Effort:** Small (similar pattern to other API routes)
**Risk:** Low

### Option B — Merge into `POST /api/onboarding/complete` with `isBaseline` flag

Use a single `POST /api/pulse-check` that handles both onboarding baseline (`isBaseline=true`) and check-in re-rating (`isBaseline=false`), replacing todo #004 as the unified pulse endpoint.

**Pros:** Single endpoint for all pulse writes; consistent schema
**Cons:** Slightly more complex routing logic
**Effort:** Small
**Risk:** Low

## Recommended Action

Option B — unified `POST /api/pulse-check` with `isBaseline` flag, replacing or supplementing todo #004.

## Technical Details

- **Affected files:**
  - `components/chat/chat-view.tsx:480–494`
  - New file: `app/api/pulse-check/route.ts`

## Acceptance Criteria

- [ ] `POST /api/pulse-check` endpoint with Zod-validated schema
- [ ] Accepts `isBaseline: boolean` to distinguish onboarding vs. check-in ratings
- [ ] Auth-gated, session ownership validated
- [ ] Agent test: weekly check-in can submit pulse ratings without UI
- [ ] `checkin_after_rerate` context mode receives correct ratings after agent submission

## Work Log

- 2026-02-19: Created from PR #19 code review (Agent-Native reviewer P1)
