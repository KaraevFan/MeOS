---
status: pending
priority: p3
issue_id: "043"
tags: [code-review, refactor, duplication]
dependencies: []
---

# 043 — Extract shared buildDomainPills() helper to eliminate duplication

## Problem Statement

Domain pill construction logic (filter unexplored domains, sort by pulse rating, slice top N, add wrap-up pill) appears in two places in `chat-view.tsx`:

1. Inside the `messages.map()` loop for AI/domain pill rendering
2. Inside `getStatePills()` for the `awaiting_domain_selection` state

Both contain the same sorting, slicing, and "Wrap up" pill logic.

## Findings

- Flagged by: kieran-typescript-reviewer, architecture-strategist
- Not a bug — both work correctly — but violates DRY

## Proposed Solutions

### Option A: Extract buildDomainPills() helper function
- Create a pure function that takes `domainsExplored`, `pulseCheckRatings`, and returns `SuggestionPill[]`
- Call from both locations
- **Effort:** Small
- **Risk:** Low

## Technical Details

- **Affected files:** `components/chat/chat-view.tsx`

## Acceptance Criteria

- [ ] Domain pill logic exists in one place only
- [ ] Both call sites produce identical output to current behavior

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-19 | Identified during PR #22 review | DRY violation in domain pill construction |

## Resources

- PR #22: feat: Unified suggestion pills with AI-generated replies
- `components/chat/chat-view.tsx`
