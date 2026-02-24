---
status: pending
priority: p2
issue_id: "103"
tags: [code-review, security, dry]
dependencies: []
---

# `stripBlockTags()` Duplicated — Security-Critical Regex in Two Files

## Problem Statement

`stripBlockTags()` is a security-critical function that prevents prompt injection by stripping structured block tags from user content before AI prompt injection. It exists as a private function in two separate files with identical implementations. If a new block tag type is added, one copy may be updated while the other is forgotten.

The project's own security documentation (`docs/solutions/security-issues/2026-02-23-context-injection-sanitization-hardening.md`) explicitly identifies this as a security primitive.

## Findings

- **Source**: architecture-strategist, security-sentinel
- **Locations**:
  - `lib/ai/context.ts` (private function, not exported)
  - `app/api/session/generate-summary/route.ts` lines 11-16 (local copy)

## Proposed Solutions

Export from a shared module:

```typescript
// lib/ai/sanitize.ts
export function stripBlockTags(text: string): string {
  return text.replace(
    /\[\/?(FILE_UPDATE|DOMAIN_SUMMARY|LIFE_MAP_SYNTHESIS|SESSION_SUMMARY|SUGGESTED_REPLIES|INLINE_CARD|INTENTION_CARD|DAY_PLAN_DATA)[^\]]*\]/g,
    ''
  )
}
```

Import in both `context.ts` and `generate-summary/route.ts`.

- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] Single source of truth for `stripBlockTags()`
- [ ] Both consumers import from shared module
