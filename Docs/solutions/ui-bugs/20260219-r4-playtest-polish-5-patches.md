---
title: "R4.3 Playtest Polish — Sage Pacing, Updated Ratings, Domain Labels, Contrast"
date: 2026-02-19
category: ui-bugs
severity: P0-P2
components:
  - lib/ai/prompts.ts
  - lib/markdown/file-write-handler.ts
  - components/chat/chat-view.tsx
  - lib/constants.ts
  - components/chat/domain-slot-compact.tsx
  - components/onboarding/rating-scale.tsx
tags:
  - playtest-feedback
  - sage-pacing
  - rating-update
  - domain-naming
  - accessibility
  - ai-output-validation
related_sessions:
  - R4.2 playtest with James persona
---

# R4.3 Playtest Polish — 5 Patches

Five issues discovered during R4.2 playtest with "James" persona. Root causes span prompt engineering, data flow gaps, inconsistent label sources, and contrast/accessibility.

## Problem Summary

During playtest, Sage explored domains indefinitely without signaling session progress; domain ratings didn't update when the user revised their self-assessment mid-conversation; the spider chart and domain grid showed different labels for "Meaning / Purpose" ("Purpose" vs "Meaning"); and pulse check endpoint labels were hard to read on the cream background.

---

## Patch 1+4: Sage Pacing & Depth Signals

### Symptom
User spent ~15 minutes on a single domain. Had to ask "How much more do we have to talk on this career stuff?" to trigger a transition. Sage never proactively signaled session arc.

### Root Cause
System prompt in `getLifeMappingPrompt()` had no depth signals or session arc guidance. Step 2 said "explore" without bounds. Step 3 said "ask if they want to continue" without framing session progress.

### Fix
Added to `lib/ai/prompts.ts`:

**Depth signals (Step 2):**
```
DEPTH SIGNALS — move toward generating the domain card when 2+ of these are present:
- User has named a specific tension or frustration
- User has identified what's working vs. what's not
- User has expressed a desire or intention (even vague)
- User has had a moment of emotional honesty or self-revision
- You've exchanged 6+ messages on this domain

PACING BY DOMAIN ORDER:
- 1st domain: 6-10 exchanges
- 2nd domain: 4-6 exchanges
- 3rd domain: 3-4 exchanges
```

**Arc signaling (Step 3):**
After each domain card, Sage signals where the user is in the session: "1-2 more areas" after 1st, "synthesize?" after 2nd, default synthesis after 3rd.

**Hard ceiling (Step 4):**
After 4 domain cards, move to synthesis regardless.

### Key Lesson
Soft pacing suggestions ("suggest wrapping up") fail with LLMs. Use concrete checklists (depth signals) and hard ceilings (4 cards max) instead.

---

## Patch 2: Post-Conversation Rating Update

### Symptom
Career showed "3/5" in shelf after pulse check, but user explicitly revised: "the actual experience of the work... that's lower than a 3. Maybe a 2." Spider chart didn't update.

### Root Cause
No mechanism for Sage to emit a revised rating after conversation. Pulse check baseline was the only rating source.

### Fix
**Data flow:** `Sage outputs updated_rating="2"` → parser captures via existing `extraAttrs` → `file-write-handler.ts` validates → writes as `score` in frontmatter → `chat-view.tsx` updates state + persists to DB.

**Validation (after review fix):**
```typescript
const updatedRating = ratingStr ? Math.round(Number(ratingStr)) : undefined
const validRating = updatedRating && Number.isInteger(updatedRating)
  && updatedRating >= 1 && updatedRating <= 5
  ? updatedRating : undefined
```

### Key Discoveries
- `DomainFileFrontmatterSchema` already had `score` field — no schema migration needed
- Parser already captured unknown attributes via `extraAttrs` — no parser changes needed
- `Math.round()` + `Number.isInteger()` required to prevent fractional ratings like "2.7"
- `sessionId` null guard needed before DB insert

---

## Patch 3: Domain Name Consistency

### Symptom
Spider chart showed "Purpose" for "Meaning / Purpose" domain. Domain grid below showed "Meaning". Same domain, two different labels.

### Root Cause
Two independent abbreviation systems:
- `RADAR_ABBREVIATED_LABELS[7]` = `"Purpose"` (index-based array)
- `abbreviateName("Meaning / Purpose")` = `"Meaning"` (splits on `/`, takes first word)

### Fix
Created single source of truth:
```typescript
export const DOMAIN_SHORT_NAMES: Record<DomainName, string> = {
  'Career / Work': 'Career',
  'Relationships': 'Relations',
  'Health / Body': 'Health',
  'Finances': 'Finances',
  'Learning / Growth': 'Learning',
  'Creative Pursuits': 'Creative',
  'Play / Fun / Adventure': 'Play',
  'Meaning / Purpose': 'Purpose',
}
```

Updated all 4 spider chart call sites + `DomainSlotCompact`. Removed `RADAR_ABBREVIATED_LABELS` and `abbreviateName()`.

### Key Lesson
Use `Record<K, V>` over parallel arrays for enum-to-enum mappings. Index-based arrays silently break on reordering.

---

## Patch 5: Pulse Check Label Contrast

### Symptom
"Rough" and "Thriving" endpoint labels hard to read on cream background at 10px with `text-text` color.

### Fix
```tsx
// Before: text-text at 10px
<span className="text-[10px] ... text-text font-semibold">Rough</span>

// After: semantic status colors at 11px
<span className="text-[11px] ... text-status-crisis font-semibold">Rough</span>
<span className="text-[11px] ... text-accent-sage font-semibold">Thriving</span>
```

### Key Lesson
Use semantic status colors (`text-status-crisis`, `text-accent-sage`) over generic `text-text` for content on light backgrounds. The design system already defines these tokens.

---

## Prevention Strategies

### When Adding AI Output Attributes
- [ ] Validate with `Math.round()` + `Number.isInteger()` for numeric attributes
- [ ] Guard DB writes with `if (sessionId)` null check
- [ ] Test full round-trip: Sage → parser → handler → storage → UI read-back

### When Displaying Domain Names
- [ ] Use `DOMAIN_SHORT_NAMES` lookup, never string splitting
- [ ] Verify label consistency across all display surfaces (chart, grid, sidebar, page)

### When Constraining LLM Behavior
- [ ] Provide concrete signal checklists (not vague guidance)
- [ ] Use hard ceilings over soft suggestions
- [ ] Frame session arc explicitly after each milestone

### When Styling Text on Light Backgrounds
- [ ] Use semantic status/accent colors from design system
- [ ] Minimum 11px for small uppercase labels

---

## Anti-Patterns

| Anti-Pattern | Better Approach |
|---|---|
| Parallel arrays for enum mappings | `Record<DomainName, string>` |
| `rating >= 1 && rating <= 5` without integer check | `Math.round()` + `Number.isInteger()` + bounds |
| `text-text` on cream background | Semantic status colors |
| "Suggest wrapping up after 3 domains" | "Hard ceiling: after 4 domain cards, synthesize" |
| `name.split('/')[0]` for domain abbreviation | `DOMAIN_SHORT_NAMES[name]` lookup |

---

## Related Documentation

- [Markdown Storage Security Review](../security-issues/markdown-storage-security-review-fixes.md) — AI output validation patterns, deny-by-default
- [React Hooks Security & DB Hygiene Review](../code-review-fixes/20260219-react-hooks-security-db-hygiene-multi-pass-review.md) — XML fencing, pulse check API
- [Daily Rhythm P1-P3 Findings](../code-review-fixes/20260218-daily-rhythm-p1-p2-p3-findings.md) — Global regex state leak in parsers
- [Markdown Section Extraction](../logic-errors/markdown-section-extraction-heading-boundary.md) — Heading-level boundary parsing

## References

- Feedback doc: `Docs/feedback/20260219_R4c_polish_onboarding.md`
- Plan: `Docs/plans/2026-02-19-fix-r4c-playtest-polish-plan.md`
- Branch: `fix/r4c-playtest-polish` (commits `7774813`, `ff26174`)
