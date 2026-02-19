---
status: pending
priority: p3
issue_id: "013"
tags: [code-review, architecture, css, maintainability]
dependencies: []
---

# 013 — Z-index values undocumented; no semantic map in tailwind.config

## Problem Statement

The z-index hierarchy established in this PR (tab bar z-10 → sticky-header z-20 → backdrop z-[40] → sheet z-[50]) uses magic integers without a centralized source of truth. The orb container also has an undocumented `z-30` scoped inside the tab bar. A future developer adding an overlay has no reference for which values are in use.

## Findings

- `bottom-tab-bar.tsx:113` — nav `z-10`
- `bottom-tab-bar.tsx:115` — orb container `z-30` (undocumented intent)
- `user-menu-sheet.tsx:41` — backdrop `z-[40]`
- `user-menu-sheet.tsx:50` — sheet `z-[50]`
- `history/[sessionId]/page.tsx:56` — sticky header `z-10` (same as tab bar — accidental non-collision)
- Reported by: Architecture reviewer (P2→P3)

## Fix

Add named z-index tokens to `tailwind.config.ts`:

```ts
extend: {
  zIndex: {
    'tab-bar': '10',
    'sticky-header': '20',
    'orb': '30',
    'backdrop': '40',
    'sheet': '50',
  }
}
```

Then replace magic values with named utilities: `z-tab-bar`, `z-sticky-header`, `z-orb`, `z-backdrop`, `z-sheet`.

**Effort:** Small
**Risk:** Low

## Acceptance Criteria

- [ ] Named z-index tokens in `tailwind.config.ts`
- [ ] All z-index values in tab bar, sheet, and sticky headers use named tokens

## Work Log

- 2026-02-19: Created from PR #19 code review (Architecture reviewer P2)
