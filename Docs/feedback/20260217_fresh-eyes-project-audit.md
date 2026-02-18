# Fresh Eyes Project Audit — Updates / Fixes List

**Date:** 2026-02-17  
**Status:** Review complete (strategy + MVP spec + UX + steering + implementation sampled)

---

## Scope Reviewed

- Strategy/docs: `Docs/vision.md`, `Docs/MVP_PRD.md`, `Docs/UX_design.md`, `Docs/STEERING.md`
- Current implementation (sampled): chat flow, prompt system, parser, markdown storage, life map/home pages, API routes, realtime sidebar, session-state logic
- QA baseline:
  - `npm run type-check` ✅
  - `npm run lint` ✅
  - `npx vitest run` ✅ (41 tests)

---

## Fresh-Eyes Long List (Broad Backlog)

## 1) Product / UX

1. Add explicit "session budget" UI in chat header (e.g., "~20 min / 2-3 domains") so users know this is intentionally scoped, not incomplete.
2. Surface unexplored domains as a planned journey ("Next likely domain") instead of passive empty slots only.
3. Add "confidence + source" microcopy to synthesized claims (user-said vs inferred) to improve trust, especially for boundaries and north star framing.
4. Add lightweight "correct this" affordance directly inside synthesis cards (not only domain cards).
5. Add a first-check-in prep state on Home: 1-tap pre-checkin reflection (2 min), then launch weekly check-in.
6. Add a small "what changed since last week" panel in Life Map, not just static latest state.
7. Add friction guardrails on long sessions: suggest break/continue when message count or elapsed time is high.
8. Add ad-hoc mode distinction in UI language so users understand when they are mapping vs checking in vs free conversation.
9. Add a consistent "why this prompt now" explanation for module nudges (journal/capture/planner) to reduce notification fatigue.
10. Add mobile counterpart for the desktop life-map sidebar (already planned; should be elevated if mobile testing starts).

## 2) AI / Prompt Quality

1. Move client-provided pulse context construction fully server-side (`app/api/chat/route.ts` has a TODO), removing prompt-injection surface.
2. Enforce domain/status vocabulary at parser boundary with stricter rejects/logging (currently unknown status silently drops to undefined).
3. Add response-shape QA checks before persistence (required headings for life-plan/check-in) to reduce parser drift from model variation.
4. Add model fallback strategy (primary Sonnet -> fallback model) for resilience.
5. Add partial-stream interruption handling (user navigates away mid-SSE) to avoid orphaned states.
6. Add synthesis quality rubric tests (golden prompts) to protect tone and structure as prompts evolve.
7. Add explicit anti-hallucination instruction for numerics/dates in all synthesis blocks, not only boundaries.
8. Add adaptive prompt compression when context is large (avoid over-tokenized injections from many check-ins).

## 3) Architecture / Reliability

1. Replace in-memory API rate limiter in `app/api/chat/route.ts` with distributed storage-backed limiter (in-memory resets on instance restart/scale-out).
2. Make `file_index` updates durable: currently writes are fire-and-forget (`updateFileIndex` is not awaited), which can create UI/data drift.
3. Add retry/backoff + dead-letter logging for index update failures so sidebar/data reads don’t silently diverge.
4. Add idempotency keys for chat request processing to prevent duplicate assistant writes on network retries.
5. Add optimistic concurrency/version checks for markdown writes where multiple sessions could write overlapping artifacts.
6. Normalize session date handling to user timezone for file naming/check-in cadence (avoid UTC day-boundary mismatch).
7. Add stronger request validation schemas (zod) for all API routes (chat/transcribe/push/etc.) for safer contracts.
8. Add size/type validation for audio uploads in `app/api/transcribe/route.ts` (current checks are minimal).
9. Add timeout and cancellation management for upstream AI/STT requests.
10. Add a background reconciliation job to rebuild/verify `file_index` consistency periodically.

## 4) Security / Trust

1. Remove any remaining user-controlled system-prompt append paths (pulse context) and always derive server-side.
2. Add stricter max body limits and content-type checks across API routes.
3. Add security tests around FILE_UPDATE parsing for malformed/hostile tag variants.
4. Add audit logging for writes to sensitive artifacts (`life-plan/current.md`, `life-map/_overview.md`).
5. Add explicit consent UX before enabling potentially sensitive module integrations (calendar, notifications) with plain-language scope explanations.

## 5) Observability / Ops

1. Add centralized error monitoring (Sentry or equivalent) for API routes and client runtime.
2. Add structured event telemetry for funnel milestones: onboarding complete -> first domain -> synthesis -> first return.
3. Add quality telemetry: parse failures, file write failures, index lag, SSE disconnect rate.
4. Add model cost/token usage dashboards by session type.
5. Add synthetic "daily smoke" checks for key flows (login, chat stream, file update roundtrip).

## 6) Testing / QA

1. Add integration tests for chat pipeline end-to-end (SSE stream -> parser -> file-write-handler).
2. Add tests for `UserFileSystem` write/index consistency and failure modes.
3. Add regression tests for session-state transitions (new_user/mapping/checkin due/overdue).
4. Add API contract tests for `app/api/chat/route.ts` and `app/api/transcribe/route.ts`.
5. Add Playwright critical-path tests for onboarding -> pulse check -> domain exploration -> synthesis.
6. Add visual tests for sidebar + life map rendering states (explored/unexplored/active).
7. Expand markdown extraction tests for edge markdown variants from model output.

## 7) Developer Experience

1. Migrate `next lint` script to ESLint CLI before Next 16 deprecation becomes breaking.
2. Split `components/chat/chat-view.tsx` into smaller units to reduce regression risk and improve testability.
3. Add architecture decision records (ADRs) for key choices: markdown-native storage, FILE_UPDATE protocol, sidebar realtime approach.
4. Add stricter typing around session metadata and parsed blocks to reduce unknown-cast surfaces.
5. Add local seed/dev fixtures for realistic user artifacts to accelerate testing.

## 8) Documentation Process

1. Keep "feedback -> brainstorm -> plan" flow (strong pattern). Add an "audit" doc type for periodic cross-cutting reviews.
2. Add a single index page linking latest feedback/brainstorm/plan docs by date.
3. Add "decision gate metrics" section in each plan (explicit success/fail thresholds).
4. Add "shipped vs not shipped" verification checklist in plans to reduce divergence from execution.
5. Add short postmortem note per sprint with: what changed, what moved metric, what to cut.

---

## Shortlist — Highest Leverage Next

## P0 (Do Now)

1. **Server-side pulse context only** (remove client injection path in chat route).
2. **Distributed rate limiting + request validation** for core API routes.
3. **Durable file-index consistency** (await/index retry/reconciliation), because sidebar + life map depend on this.
4. **End-to-end chat pipeline integration tests** to protect the core product loop.

## P1 (Next Sprint)

1. **Observability baseline**: error monitoring + parse/write/index lag metrics.
2. **Timezone-safe session/check-in date handling** for cadence trust.
3. **Refactor `chat-view.tsx` into testable modules** (session init, streaming, block handling, quick replies).
4. **Mobile life-map progress surface** (bottom-sheet/pill) to match desktop value.

## P2 (After Stability)

1. **Synthesis trust markers** (explicit inferred vs user-stated metadata).
2. **Context-window management** (adaptive compression/summarization).
3. **Full QA automation** with Playwright critical path + visual state coverage.

---

## Why These First

These items maximize outcome on your current strategic question in `Docs/STEERING.md`: whether users return and engage repeatedly. Reliability + trust + observability improvements reduce false negatives in retention experiments (you can trust behavior signals), while maintaining momentum on UX polish.

