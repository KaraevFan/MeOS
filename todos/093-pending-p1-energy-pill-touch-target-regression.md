---
status: complete
priority: p1
issue_id: "093"
tags: [code-review, accessibility, mobile, design-constraint]
dependencies: []
---

# Touch Target Regression in Energy Check Card

## Problem Statement

The energy check pill buttons were changed from `min-h-[44px]` to `h-[40px]`, violating the project's non-negotiable design constraint: "Touch targets minimum 44px" (CLAUDE.md). This is a mobile accessibility regression on a primary interaction element.

## Findings

- **Source**: kieran-typescript-reviewer, code-simplicity-reviewer (both flagged independently)
- **Location**: `components/chat/energy-check-card.tsx` line 55
- **Evidence**:
  ```tsx
  // BEFORE (correct):
  'flex items-center gap-3 px-4 min-h-[44px] text-left',
  // AFTER (violates 44px rule):
  'flex items-center gap-1.5 px-3 h-[40px] rounded-full',
  ```

## Proposed Solutions

Change `h-[40px]` to `h-11` (44px in Tailwind scale). Consider also bumping `px-3` to `px-4` for more comfortable horizontal tap area on short labels like "Low".

- **Effort**: Trivial (1-line change)
- **Risk**: None

## Acceptance Criteria

- [ ] All mood pill buttons are at least 44px tall
- [ ] Touch targets comfortable on mobile devices

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-23 | Found during open-day-flow-redesign code review | Layout redesign introduced touch target violation |
