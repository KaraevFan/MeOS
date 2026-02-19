---
status: pending
priority: p1
issue_id: "004"
tags: [code-review, agent-native, api, onboarding]
dependencies: []
---

# 004 — No API endpoint for onboarding pulse check submission (agent-native gap)

## Problem Statement

The onboarding pulse check ratings (8-domain baseline) are written to the database by calling `savePulseCheckRatings()` directly from the client component `onboarding-flow.tsx`. There is no `POST /api/onboarding/complete` or `POST /api/pulse-check` server action. Without this endpoint:

1. An agent cannot programmatically complete user onboarding
2. An agent cannot write the pulse baseline needed for `onboarding_baseline` system prompt injection
3. `buildPulseContext()` in `app/api/chat/route.ts` returns null when called in `onboarding_baseline` mode, meaning Sage opens with no life context

This is the most critical agent-native parity gap: the data writes that bracket the entire first conversation (rate → Sage responds) are UI-only.

## Findings

- **File:** `components/onboarding/onboarding-flow.tsx:236–353` (`handleStartConversation`)
- The function: writes pulse ratings to DB, sets session metadata, seeds initial domain files, updates `users.onboarding_completed`
- No equivalent API route exists in `app/api/`
- Reported by: Agent-Native reviewer (P1)

## Proposed Solutions

### Option A — Create `POST /api/onboarding/complete` route (Recommended)

```typescript
// app/api/onboarding/complete/route.ts
// Request body:
interface OnboardingCompleteRequest {
  sessionId: string
  ratings: { domain: string; rating: string; ratingNumeric: number }[]
  intent: string
  name: string
}
```

The route replicates:
1. `savePulseCheckRatings()` call
2. Session metadata write (`onboarding_name`, `onboarding_intent`)
3. Domain seeding via `UserFileSystem.seedInitialDomains()` (if applicable)
4. `users.onboarding_completed = true`

**Pros:** Clean agent-accessible primitive; co-locates server-side logic in API layer
**Cons:** Duplicates some logic from `onboarding-flow.tsx` that should eventually be deduplicated
**Effort:** Medium
**Risk:** Low (additive, doesn't remove existing UI flow)

### Option B — Extract shared server action

Use Next.js Server Actions to extract `handleStartConversation` logic into a reusable action that both the UI and the API route can call.

**Pros:** Single source of truth
**Cons:** Requires refactor of client component
**Effort:** Medium-Large
**Risk:** Medium

## Recommended Action

Option A first (additive, unblocks agent testing), then Option B in a refactor sprint.

## Technical Details

- **Affected files:**
  - `components/onboarding/onboarding-flow.tsx:236–353`
  - New file: `app/api/onboarding/complete/route.ts`
  - `lib/supabase/` — `savePulseCheckRatings` utility

## Acceptance Criteria

- [ ] `POST /api/onboarding/complete` endpoint exists with Zod-validated schema
- [ ] Endpoint is auth-gated (returns 401 if unauthenticated)
- [ ] Endpoint writes pulse ratings, session metadata, and sets `onboarding_completed=true`
- [ ] Agent test: can submit onboarding without loading the UI
- [ ] Existing UI flow continues to work unchanged

## Work Log

- 2026-02-19: Created from PR #19 code review (Agent-Native reviewer P1)
