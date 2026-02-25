---
status: complete
priority: p2
issue_id: "108"
tags: [code-review, quality, home-data]
dependencies: []
---

# Loose `.includes()` Substring Match in Domain File Detection

## Problem Statement

In `lib/supabase/home-data.ts:227`, the unmapped domain detection uses `.includes(filename)` to check whether a domain file exists. This is a substring match that could produce false positives if domain filenames overlap (e.g., `'play'` matching a hypothetical `display.md`).

Currently the domain filenames (`career`, `relationships`, `health`, `finances`, `learning`, `creative-pursuits`, `play`, `meaning`) are non-overlapping, so this works. But the match is unnecessarily loose.

## Findings

- Flagged by: kieran-typescript-reviewer, architecture-strategist
- The `DOMAIN_FILE_MAP` values are base names without extensions
- `listFiles('life-map/')` returns paths like `career.md`, `_overview.md`
- `'career.md'.includes('career')` works, but `'display.md'.includes('play')` would also match

## Proposed Solutions

### Option A: Exact path equality (Recommended)
```typescript
return !existingFiles.some((f) => f === `life-map/${filename}.md`)
```
- Pros: Exact match, no false positives
- Cons: Assumes listFiles returns full paths with `life-map/` prefix
- Effort: Small

### Option B: Starts-with check
```typescript
return !existingFiles.some((f) => f === `${filename}.md` || f === `life-map/${filename}.md`)
```
- Pros: Handles both path formats
- Effort: Small

## Recommended Action

_To be filled during triage_

## Technical Details

- **Affected files:** `lib/supabase/home-data.ts:227`
- **Components:** Home screen data fetching

## Acceptance Criteria

- [ ] Domain file matching uses exact path equality instead of substring
- [ ] All 8 domains still correctly detected as mapped/unmapped

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-25 | Created from PR #34 code review | Substring matching on file paths is a recurring risk |

## Resources

- PR: #34
