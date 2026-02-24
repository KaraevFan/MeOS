---
status: pending
priority: p2
issue_id: "105"
tags: [code-review, typescript, type-safety]
dependencies: []
---

# `completion-detection.ts` Lacks Exhaustive Switch Check

## Problem Statement

The `detectTerminalArtifact()` function uses a `switch` on `sessionType` but the `default` branch silently handles `ad_hoc` and `quick_capture` without documentation. Adding a new session type could silently fall through. The project already uses the exhaustive check pattern elsewhere (e.g., `buildPulseContext` at line 202 of `route.ts`).

## Findings

- **Source**: kieran-typescript-reviewer, agent-native-reviewer
- **Location**: `lib/ai/completion-detection.ts` lines 47-51

## Proposed Solutions

Add explicit cases and exhaustive check:

```typescript
case 'ad_hoc':
case 'quick_capture':
  return 'none'

default: {
  const _exhaustive: never = sessionType
  return _exhaustive
}
```

- **Effort**: Trivial
- **Risk**: Low

## Acceptance Criteria

- [ ] All session types explicitly handled
- [ ] Adding a new session type causes a compile error
