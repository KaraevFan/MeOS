---
status: complete
priority: p3
issue_id: "096"
tags: [code-review, css, animation]
dependencies: []
---

# BriefingCard Has Duplicate Animation Declaration

## Problem Statement

`BriefingCard` applies both a Tailwind animation class (`animate-fade-up`) and an inline `style={{ animation: 'fade-in-up 0.4s ease-out both' }}`. The inline style overrides the Tailwind class, making it dead code. Same anti-pattern as todo 041 (suggestion-pills), but in a different component.

## Findings

- **Source**: code-simplicity-reviewer
- **Location**: `components/chat/briefing-card.tsx` lines 22-24
- **Note**: Pre-existing, not introduced by this PR, but worth addressing

## Proposed Solutions

Remove the inline `style` prop. Keep only the `animate-fade-up` Tailwind class.

- **Effort**: Trivial
- **Risk**: None (verify animation still works visually)

## Acceptance Criteria

- [ ] Animation declared exactly once (class OR style, not both)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-23 | Found during open-day-flow-redesign code review | Same pattern as todo 041 |
