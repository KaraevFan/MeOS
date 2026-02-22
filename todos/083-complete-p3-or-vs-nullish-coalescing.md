---
status: complete
priority: p3
issue_id: "083"
tags: [code-review, typescript, code-quality]
dependencies: []
---

# 083 — Replace || fallbacks with ?? (nullish coalescing) in new code

## Problem Statement

Several places in the new code use `||` for fallback values where `??` (nullish coalescing) would be more precise. For example, `reflection_day: updates.reflection_day ?? existing?.reflection_day ?? 'Sunday'` correctly uses `??`, but other places use `||` which would incorrectly treat `0`, `''`, or `false` as falsy. While this isn't causing bugs right now (the values in question are strings that are never empty), it's inconsistent with TypeScript best practices.

## Findings

The codebase has inconsistent use of `||` vs `??` for fallback values. Some locations correctly use nullish coalescing while others use logical OR, creating an inconsistent pattern that could mask bugs if value types change in the future.

## Proposed Solutions

### Option A: Audit and replace || with ?? where appropriate
Audit new code for `||` fallbacks and replace with `??` where the intent is "if null or undefined". Effort: Trivial. Risk: None.

## Acceptance Criteria

- [ ] `||` fallbacks replaced with `??` where appropriate in new code
- [ ] No behavior changes
