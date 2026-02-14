---
title: extractCommitments() returns empty array due to heading-level boundary mismatch
date: 2026-02-14
category: logic-errors
severity: high
component: markdown-extraction
tags: [markdown-parsing, regex, heading-levels, life-plan, extractCommitments]
symptoms:
  - extractCommitments() always returns [] for any input
  - Home page commitment cards show no data
  - Life Map "What I'm Doing" tab is empty
  - Chat pinned context card never appears
root_cause: extractMarkdownSection() uses #{1,3} regex which stops at h3 sub-headings that are part of the section content
resolution: Replaced with custom level-aware extraction using #{1,2} to only stop at h1/h2 boundaries
time_to_resolve: 15 minutes
discovered_by: unit-tests
affected_files:
  - lib/markdown/extract.ts
  - lib/markdown/extract.test.ts
related_docs:
  - Docs/solutions/security-issues/markdown-storage-security-review-fixes.md
  - Docs/plans/2026-02-14-feat-markdown-data-architecture-plan.md
---

# extractCommitments() returns empty array due to heading-level boundary mismatch

## Problem

`extractCommitments()` in `lib/markdown/extract.ts` always returned an empty array `[]`, regardless of input. The function parses structured commitments from life plan markdown files and feeds three UI surfaces:

- **Home page** commitment cards
- **Life Map** "What I'm Doing" tab
- **Chat** pinned context card for weekly check-ins

All three would display empty/missing commitment data for any user who completed a life plan.

## Investigation

The function delegated section extraction to `extractMarkdownSection(content, 'Active Commitments')`, a shared helper. Tracing the helper's regex revealed the issue:

```typescript
// extractMarkdownSection internals:
const headingRegex = new RegExp(`^#{1,3}\\s+${escaped}`, 'm')  // Finds the heading
const nextHeading = afterHeading.search(/^#{1,3}\s/m)           // Finds the boundary
```

The boundary regex `#{1,3}\s` matches headings at levels h1, h2, AND h3. The life plan markdown structure uses h3 sub-headings for individual commitments:

```markdown
## Active Commitments          <-- h2: section start

### Launch side project        <-- h3: commitment (should be INSIDE the section)
**Why it matters:** ...
**Status:** in_progress

#### Next Steps                <-- h4: sub-section
- [ ] Build landing page
```

The helper found `## Active Commitments`, then immediately hit `### Launch side project` as the "next heading boundary." The extracted section contained only whitespace between the two headings, which produced zero commitments after splitting.

## Root Cause

**Contract mismatch between caller and helper.** `extractMarkdownSection` treats all h1-h3 headings as section boundaries. This works for flat sections (narrative, bullet lists) but breaks for hierarchical content where h3 sub-headings carry semantic meaning within an h2 section.

The helper's behavior was undocumented, so the caller assumed "section" meant "everything under this h2 until the next h2" when the implementation meant "everything until the next h1, h2, or h3."

## Solution

Replaced the `extractMarkdownSection` call in `extractCommitments` with custom level-aware extraction that only stops at h1/h2 boundaries:

```typescript
// Before (broken): stops at h3 sub-headings
const section = extractMarkdownSection(content, 'Active Commitments')

// After (fixed): preserves h3 sub-headings within the section
const sectionMatch = content.match(/^##\s+Active Commitments\s*$/m)
if (!sectionMatch || sectionMatch.index === undefined) return []

const afterHeading = content.slice(sectionMatch.index + sectionMatch[0].length)
const nextH1OrH2 = afterHeading.search(/^#{1,2}\s/m)
const section = (nextH1OrH2 === -1 ? afterHeading : afterHeading.slice(0, nextH1OrH2)).trim()
```

The key change: `#{1,2}\s` instead of `#{1,3}\s` for the boundary regex. This keeps h3 (`###`) and h4 (`####`) headings inside the extracted section.

The shared `extractMarkdownSection` helper was left unchanged because all its other callers operate on flat sections where the h1-h3 boundary is correct.

## Impact

- **3 UI surfaces fixed**: commitment cards, life plan tab, and pinned context card
- **Latent bug**: discovered before any user hit it (Sprint 1 MVP, no life plans completed yet)
- **18 unit tests added** covering well-formed input, missing fields, empty sections, status normalization, whitespace handling, and checkbox parsing

## Prevention Strategies

### When to use `extractMarkdownSection` vs. custom extraction

| Use `extractMarkdownSection` | Use custom level-aware extraction |
|------------------------------|-----------------------------------|
| Flat sections (paragraphs, bullet lists) | Sections with h3+ sub-headings |
| No internal heading hierarchy | Hierarchical content (commitments, nested structures) |
| "Get text between two h2s" | "Get everything under this h2, including its h3 children" |

### For any new markdown extraction function

1. **Document heading-level assumptions** in the function's JSDoc
2. **Write tests first** that include both flat and hierarchical content
3. **Test the empty case** (section missing, section empty)
4. **Test LLM output variance** (missing fields, alternative formatting)
5. **Never assume** `extractMarkdownSection` handles sub-headings correctly

### Testing checklist for parser functions

- [ ] Well-formed input with all fields
- [ ] Missing optional fields (graceful defaults)
- [ ] Missing section entirely (returns empty)
- [ ] Empty section (returns empty)
- [ ] h3 sub-headings preserved (if hierarchical)
- [ ] Extra whitespace handling
- [ ] Status/enum normalization
- [ ] Section at end of file (no following heading)

## Related

- `Docs/solutions/security-issues/markdown-storage-security-review-fixes.md` -- parallel reads optimization and path validation for the same file system
- `Docs/plans/2026-02-14-feat-markdown-data-architecture-plan.md` -- Phase 3 research notes document `extractMarkdownSection` fragility with heading text variance
- `lib/markdown/extract.test.ts` -- 18 unit tests that would have caught this immediately
- `lib/markdown/extract.ts:10-20` -- the shared helper (unchanged, works for flat sections)
- `lib/markdown/extract.ts:68-80` -- the fixed level-aware extraction
