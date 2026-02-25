---
status: complete
priority: p3
issue_id: "112"
tags: [code-review, simplicity]
dependencies: []
---

# Remove Redundant External Guards for LifeMapNudge

## Problem Statement

`LifeMapNudge` has an internal guard (`if (unmappedDomains.length === 0) return null`) but every call site in `home-screen.tsx` also wraps it in `{data.unmappedDomains.length > 0 && ...}`. One guard is sufficient.

## Findings

- Flagged by: code-simplicity-reviewer
- 3 call sites in home-screen.tsx have redundant external guards (6 lines)
- The component already handles the empty case

## Proposed Solutions

Remove the 3 external guards from `home-screen.tsx` and let the component own its visibility:
```tsx
// Before (3 locations):
{data.unmappedDomains.length > 0 && (
  <LifeMapNudge unmappedDomains={data.unmappedDomains} />
)}

// After:
<LifeMapNudge unmappedDomains={data.unmappedDomains} />
```

- Effort: Trivial (-6 lines)

## Technical Details

- **Affected files:** `components/home/home-screen.tsx` (3 locations)

## Acceptance Criteria

- [ ] External guards removed
- [ ] Component still renders nothing when no unmapped domains

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-25 | Created from PR #34 code review | |

## Resources

- PR: #34
