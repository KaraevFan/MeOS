---
status: complete
priority: p3
issue_id: "111"
tags: [code-review, accessibility, design]
dependencies: []
---

# LifeMapNudge CTA Touch Target Below 44px Minimum

## Problem Statement

The "Continue mapping" CTA link in `components/home/life-map-nudge.tsx:36-39` has `text-[12px]` with no padding, resulting in a tap target smaller than the project's 44px minimum touch target guideline for mobile PWA.

## Findings

- Flagged by: kieran-typescript-reviewer
- MeOS design system requires 44px minimum touch targets (CLAUDE.md)
- The link has no `py-*` padding class

## Proposed Solutions

Add vertical padding: `py-2` on the Link element.

- Effort: Trivial

## Technical Details

- **Affected files:** `components/home/life-map-nudge.tsx:36-39`

## Acceptance Criteria

- [ ] CTA link has at least 44px tap target height

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-25 | Created from PR #34 code review | |

## Resources

- PR: #34
