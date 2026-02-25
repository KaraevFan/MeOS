---
status: complete
priority: p2
issue_id: "109"
tags: [code-review, agent-native, context-injection]
dependencies: []
---

# Sage System Prompt Lacks Life Map Domain Coverage

## Problem Statement

The Home screen now shows users which life domains are unmapped via `LifeMapNudge`, but Sage's system prompt (`buildConversationContext` in `lib/ai/context.ts`) does not receive this same information. When a user taps "Continue mapping" and enters a `life_mapping` session, Sage doesn't know which domains are already mapped vs. unmapped.

This creates a context discontinuity: the user sees "just Health and Finances left" on the Home screen, but Sage may suggest all 8 domains.

## Findings

- Flagged by: agent-native-reviewer
- `fetchAndInjectFileContext()` in `lib/ai/context.ts` reads domain files that are flagged (needs_attention/in_crisis) but does not enumerate which files exist
- `detectSessionState` returns `unexploredDomains` only for `mapping_in_progress` state (intra-session), not cross-session
- The same `ufs.listFiles('life-map/')` call could be added to context building

## Proposed Solutions

### Option A: Inject domain coverage into system prompt (Recommended)
Add a `LIFE MAP COVERAGE` section to `fetchAndInjectFileContext()`:
```typescript
const domainFiles = await ufs.listFiles('life-map/')
const mapped = ALL_DOMAINS.filter(d => domainFiles.some(f => f.includes(DOMAIN_FILE_MAP[d])))
const unmapped = ALL_DOMAINS.filter(d => !mapped.includes(d))
if (unmapped.length > 0 && unmapped.length < ALL_DOMAINS.length) {
  parts.push('\nLIFE MAP COVERAGE:')
  parts.push(`Mapped: ${mapped.join(', ')}`)
  parts.push(`Unmapped: ${unmapped.join(', ')}`)
}
```
- Pros: Sage always knows mapping status; eliminates context discontinuity
- Cons: Adds one more Storage listing call to context building
- Effort: Small (~30 min)

### Option B: Pass unmapped domains via URL params
Link from nudge CTA to `/chat?type=life_mapping&unmapped=Health,Finances`
- Pros: Only adds context when navigating from nudge
- Cons: Doesn't help when user navigates to life_mapping from other paths
- Effort: Medium

## Recommended Action

_To be filled during triage_

## Technical Details

- **Affected files:** `lib/ai/context.ts` (fetchAndInjectFileContext)
- **Components:** Sage conversation context, system prompt

## Acceptance Criteria

- [ ] Sage's system prompt includes which domains are mapped vs. unmapped
- [ ] Life mapping sessions correctly reference existing domain coverage
- [ ] No regression in system prompt token usage (section only added when partial mapping exists)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-25 | Created from PR #34 code review | UI parity != agent parity — Sage needs the same data |

## Resources

- PR: #34
- Related: agent-native-reviewer Warning 1
