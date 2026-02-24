---
status: pending
priority: p2
issue_id: "104"
tags: [code-review, quality, consistency]
dependencies: []
---

# `isTerminalBlock()` Missing Legacy Block Types

## Problem Statement

The client-side `isTerminalBlock()` in `message-bubble.tsx` checks for `day_plan_data` and `file_update` types but does not check for `life_map_synthesis` or `session_summary` block types. The server-side `detectTerminalArtifact()` handles these via `[LIFE_MAP_SYNTHESIS]` and `[SESSION_SUMMARY]` string matching. If a legacy-format response comes through, trailing send-off text would not be suppressed.

## Findings

- **Source**: kieran-typescript-reviewer
- **Location**: `components/chat/message-bubble.tsx` lines 142-149
- **Related**: `lib/ai/completion-detection.ts` covers both new and legacy block types

## Proposed Solutions

Add missing block types:

```typescript
function isTerminalBlock(segment: ParsedSegment): boolean {
  if (segment.type !== 'block') return false
  if (segment.blockType === 'day_plan_data') return true
  if (segment.blockType === 'life_map_synthesis') return true
  if (segment.blockType === 'session_summary') return true
  if (segment.blockType === 'file_update') {
    return ['daily-log', 'overview', 'check-in', 'day-plan'].includes(segment.data.fileType)
  }
  return false
}
```

- **Effort**: Trivial
- **Risk**: Low

## Acceptance Criteria

- [ ] `isTerminalBlock` covers all terminal block types
- [ ] Trailing text suppressed for legacy synthesis/summary blocks
