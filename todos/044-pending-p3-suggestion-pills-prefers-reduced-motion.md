---
status: pending
priority: p3
issue_id: "044"
tags: [code-review, accessibility, animation]
dependencies: ["041"]
---

# 044 — Add prefers-reduced-motion support for suggestion pills animation

## Problem Statement

The `SuggestionPills` component uses a `fade-in-up` animation but doesn't respect `prefers-reduced-motion`. Users who have reduced motion enabled in their OS should not see the animation.

The plan's acceptance criteria explicitly listed this as a requirement.

## Findings

- Flagged by: learnings-researcher (institutional pattern)
- Related todo: `018-pending-p3-prefers-reduced-motion-orb.md` — same pattern needed for orb animation
- Should be solved in `globals.css` with a `@media (prefers-reduced-motion: reduce)` query on the `fade-in-up` keyframes

## Proposed Solutions

### Option A: Add media query in globals.css (Recommended)
- Add `@media (prefers-reduced-motion: reduce) { .animate-fade-in-up { animation: none; } }`
- Covers all uses of the animation, not just pills
- **Effort:** Small
- **Risk:** Low

## Technical Details

- **Affected files:** `app/globals.css` or Tailwind config

## Acceptance Criteria

- [ ] `prefers-reduced-motion: reduce` disables fade-in-up animation
- [ ] Pills still render correctly (just without animation)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-19 | Identified during PR #22 review | Accessibility requirement from plan |

## Resources

- PR #22: feat: Unified suggestion pills with AI-generated replies
- Plan: acceptance criteria line 199
- Related: `todos/018-pending-p3-prefers-reduced-motion-orb.md`
