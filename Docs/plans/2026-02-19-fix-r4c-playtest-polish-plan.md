---
title: "fix: R4.3 Playtest Polish — Sage Pacing, Updated Ratings, Domain Labels, Contrast"
type: fix
date: 2026-02-19
source: Docs/feedback/20260219_R4c_polish_onboarding.md
---

# R4.3 Playtest Polish

Five patches from the R4.2 playtest with "James" persona. Patches 1 & 4 are combined (both address Sage pacing). Priority order: P0 first, then P1s, then P2.

## Overview

| # | Patch | Type | Files |
|---|-------|------|-------|
| 1+4 | Sage pacing & depth signals | Prompt | `lib/ai/prompts.ts` |
| 2 | Post-conversation rating update | Prompt + Backend + UI | 7 files |
| 3 | Domain name consistency | UI | `lib/constants.ts`, `components/chat/domain-slot-compact.tsx` |
| 5 | Pulse check label contrast | UI | `components/onboarding/rating-scale.tsx` |

---

## Phase 1: Sage Pacing & Depth Signals (Patches 1 + 4) — Prompt Only

**Problem:** Sage never signals session arc and doesn't proactively move toward domain cards after sufficient depth. User had to ask "how much more" to trigger transitions.

**Approach:** Modify `getLifeMappingPrompt()` in `lib/ai/prompts.ts`. No code changes.

### Changes to `lib/ai/prompts.ts`

#### 1a. Add session arc signaling after step 3 (line ~105)

After the instruction to generate a domain card, add arc signaling:

```
3. AFTER EACH DOMAIN: Generate a [FILE_UPDATE type="domain"] block with the domain summary.
   THEN signal the session arc:
   - After 1st domain card: "We went deep on [Domain] — I want to touch on one, maybe two more areas before we pull it all together. Given what came up about [specific tension], I'm curious about [suggested next domain]. Want to go there?"
   - After 2nd domain card: Default toward synthesis: "I think we have enough to work with. Want me to synthesize what I'm seeing, or is there one more area calling to you?"
   - After 3rd domain card: Move to synthesis regardless: "We've covered a lot of ground. Let me pull together what I'm seeing across these areas."
   The user should ALWAYS know where they are in the session arc. The pill shows domain count; YOUR words frame session progress.
```

#### 1b. Add domain depth management to step 2 (line ~103)

Replace the current exploration instruction with depth-aware guidance:

```
2. DOMAIN EXPLORATION: For each domain, explore: current state, what's working, what's not, desires, tensions, and stated intentions.
   DEPTH SIGNALS — move toward the domain card when 2+ of these are present:
   - User has named a specific tension or frustration
   - User has identified what's working vs. what's not
   - User has expressed a desire or intention (even vague)
   - User has had a moment of emotional honesty or self-revision
   - You've exchanged 6+ messages on this domain
   When you see these signals, gently offer to capture: "I think I have a clear picture here. Let me capture what I'm hearing."
   PACING BY DOMAIN ORDER:
   - 1st domain: Go deep. Follow emotional energy. 6-10 exchanges.
   - 2nd domain: More focused. Reference connections to 1st domain. 4-6 exchanges.
   - 3rd domain (if any): Keep it tight. 3-4 exchanges, then card.
```

### Acceptance Criteria

- [x] After first domain card, Sage proactively signals "1-2 more areas then synthesis"
- [x] Second domain exploration is noticeably shorter (4-6 exchanges)
- [x] After second domain card, Sage defaults toward synthesis
- [x] After third domain card, Sage moves to synthesis regardless
- [x] Sage recognizes domain completeness signals and begins wrapping that domain
- [x] User never has to ask "how much more"

---

## Phase 2: Post-Conversation Rating Update (Patch 2)

**Problem:** Pulse check rating shows initial self-report (e.g., Career = 3/5) but user revised their assessment during conversation ("maybe a 2"). The shelf/spider chart doesn't reflect the revision.

**Design decision:** Unified 1-5 scale everywhere. No /10. Sage outputs `updated_rating` as a FILE_UPDATE attribute. System persists it.

### Data flow

```
Sage output → [FILE_UPDATE ... updated_rating="2"]
  → parser extracts as attributes.updated_rating
    → file-write-handler passes to writeDomain() as frontmatter override
      → domain .md frontmatter includes rating: 2
      → file_index table includes rating in frontmatter JSON
      → pulse_check_ratings gets new row (is_baseline=false) for trend tracking
    → chat-view updates pulseRatings state for live UI update
```

### 2a. Prompt instruction — `lib/ai/prompts.ts`

Add to the "Domain card attributes" section (line ~152):

```
- updated_rating: Your honest 1-5 rating based on what the user ACTUALLY revealed, not just initial self-report. Same scale as pulse check: 1=Rough, 2=Struggling, 3=Okay, 4=Good, 5=Thriving. If the user revised their own assessment, use the revised number. Always include this.
```

Update the example tag:
```
[FILE_UPDATE type="domain" name="Career / Work" preview_line="..." status="needs_attention" updated_rating="2"]
```

### 2b. File write handler — `lib/markdown/file-write-handler.ts`

In the `FILE_TYPES.DOMAIN` case (line ~108), pass `updated_rating` from attributes to the domain frontmatter:

```typescript
case FILE_TYPES.DOMAIN: {
  const filename = DOMAIN_FILE_MAP[update.name as DomainName]
  if (filename) {
    const ratingStr = update.attributes?.updated_rating
    const updatedRating = ratingStr ? Number(ratingStr) : undefined
    const validRating = updatedRating && updatedRating >= 1 && updatedRating <= 5
      ? updatedRating : undefined

    await ufs.writeDomain(filename, update.content, {
      domain: filename,
      updated_by: 'sage',
      ...(update.status ? { status: update.status } : {}),
      ...(update.previewLine ? { preview_line: update.previewLine } : {}),
      ...(validRating ? { rating: validRating } : {}),
    })
  }
  break
}
```

### 2c. Domain frontmatter schema — `types/markdown-files.ts`

Add `rating` to `DomainFileFrontmatterSchema`:

```typescript
export const DomainFileFrontmatterSchema = z.object({
  // ... existing fields ...
  rating: z.number().min(1).max(5).optional(),   // ← NEW: post-conversation rating (1-5)
})
```

### 2d. Frontmatter generator — `lib/markdown/frontmatter.ts`

In `generateDomainFrontmatter()`, include `rating` in the merge:

```typescript
rating: overrides?.rating ?? existing?.rating,
```

### 2e. Persist to pulse_check_ratings — `app/api/chat/route.ts`

After file updates are processed, if any domain FILE_UPDATE has `updated_rating`, insert a new pulse_check_ratings row for trend tracking:

```typescript
// After handleAllFileUpdates() call
for (const update of fileUpdates) {
  const ratingStr = update.attributes?.updated_rating
  if (update.fileType === 'domain' && ratingStr && update.name) {
    const rating = Number(ratingStr)
    if (rating >= 1 && rating <= 5) {
      const ratingLabel = ['in_crisis', 'struggling', 'okay', 'good', 'thriving'][rating - 1]
      await supabase.from('pulse_check_ratings').insert({
        session_id: sessionId,
        user_id: userId,
        domain_name: update.name,
        rating: ratingLabel,
        rating_numeric: rating,
        is_baseline: false,
      })
    }
  }
}
```

### 2f. Live UI update — `components/chat/chat-view.tsx`

When a `file_update` block with `type="domain"` is received, check for `updated_rating` in the attributes and update the `pulseRatings` state:

```typescript
// In the message handler where file_update blocks are processed
if (block.data.fileType === 'domain' && block.data.attributes?.updated_rating && block.data.name) {
  const newRating = Number(block.data.attributes.updated_rating)
  if (newRating >= 1 && newRating <= 5) {
    setPulseRatings(prev => {
      const next = new Map(prev)
      next.set(block.data.name!, newRating)
      return next
    })
  }
}
```

This causes the shelf spider chart and domain grid to re-render with the updated rating immediately.

### Acceptance Criteria

- [x] Domain cards include `updated_rating` attribute (1-5 scale)
- [x] All rating displays use 1-5 scale consistently (shelf, spider chart, Life Map view)
- [x] No `/10` ratings anywhere in the UI
- [x] Rating in shelf updates live after domain card is generated
- [x] Spider chart reflects updated ratings
- [x] Updated rating persisted to `pulse_check_ratings` for trend tracking
- [x] `updated_rating` validated (1-5, integer) before persistence — invalid values ignored

---

## Phase 3: Domain Name Consistency (Patch 3)

**Problem:** Spider chart shows "Purpose" (`RADAR_ABBREVIATED_LABELS[7]`), domain grid shows "Meaning" (`abbreviateName("Meaning / Purpose")` splits on `/` and takes first word). Same domain, two labels.

**Approach:** Create a single source of truth for abbreviated domain names. Use it in both the spider chart and DomainSlotCompact.

### 3a. Add `DOMAIN_SHORT_NAMES` map — `lib/constants.ts`

```typescript
/** Canonical short names for all domains. Use everywhere abbreviated names are needed. */
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

Remove `RADAR_ABBREVIATED_LABELS` (the index-based array) and replace all usages with `DOMAIN_SHORT_NAMES`.

### 3b. Update spider chart call sites

All 4 call sites pass `labels={RADAR_ABBREVIATED_LABELS}`:
- `components/chat/life-map-pill-shelf.tsx:91`
- `components/chat/life-map-sidebar.tsx:266`
- `app/(main)/life-map/page.tsx:221`
- `components/onboarding/summary-screen.tsx:102`

Change to:
```typescript
labels={ALL_DOMAINS.map(d => DOMAIN_SHORT_NAMES[d])}
```

### 3c. Update DomainSlotCompact — `components/chat/domain-slot-compact.tsx`

Replace `abbreviateName()` with `DOMAIN_SHORT_NAMES` lookup:

```typescript
import { DOMAIN_SHORT_NAMES } from '@/lib/constants'
import type { DomainName } from '@/types/chat'

// Replace abbreviateName(name) usage with:
const displayName = DOMAIN_SHORT_NAMES[name as DomainName] ?? name
```

Remove the `abbreviateName` function.

### Acceptance Criteria

- [x] Spider chart label and domain grid label match for every domain
- [x] "Meaning / Purpose" displays as "Purpose" in both locations
- [x] No other domain has a mismatch between chart and grid
- [x] `RADAR_ABBREVIATED_LABELS` removed — single source of truth in `DOMAIN_SHORT_NAMES`

---

## Phase 4: Pulse Check Label Contrast (Patch 5)

**Problem:** "Rough" and "Thriving" endpoint labels use `text-text` class — hard to read on cream background at 10px.

**Fix:** Use semantic status colors to match the rating scale's color language.

### Changes to `components/onboarding/rating-scale.tsx`

Lines 54-59 — change from:
```tsx
<span className="text-[10px] uppercase tracking-[0.08em] text-text font-semibold">
  Rough
</span>
...
<span className="text-[10px] uppercase tracking-[0.08em] text-text font-semibold">
  Thriving
</span>
```

To:
```tsx
<span className="text-[11px] uppercase tracking-[0.08em] text-status-crisis font-semibold">
  Rough
</span>
...
<span className="text-[11px] uppercase tracking-[0.08em] text-accent-sage font-semibold">
  Thriving
</span>
```

Changes: `text-[10px]` → `text-[11px]` for readability, `text-text` → semantic colors that match the rating circles.

### Acceptance Criteria

- [x] "Rough" and "Thriving" labels clearly readable on cream background
- [x] Labels use status colors matching the rating circle colors
- [x] Labels don't overpower the rating circles (visual hierarchy maintained)

---

## Edge Cases & Risks

### Patches 1+4 interaction
Patches 1 (arc signaling) and 4 (depth signals) are complementary, not conflicting. Patch 4 governs when to wrap a single domain. Patch 1 governs the session-level arc across domains. Combined: depth signals trigger domain card → arc signaling tells user where they are in the session.

### Patch 2 — updated_rating edge cases
- **Sage doesn't output updated_rating:** Valid — attribute is optional. Existing rating remains.
- **Sage outputs rating outside 1-5:** Validation rejects it. Use `Number()` + bounds check.
- **Sage outputs same rating as pulse check:** Fine — stored anyway for consistency.
- **Multiple domain cards for same domain in one session:** Each writes to same file (upsert). Last rating wins. pulse_check_ratings gets multiple rows — getDomainTrends() takes most recent, which is correct.

### Patch 3 — backwards compatibility
`RADAR_ABBREVIATED_LABELS` is used in 4 files. All 4 can be migrated at once. No external consumers.

## References

- Feedback doc: `Docs/feedback/20260219_R4c_polish_onboarding.md`
- R3 pacing brainstorm: `Docs/brainstorms/2026-02-17-r3-playtest-fixes-brainstorm.md`
- Security patterns: `Docs/solutions/security-issues/markdown-storage-security-review-fixes.md` (validate AI-sourced attributes)
- Code review patterns: `Docs/solutions/code-review-fixes/20260218-daily-rhythm-m3-review-findings.md` (AI output validation checklist)
