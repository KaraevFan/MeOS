---
title: "feat: Wave 1 Stability + Check-in Readiness (Durability, Security, Timezone, Ops, Return UX)"
type: feat
date: 2026-02-17
source: Docs/feedback/20260217_fresh-eyes-project-audit.md
---

# Wave 1 Stability + Check-in Readiness

## Overview

This plan implements the immediate pre-Wave-1 hardening and return-journey UX gaps identified in review.

Scope is grouped into three buckets:

1. **Fix now (before Wave 1):**
   - Durable `file_index` writes
   - Server-side pulse context reconstruction (remove client prompt append path)
   - Timezone-safe session/check-in dates
2. **Cheap wins (alongside Wave 1):**
   - Sentry setup
   - Stricter parser logging for invalid status values
   - Partial-stream interruption handling
3. **Product gaps (before Wave 2 check-ins):**
   - Pre-checkin prep state on Home
   - "What changed since last week" signal on Life Map

---

## Goals

- Prevent stale or inconsistent life-map/sidebar state during testing.
- Close prompt-injection risk from client-provided system context.
- Keep check-in cadence behavior correct across timezones.
- Improve diagnosability during external testing.
- Strengthen return-user experience for first and subsequent check-ins.

---

## Phase 1: Wave 1 Critical Fixes (P0)

## 1A. Durable `file_index` writes

**Problem**
`UserFileSystem` write methods call `updateFileIndex(...)` without awaiting completion. This can produce stale reads in sidebar/life-map workflows.

**Implementation**
- Update `lib/markdown/user-file-system.ts` write methods to `await this.updateFileIndex(...)`:
  - `writeDomain`
  - `writeOverview`
  - `writeLifePlan`
  - `writeCheckIn`
  - `writeSageContext`
  - `writePatterns`
  - `writeSessionInsights`
- Keep best-effort semantics inside `updateFileIndex` (internal try/catch), but ensure write method does not race ahead before index attempt is made.

**Acceptance Criteria**
- [ ] After domain/overview/life-plan/check-in writes, `file_index` is updated in the same request lifecycle.
- [ ] Sidebar and life-map no longer show stale data after successful file writes in normal flow.

## 1B. Server-side pulse context reconstruction

**Problem**
`app/api/chat/route.ts` currently accepts `pulseCheckContext` from the client and appends it to system prompt (existing TODO). This leaves a prompt-injection surface.

**Implementation**
- Add server helper in `app/api/chat/route.ts`:
  - Query `sessions.metadata` for onboarding fields using `sessionId` + `user_id`.
  - Query baseline `pulse_check_ratings` for the user/session.
  - Reconstruct pulse summary text on server.
- Remove client-provided `pulseCheckContext` append path from route.
- Keep optional safe fallback behavior: if no pulse data exists, no pulse context is appended.
- Update `components/chat/chat-view.tsx` request payload usage so app does not rely on client context injection.

**Acceptance Criteria**
- [ ] System prompt never appends freeform client-provided pulse context.
- [ ] Post-onboarding pulse-aware opening behavior still works.
- [ ] Existing chat flows (life mapping, check-in, ad-hoc) remain functional.

## 1C. Timezone-safe session/check-in dates

**Problem**
Date handling currently mixes absolute timestamps and local client assumptions, causing cadence/date edge-case risk for testers in different timezones.

**Implementation**
- Add timezone utilities in `lib/utils.ts` (or dedicated date util) for:
  - Deterministic check-in scheduling from completion timestamp.
  - Consistent date label formatting for Home and session-complete UI.
- Update `lib/supabase/sessions.ts::completeSession` to schedule next check-in using timezone-safe logic (based on timestamp arithmetic, not implicit local day mutation).
- Update UI date labels where needed (`app/(main)/home/page.tsx`, relevant check-in display points) to avoid off-by-one day perception.

**Acceptance Criteria**
- [ ] Next check-in is consistently 7 days after completion, regardless of server/user timezone.
- [ ] "Due now / tomorrow / in X days" labels remain correct around midnight boundaries.

---

## Phase 2: Cheap Wins (Wave 1 Parallel)

## 2A. Sentry setup

**Implementation**
- Add Sentry Next.js integration (client/server/edge config + DSN env support).
- Capture unhandled API and client runtime errors.
- Set environment tags (`development`, `preview`, `production`).

**Acceptance Criteria**
- [ ] Errors from API routes and runtime appear in Sentry for test builds.
- [ ] Local/dev behavior remains stable if DSN is unset.

## 2B. Stricter parser logging for invalid status

**Implementation**
- In `lib/ai/parser.ts`, when FILE_UPDATE status is provided but invalid:
  - log explicit warning with offending value, file type/name context.
  - continue safe fallback behavior (`status` omitted).

**Acceptance Criteria**
- [ ] Invalid status values are visible in logs with enough context to debug prompt drift.
- [ ] Parser does not crash on invalid status input.

## 2C. Partial-stream interruption handling

**Implementation**
- Add `AbortController` support in `components/chat/chat-view.tsx` streaming path.
- Abort active stream on:
  - component unmount
  - new stream start while prior one is active
- Differentiate abort from true API errors in UX (no false "Something went wrong" on intentional navigation).

**Acceptance Criteria**
- [ ] Navigating away mid-stream does not leave confusing error UI.
- [ ] No orphaned active reader leaks.

---

## Phase 3: Return Journey Product Gaps (Before Wave 2)

## 3A. Pre-checkin prep state on Home

**Implementation**
- Add optional pre-checkin warmup card on Home when check-in is due/near-due:
  - one-tap "2-minute reflection" entry
  - route into chat with contextual prompt seed
- Reuse existing reflection/nudge patterns where possible.

**Acceptance Criteria**
- [ ] Returning users see a warmup option before full check-in.
- [ ] Warmup transitions cleanly into weekly check-in flow.

## 3B. "What changed since last week" on Life Map

**Implementation**
- Add compact delta signal to life-map view based on recent check-in/domain updates:
  - domains touched since last check-in
  - trend direction where available (`getDomainTrends`)
- Keep scope lightweight (summary strip/card, not full historical diff UI).

**Acceptance Criteria**
- [ ] Returning users can immediately see recent movement.
- [ ] Life Map feels updated, not static, after new sessions.

---

## Files Expected to Change

- `lib/markdown/user-file-system.ts`
- `app/api/chat/route.ts`
- `components/chat/chat-view.tsx`
- `lib/supabase/sessions.ts`
- `app/(main)/home/page.tsx`
- `lib/ai/parser.ts`
- `app/(main)/life-map/page.tsx` and/or life-map components
- Sentry config files and env docs (`.env.local.example`, setup files)

---

## Validation Plan

1. Run:
   - `npm run type-check`
   - `npm run lint`
   - `npx vitest run`
2. Manual scenarios:
   - life mapping with domain writes -> sidebar immediate reflect
   - post-onboarding pulse-aware chat opening
   - check-in completion at local late-night hours
   - navigation away during stream
   - return user sees pre-checkin prep and life-map "what changed" signal

---

## Rollout Notes

- Ship Phase 1 and Phase 2 together for Wave 1 external testing stability.
- Phase 3 can follow immediately after Wave 1 data starts coming in, but before Wave 2 check-in-focused sessions.
