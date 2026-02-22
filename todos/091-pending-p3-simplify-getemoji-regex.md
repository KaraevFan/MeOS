---
status: pending
priority: p3
issue_id: "091"
tags: [code-review, simplification]
dependencies: []
---

# Simplify getEmoji Regex in EnergyCheckCard

## Problem Statement

`getEmoji()` uses a Unicode regex to strip emoji prefixes from labels before lookup. Since the AI prompt now emits plain text labels (no emoji), the regex is over-defensive. A direct lowercase/trim lookup suffices.

## Findings

- **Source**: code-simplicity-reviewer agent
- **Location**: `components/chat/energy-check-card.tsx` lines 16-19

## Proposed Solutions

```typescript
function getEmoji(label: string): string | undefined {
  return ENERGY_EMOJI[label.toLowerCase().trim()]
}
```

- **Effort**: Trivial
- **Risk**: Low (graceful degradation if AI ever adds emoji again)

## Acceptance Criteria

- [ ] getEmoji uses direct lookup without regex

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-23 | Found during code review | Prompt now emits clean labels, regex is unnecessary |
