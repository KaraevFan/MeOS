---
status: complete
priority: p2
issue_id: "078"
tags: [code-review, security, sanitization, pre-existing]
dependencies: []
---

# 078 — Capture sanitization regex does not strip DAY_PLAN_DATA tags

## Problem Statement

The capture sanitization regex in the close_day session flow strips `[FILE_UPDATE]`, `[DOMAIN_SUMMARY]`, and `[LIFE_MAP_SYNTHESIS]` block tags from user captures, but does NOT strip `[DAY_PLAN_DATA]` tags. This is a pre-existing issue (not introduced by the data architecture PR) but was flagged by security review as a gap.

If a user's capture text contains `[DAY_PLAN_DATA]{"energy_level":"stressed"...}[/DAY_PLAN_DATA]`, the parser might interpret it as a structured data block, potentially overwriting the legitimate day plan data.

## Findings

- **File:** `lib/ai/parser.ts` or context injection — sanitization regex covers `FILE_UPDATE`, `DOMAIN_SUMMARY`, `LIFE_MAP_SYNTHESIS` but not `DAY_PLAN_DATA`
- **Vector:** User-controlled capture text injected into system prompt could contain `[DAY_PLAN_DATA]` blocks
- **Impact:** Potential overwrite of legitimate day plan data via prompt injection

## Proposed Solutions

### Option A: Add DAY_PLAN_DATA to existing sanitization regex (Recommended)
Extend the block-tag stripping regex to include `DAY_PLAN_DATA` alongside the existing patterns.
- **Pros:** Consistent with existing sanitization approach; closes the gap
- **Cons:** None significant
- **Effort:** Small
- **Risk:** Low

### Option B: Refactor to a generic block-tag allowlist
Instead of an explicit deny list, strip all `[UPPERCASE_TAG]...[/UPPERCASE_TAG]` patterns from user input.
- **Pros:** Future-proof against new block types
- **Cons:** Higher effort; could accidentally strip legitimate user text with bracket patterns
- **Effort:** Medium
- **Risk:** Medium

## Acceptance Criteria

- [ ] `DAY_PLAN_DATA` added to capture sanitization regex
- [ ] Existing sanitization patterns unchanged
- [ ] Test confirms `[DAY_PLAN_DATA]` is stripped from user input

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
