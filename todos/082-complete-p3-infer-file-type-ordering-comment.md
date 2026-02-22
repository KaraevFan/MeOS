---
status: complete
priority: p3
issue_id: "082"
tags: [code-review, maintainability, documentation]
dependencies: []
---

# 082 — Add ordering comment to inferFileType() match cases

## Problem Statement

In `lib/markdown/user-file-system.ts`, the `inferFileType()` method has an exact-match case for `life-plan/weekly.md` placed BEFORE the prefix-match for `life-plan/`. This ordering is correct and necessary (exact match must come first), but it's fragile — a future developer might reorder the cases or add new ones without understanding the precedence requirement.

## Findings

The current ordering works correctly, but there is no comment or documentation explaining why the exact-match case must precede the prefix match. This is a maintainability risk for future contributors.

## Proposed Solutions

### Option A: Add explanatory comment
Add a brief comment above the exact-match case explaining why it must precede the prefix match. Effort: Trivial. Risk: None.

## Acceptance Criteria

- [ ] Comment added explaining exact-match-before-prefix ordering
- [ ] No code changes
