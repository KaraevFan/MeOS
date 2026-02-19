---
status: pending
priority: p2
issue_id: "040"
tags: [code-review, prompts, duplication]
dependencies: []
---

# 040 — Double injection of SUGGESTED_REPLIES instruction for close-day sessions

## Problem Statement

The `close-day` session type receives the `SUGGESTED_REPLIES_FORMAT` instruction **twice**:

1. **Skill file:** `skills/close-day.md` lines 86-95 contain an explicit "Suggested Replies" section with the instruction and example.
2. **Code path:** `lib/ai/context.ts` appends `SUGGESTED_REPLIES_FORMAT` for all skill-based prompts via `basePrompt += SUGGESTED_REPLIES_FORMAT`.

This wastes tokens and may confuse the model with redundant instructions.

## Findings

- Flagged by: kieran-typescript-reviewer, architecture-strategist, code-simplicity-reviewer
- `skills/open-day.md` already has its own section (lines 69-74, 86-91) AND gets the context.ts append — same double-injection issue.
- The plan noted `open-day.md` "Already has it — verify format matches" but didn't account for the context.ts append path.

## Proposed Solutions

### Option A: Remove from skill files (Recommended)
- **Pros:** Single source of truth in code, all skills get it automatically, less maintenance
- **Cons:** Skill files are less self-documenting
- **Effort:** Small
- **Risk:** Low

### Option B: Remove from context.ts, keep in skill files
- **Pros:** Each skill file is self-contained
- **Cons:** Must manually add to every new skill file, easy to forget
- **Effort:** Small
- **Risk:** Medium (future skills may miss it)

## Technical Details

- **Affected files:** `skills/close-day.md`, `skills/open-day.md`, `lib/ai/context.ts`
- **Components:** Prompt construction pipeline

## Acceptance Criteria

- [ ] SUGGESTED_REPLIES instruction appears exactly once per session prompt
- [ ] All session types (life_mapping, weekly_checkin, close-day, open-day) still receive the instruction
- [ ] `npm run build` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-19 | Identified during PR #22 review | Double-injection from skill file + context.ts append |

## Resources

- PR #22: feat: Unified suggestion pills with AI-generated replies
- `lib/ai/context.ts:350-352`
- `skills/close-day.md:86-95`
- `skills/open-day.md:69-74, 86-91`
