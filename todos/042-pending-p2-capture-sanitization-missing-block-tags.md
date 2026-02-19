---
status: pending
priority: p2
issue_id: "042"
tags: [code-review, security, pre-existing]
dependencies: []
---

# 042 — Capture sanitization regex missing newer block tags (pre-existing)

## Problem Statement

The capture sanitization regex in `lib/ai/context.ts` (around line 226) strips structured output blocks from stored messages to prevent prompt injection. However, it may not include the `SUGGESTED_REPLIES` tag or other newer block tags added since the regex was last updated.

If a user's stored message contains injected `[SUGGESTED_REPLIES]` blocks, they could leak into the context window and produce unintended pill suggestions.

**Note:** This is a pre-existing issue, not introduced by PR #22, but the PR increases its relevance by making `[SUGGESTED_REPLIES]` blocks meaningful to the UI.

## Findings

- Flagged by: security-sentinel
- Overall PR security risk: LOW
- This is defense-in-depth — the parser already handles the blocks correctly, but sanitization should be comprehensive

## Proposed Solutions

### Option A: Add SUGGESTED_REPLIES to sanitization regex (Recommended)
- Update the regex pattern to include `SUGGESTED_REPLIES` alongside existing block tags
- Audit for any other missing tags while at it
- **Effort:** Small
- **Risk:** Low

## Technical Details

- **Affected files:** `lib/ai/context.ts` (~line 226)

## Acceptance Criteria

- [ ] Sanitization regex includes `SUGGESTED_REPLIES` tag
- [ ] All structured output block tags are covered by sanitization
- [ ] Existing sanitization behavior unchanged for previously handled tags

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-19 | Identified during PR #22 review | Pre-existing gap, now more relevant |

## Resources

- PR #22: feat: Unified suggestion pills with AI-generated replies
- `lib/ai/context.ts:~226`
- Related: `todos/010-pending-p2-stored-prompt-injection-xml-fence.md`
