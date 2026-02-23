---
status: complete
priority: p2
issue_id: "094"
tags: [code-review, ux-consistency, vocabulary-mapping]
dependencies: []
---

# Morning Snapshot Card Shows Old Mood Vocabulary

## Problem Statement

The PR renamed energy labels to mood labels across the conversation flow (Energized, Good, Neutral, Low, Rough), but `morning-snapshot-card.tsx` was not updated. A user who selects "Energized" in the morning conversation will see "Fired up" on the day plan page. Same enum value (`fired_up`), different display strings depending on the screen.

## Findings

- **Source**: architecture-strategist agent
- **Location**: `components/day-plan/morning-snapshot-card.tsx` lines 6-12
- **Evidence**:
  ```typescript
  // morning-snapshot-card.tsx (OLD, not updated):
  fired_up: { emoji: '...', label: 'Fired up' },
  focused:  { emoji: '...', label: 'Focused' },
  // energy-check-card.tsx (NEW):
  'energized': '...',  // maps to fired_up
  'good': '...',       // maps to focused
  ```
- **Also inconsistent**: Emojis differ between the three surfaces (fire vs fire, smiling vs lightning, pensive vs sleeping, weary vs angry)

## Proposed Solutions

### Option A: Update morning-snapshot-card.tsx labels (Recommended)
Update `ENERGY_LABELS` in `morning-snapshot-card.tsx` to match the new vocabulary and harmonize emojis.

- **Effort**: Small
- **Risk**: None

### Option B: Extract shared MOOD_CONFIG constant
Create `lib/constants/mood.ts` with a single source of truth for all mood display data. All 3 components import from there.

- **Effort**: Medium
- **Risk**: Low

## Acceptance Criteria

- [ ] "Energized", "Good", "Neutral", "Low", "Rough" displayed consistently across all surfaces
- [ ] Emojis consistent between energy-check-card and morning-snapshot-card

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-23 | Found during open-day-flow-redesign code review | 3 separate label maps across codebase, 1 was missed in rename |
