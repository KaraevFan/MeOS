---
status: pending
priority: p2
issue_id: "086"
tags: [code-review, quality, tailwind]
dependencies: []
---

# InfoCard className Uses String Concat Instead of cn()

## Problem Statement

`InfoCard` uses raw string concatenation for its `className` prop, meaning consumer overrides like `className="mx-0 mt-0"` coexist with built-in `mx-5 mt-4` rather than merging properly. This works by Tailwind CSS ordering happenstance but is fragile.

## Findings

- **Source**: kieran-typescript-reviewer agent
- **Location**: `components/ui/info-card.tsx` line 17
- **Evidence**: Template literal concatenation `${className}` instead of `cn()` (clsx + tailwind-merge)
- **Project convention**: `cn()` helper is the established pattern for conditional class names

## Proposed Solutions

### Option A: Use cn() for className merging (Recommended)
```typescript
import { cn } from '@/lib/utils'
className={cn(
  'mx-5 mt-4 bg-white rounded-2xl ...',
  borderColors[borderColor],
  className,
)}
```

- **Pros**: Proper utility merging, follows project convention
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] InfoCard uses `cn()` for className composition
- [ ] Consumer `className="mx-0 mt-0"` properly overrides default margins

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-23 | Found during code review | Pre-existing pattern, new className prop makes it a real concern |
