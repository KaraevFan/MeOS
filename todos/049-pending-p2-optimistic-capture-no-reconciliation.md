---
status: pending
priority: p2
issue_id: "049"
tags: [code-review, react, optimistic-ui, day-plan]
dependencies: []
---

# 049 — Optimistic capture has fake ID — breaks toggle, no error recovery

## Problem Statement

`CaptureInput` creates an optimistic capture with `id: 'temp-${Date.now()}'` and empty `user_id`. After server save, the list permanently contains a row with a fake ID. If the user toggles this capture's completed state, `toggle-capture` API receives a non-UUID `captureId` which fails Zod validation (`z.string().uuid()`). On fetch failure, the capture is lost from Postgres with no user indication.

Additionally, `CaptureCard.toggleCompleted` uses a stale closure for error revert: `setIsCompleted(isCompleted)` captures the pre-toggle value by coincidence, but is fragile. Should use `setIsCompleted(prev => !prev)`.

## Findings

- **File:** `components/day-plan/capture-input.tsx:24-56` — fake ID, no reconciliation
- **File:** `components/day-plan/captured-thoughts.tsx:86-98` — stale closure in error revert
- **Evidence:**
  ```typescript
  // capture-input.tsx — optimistic capture with temp ID
  const optimisticCapture: Capture = {
    id: `temp-${Date.now()}`,  // not a UUID — breaks toggle API
    user_id: '',               // empty string
  }
  ```

## Proposed Solutions

### Option A: Reconcile optimistic capture with server response (Recommended)
- Return `captureId` from `/api/capture` response
- Replace temp ID with real ID after server confirms
- On failure, remove the optimistic capture or show error
- Fix stale closure with functional updater `setIsCompleted(prev => !prev)`
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] After capture save, optimistic capture ID replaced with real UUID
- [ ] Toggling a newly-captured item works (UUID passes Zod)
- [ ] On save failure, user sees indication (or capture removed from list)
- [ ] Toggle error revert uses functional updater

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-20 | Identified by code review | TypeScript + learnings reviewers flagged |
