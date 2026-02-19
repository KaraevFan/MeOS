---
status: pending
priority: p3
issue_id: "017"
tags: [code-review, maintainability, cleanup]
dependencies: []
---

# 017 — Remove "Patch N" tracking comments from source code

## Problem Statement

`bottom-tab-bar.tsx` contains playtest tracking IDs as source comments:
```tsx
// Patch 8: centered within 430px container, constrained on desktop
// Patch 9: z-10 (tab bar layer), bottom sheets are z-[50] and render above
```

These belong in PR descriptions and changelogs, not in source code. After merge they become meaningless archaeology for future developers.

## Findings

- **File:** `components/ui/bottom-tab-bar.tsx:111–112`
- Reported by: Simplicity reviewer (P3)

## Fix

Replace with intent-explaining comments or remove:

```tsx
// Centered within 430px column on desktop — mirrors bottom sheet pattern
<nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-10">
```

**Effort:** Trivial
**Risk:** None

## Acceptance Criteria

- [ ] No "Patch N" comments in source files
- [ ] If comments remain, they explain architectural intent (not PR tracking)

## Work Log

- 2026-02-19: Created from PR #19 code review (Simplicity reviewer P3)
