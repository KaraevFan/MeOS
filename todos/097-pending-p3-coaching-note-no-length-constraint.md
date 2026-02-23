---
status: complete
priority: p3
issue_id: "097"
tags: [code-review, security, defense-in-depth]
dependencies: []
---

# No Length Constraint on coaching_note in Zod Schema

## Problem Statement

The new `coaching_note` field is validated as `z.string().optional()` without a `.max()` constraint. While the Claude API's `max_tokens: 1024` naturally limits output, an unbounded string could theoretically cause layout issues or storage bloat. The prompt says coaching moments should be "Max 2 sentences", but there is no code-level enforcement.

## Findings

- **Source**: security-sentinel, agent-native-reviewer (both flagged independently)
- **Location**: `lib/ai/parser.ts` line 36
- **Note**: This applies equally to sibling fields (`intention`, `text`, `provenance_label`) — a broader hardening task

## Proposed Solutions

Add `.max(500)` to the coaching_note field:

```typescript
coaching_note: z.string().max(500).optional(),
```

- **Effort**: Trivial
- **Risk**: Low (might reject an unexpectedly long AI output, but 500 chars is ~4 sentences)

## Acceptance Criteria

- [ ] coaching_note Zod field has a max length constraint

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-23 | Found during open-day-flow-redesign code review | Defense-in-depth for AI-generated string fields |
