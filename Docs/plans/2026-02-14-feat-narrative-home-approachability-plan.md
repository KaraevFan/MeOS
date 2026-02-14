---
title: "Narrative Home & Life Plan: Making Strategic Life Planning Approachable"
type: feat
date: 2026-02-14
status: plan
supersedes: Docs/plans/2026-02-14-narrative-home-approachability-design.md
---

# Narrative Home & Life Plan: Making Strategic Life Planning Approachable

## Overview

Rewrite the home screen, life map tab, and check-in conversation UI to use coaching-adjacent vocabulary and a narrative layout that tells the user's story back to them. The data layer is already built — all life data lives as markdown files in Supabase Storage. This plan focuses exclusively on the presentation layer changes needed to surface that data with warmth, clarity, and approachability.

**The core shift:** From "display framework outputs" to "tell the user's story back to them."

**Key principle:** Tasks are generated, not authored. The user never types a to-do. They talk about what matters, Sage proposes actions, and the life plan stays clean and strategic.

**What changed since the original design doc:** The data model migrated from relational tables to markdown files. There are no `compoundingEngine` or `antiGoals` database columns anymore. All data is extracted from markdown sections in `life-map/_overview.md` and `life-plan/current.md` using `extractMarkdownSection()` and `extractBulletList()` helpers. The vocabulary layer, section headings in prompts, and the file extraction logic are already aligned.

---

## Problem Statement

The current home screen uses founder-framework language ("compounding engine", "anti-goals") that's unapproachable for general users. The life plan data exists in `life-plan/current.md` but isn't surfaced on the home screen. The home screen shows a simple card layout that doesn't feel like a narrative — it feels like a dashboard.

**Current state:**
- Home screen shows: greeting, sage line, "Your compounding engine" card (just bold text, no "because" clause), check-in card, "Current priorities" list, breathing orb CTA
- Life Map tab shows domains + synthesis section with legacy labels ("Primary compounding engine", "Quarterly priorities", "Anti-goals")
- Active commitments from `life-plan/current.md` are not shown anywhere in the UI
- No pinned context card in check-in conversations

---

## Proposed Solution

### 1. Vocabulary Layer

All user-facing labels use coaching vocabulary. The markdown section headings already use coaching vocabulary (set by Sage prompts in `lib/ai/prompts.ts`).

| Markdown Section Heading | Current UI Label | New UI Label | Subtitle |
|---|---|---|---|
| `## Your North Star` (in `_overview.md`) | "Your compounding engine" | **Your north star** | *The area where focused effort moves everything else forward.* |
| `## Boundaries` (in `_overview.md`) | "Anti-goals" | **Boundaries** | *What you're choosing not to pursue right now.* |
| `## Active Commitments` (in `current.md`) | *(not shown)* | **Active commitments** | *The 1-2 things you're actually doing about it this quarter.* |
| `#### Next Steps` (in `current.md`) | *(not shown)* | **Next steps** | *What's coming up for each commitment.* |
| `## This Quarter's Focus` (in `_overview.md`) | "Current priorities" | **This quarter's focus** | *Your top priorities for the next few months.* |
| `## Tensions to Watch` (in `_overview.md`) | "Key tensions" | **Tensions to watch** | *Where competing priorities pull against each other.* |
| `## Quarter Theme` (in `current.md`) | *(not shown)* | **Quarter theme** | *A phrase that captures what this season is about.* |
| `## Things to Protect` (in `current.md`) | *(not shown)* | **Things to protect** | *Systems that are working — don't drop these.* |

### 2. Home Screen Layout (Narrative Home)

Top-to-bottom, scannable in 3 seconds:

1. **Greeting** — "Good morning, [name]"
2. **Sage's contextual line** — template-based one-liner interpolating commitment names from `life-plan/current.md`
3. **North star card** — warm gradient card showing full "because" clause from `_overview.md`'s "## Your North Star" section (not just the bold text — the full paragraph)
4. **Active commitments** — 1-2 items from `life-plan/current.md`'s "## Active Commitments" section with inline next steps. Falls back to "This quarter's focus" (priorities from `_overview.md`) if no life plan exists yet.
5. **Check-in prompt** — next check-in date + action button
6. **Boundaries** — subtle, muted section. Only shown when data exists in `_overview.md`'s "## Boundaries" section. No empty placeholder.
7. **Talk to Sage** — breathing orb CTA at bottom

### 3. Life Map Tab — "Where I Am" / "What I'm Doing"

Add a segmented control at the top of the life map page:

- **"Where I Am"** = existing domain cards (identity/reflection layer). Already implemented.
- **"What I'm Doing"** = life plan view, reading from `life-plan/current.md`:
  1. Quarter theme — banner/header
  2. Active commitments — expandable cards (description, "why it matters", next steps, qualitative progress)
  3. Things to protect — lighter-weight list
  4. Boundaries — muted, at bottom

### 4. Pinned Context Card in Check-in Conversations

When a `weekly_checkin` session starts, show a pinned compact card above the chat messages displaying current commitments and their next steps from `life-plan/current.md`. Collapsible. Both user and Sage look at the same data.

---

## Technical Approach

### Data Flow (Markdown → UI)

All reads go through `UserFileSystem` → `extractMarkdownSection()` / `extractBulletList()`.

**New extractions needed for home screen:**

```typescript
// From life-map/_overview.md (existing extractions, need label updates)
extractMarkdownSection(overview.content, 'Your North Star')     // Full paragraph with "because" clause
extractBulletList(overview.content, "This Quarter's Focus")     // Fallback priorities
extractBulletList(overview.content, 'Boundaries')               // Boundaries list

// From life-plan/current.md (NEW reads for home page)
extractMarkdownSection(lifePlan.content, 'Quarter Theme')       // Single paragraph
extractMarkdownSection(lifePlan.content, 'Active Commitments')  // Structured section
extractBulletList(lifePlan.content, 'Things to Protect')        // Simple list
extractBulletList(lifePlan.content, 'Boundaries')               // May duplicate overview
```

**Commitment parsing (new helper needed):**

The "Active Commitments" section in `life-plan/current.md` has a specific markdown structure that Sage produces:

```markdown
## Active Commitments

### Have the conversation with my manager about the role change
**Why it matters:** This directly addresses the career plateau.
**Status:** not_started

#### Next Steps
- [ ] Draft talking points *(upcoming)*
- [ ] Schedule the 1:1 *(upcoming)*

### Validate MeOS with 10 real users
**Why it matters:** Tests whether entrepreneurship is a viable path.
**Status:** in_progress

#### Next Steps
- [x] Complete first prototype session *(done)*
- [ ] Recruit 9 more testers *(active)*
```

A new `extractCommitments()` helper is needed in `lib/markdown/extract.ts`:

```typescript
interface Commitment {
  label: string
  whyItMatters: string | null
  status: 'not_started' | 'in_progress' | 'complete'
  nextSteps: { label: string; status: 'upcoming' | 'active' | 'done' }[]
}

function extractCommitments(content: string): Commitment[]
```

This parses `### Heading` as commitment labels, `**Why it matters:**` / `**Status:**` as metadata, and `- [ ]` / `- [x]` checkbox items under `#### Next Steps` as steps. Status mapping: unchecked + `*(upcoming)*` = upcoming, unchecked + `*(active)*` = active, checked + `*(done)*` = done.

**Important:** The existing `extractMarkdownSection()` only matches h1-h3 headings (regex `#{1,3}`). It cannot extract h4 sections like `#### Next Steps` independently. The `extractCommitments()` helper must handle the full h2→h3→h4 hierarchy internally rather than delegating to `extractMarkdownSection()`. It should:
1. Extract the full `## Active Commitments` section content
2. Split on `### ` to find individual commitments
3. Within each commitment block, parse `**Why it matters:**` and `**Status:**` as key-value pairs
4. Split on `#### Next Steps` to find the next steps sub-section
5. Parse `- [ ]` / `- [x]` checkbox items with status annotations

**Status display mapping:**

| Sage's Markdown Value | UI Display Label | Color |
|---|---|---|
| `not_started` | Getting started | `text-text-secondary` |
| `in_progress` | Making progress | `text-primary` |
| `complete` | Done | `text-accent-sage` |

**Commitment heading stability:** Add a prompt guardrail in `lib/ai/prompts.ts` (Phase 5): "When updating the life plan, preserve exact commitment heading text unless the user explicitly renames or replaces a commitment." This prevents losing continuity across weekly check-in updates.

### Implementation Phases

#### Phase 1: Vocabulary Rename + Home Screen Data (Foundation)

**Goal:** Update all user-facing labels and expand the `HomeData` interface to include life plan data.

**Files to change:**

| File | Change |
|------|--------|
| `components/ui/compounding-engine-card.tsx` | Rename to `north-star-card.tsx`. Update label to "Your north star". Show full north star paragraph with "because" clause, not just bold text. Add coaching subtitle. |
| `components/life-map/synthesis-section.tsx` | Rename labels: "Primary compounding engine" → "Your north star", "Quarterly priorities" → "This quarter's focus", "Anti-goals" → "Boundaries", "Key tensions" → "Tensions to watch" |
| `lib/supabase/home-data.ts` | Read `life-plan/current.md` via `ufs.readLifePlan()`. Add to `HomeData`: `northStarFull` (full paragraph), `commitments`, `boundaries`, `quarterTheme`. Rename `compoundingEngine` to `northStar` (bold text only, for sage line interpolation). |
| `lib/markdown/extract.ts` | Add `extractCommitments()` helper to parse structured commitment sections from life plan markdown. |
| `app/(main)/home/page.tsx` | Use new field names. Show north star card with full paragraph. |

**Acceptance criteria:**
- [x] No user-facing string says "compounding engine", "anti-goals", or uses other framework jargon
- [x] North star card shows full "because" clause, not just the bold text
- [x] `HomeData` includes commitments parsed from `life-plan/current.md`
- [x] `extractCommitments()` correctly parses the Sage-produced markdown structure
- [x] All coaching subtitles visible on cards
- [x] Context injection labels in `getWeeklyCheckinPrompt()` use coaching vocabulary (e.g., "North Star:" not "Primary Compounding Engine:")

#### Phase 2: Home Screen Narrative Layout

**Goal:** Restructure the home screen into the narrative layout with commitment display.

**Files to change:**

| File | Change |
|------|--------|
| `app/(main)/home/page.tsx` | Restructure layout: greeting → sage line → north star card → active commitments (or priorities fallback) → check-in → boundaries → talk to sage |
| `components/home/commitment-card.tsx` | **New file.** Compact card showing commitment label, status indicator, and top 1-2 next steps inline. |
| `lib/supabase/home-data.ts` | Expand `getSageLine()` to interpolate commitment names (e.g., `Day ${days} of "${topCommitment.label}." ${commitmentPrompt}`) |

**Sage line templates (expanded):**

```typescript
const sageLines = {
  day1: "You mapped your life yesterday. Today's the first day of doing something about it.",
  day2_7_withCommitment: (days: number, commitment: string) =>
    `Day ${days} of "${commitment}." How's momentum?`,
  day2_7_generic: (days: number) =>
    `Day ${days} since we mapped things out. What's landing?`,
  week2: "Two weeks in. Are things tracking, or has reality intervened?",
  withNorthStar: (northStar: string) =>
    `Your north star: ${northStar}. One thing today?`,
  checkinSoon: "Check-in's tomorrow. Take a minute to notice how the week felt.",
  postCheckin: "Good check-in. Here's what's carrying forward.",
}
```

**Acceptance criteria:**
- [x] Home screen reads as a narrative top-to-bottom
- [x] Active commitments shown with inline next steps when life plan exists
- [x] Falls back to "This quarter's focus" priorities when no commitments
- [x] Boundaries section only appears when data exists
- [x] Sage line references specific commitment names when available
- [x] North star card visually prominent (warm gradient, larger than other cards)

#### Phase 3: Life Map Tab Segmented Control

**Goal:** Split the life map page into "Where I Am" (domains) and "What I'm Doing" (life plan).

**Files to change:**

| File | Change |
|------|--------|
| `app/(main)/life-map/page.tsx` | Read both overview/domains AND life plan data server-side in parallel. Pass both datasets to a client component wrapper that manages tab state via `useState`. No lazy loading — both tabs' data is small enough to load eagerly. |
| `components/life-map/segmented-control.tsx` | **New file.** "Where I Am" / "What I'm Doing" toggle. Warm styling consistent with design system. |
| `components/life-map/life-plan-view.tsx` | **New file.** Full life plan display: quarter theme banner, commitment cards (expandable with "why it matters", next steps, qualitative progress), things to protect, boundaries. |

**Acceptance criteria:**
- [x] Segmented control toggles between domain view and life plan view
- [x] "Where I Am" shows existing domain grid + synthesis section
- [x] "What I'm Doing" shows full life plan from `life-plan/current.md`
- [x] Commitment cards are expandable with details
- [x] Progress indicators are qualitative ("getting started", "making progress", "nearly there"), not percentage-based
- [x] Default tab is "Where I Am" (domains)

#### Phase 4: Pinned Context Card in Check-in Conversations

**Goal:** Show current commitments at the top of weekly check-in conversations.

**Files to change:**

| File | Change |
|------|--------|
| `app/(main)/chat/page.tsx` | For `weekly_checkin` sessions, read `life-plan/current.md` and pass commitments to the chat view. |
| `components/chat/pinned-context-card.tsx` | **New file.** Compact, collapsible card showing commitment names + current next step for each. Sticky at top of chat area. |

**Acceptance criteria:**
- [x] Pinned card appears at top of weekly check-in conversations
- [x] Shows commitment labels and current (active) next step for each
- [x] Collapsible with tap to minimize
- [x] Only appears for `weekly_checkin` session type
- [x] Does not appear for `life_mapping` sessions

#### Phase 5: North Star "Because" Clause + Sage Prompt Updates

**Goal:** Ensure Sage consistently produces north star with causal chain and life plan with structured commitments.

**Files to change:**

| File | Change |
|------|--------|
| `lib/ai/prompts.ts` | Reinforce the "because" clause requirement in life mapping prompt. Already exists but add emphasis: "The north star MUST include a because clause." Also ensure commitment markdown structure matches what `extractCommitments()` expects. |

**Acceptance criteria:**
- [x] Sage produces north star with "because" clause in every synthesis
- [x] Life plan commitments include `**Why it matters:**`, `**Status:**`, and `#### Next Steps` sections
- [x] Commitment status uses exactly: `not_started`, `in_progress`, `complete`
- [x] Prompt includes guardrail: "preserve exact commitment heading text unless the user explicitly renames"

---

## Boundaries Source Precedence

Both `_overview.md` and `life-plan/current.md` can contain a `## Boundaries` section. They serve different purposes:

- **Overview boundaries** are identity-level ("Not becoming a productivity influencer") — these appear on the **home screen** boundaries section.
- **Life plan boundaries** are action-level ("Not taking on freelance work") — these appear on the **"What I'm Doing" tab** in the life map.

Do not merge or deduplicate. Each surface shows its own source.

---

## Pinned Context Card Data Flow

The pinned card in check-in conversations follows a server-to-client data flow:

1. **Initial load:** The chat page (`app/(main)/chat/page.tsx`, server component) reads `life-plan/current.md` via `ufs.readLifePlan()` and extracts commitments using `extractCommitments()`. Passes as a prop to `ChatView`.
2. **During conversation:** When Sage produces a `[FILE_UPDATE type="life-plan"]` block that gets processed by the file write handler, the client parses the block content directly (without re-fetching from storage) and updates the pinned card state.
3. **Collapse state:** Ephemeral — resets to expanded on page reload. No persistence needed for MVP.

This avoids client-side Supabase Storage reads, which `UserFileSystem` is not designed for (server components only).

---

## Empty State Handling

| Scenario | What Shows |
|----------|-----------|
| No overview file (new user, no mapping yet) | Pre-onboarding hero with breathing orb (existing behavior) |
| Overview exists but no life plan | North star card + "This quarter's focus" priorities (fallback). No commitments section. |
| Life plan exists but no commitments section | Quarter theme shown if available. Commitments section hidden. |
| Overview has no "Boundaries" section | Boundaries section hidden entirely. No empty placeholder. |
| Commitments exist but all are `complete` | Show completed state with suggestion to talk to Sage about next quarter. |
| Life plan exists but it's for a different quarter | Show it anyway — Sage handles quarterly resets through conversation. |
| **"What I'm Doing" tab with no life plan** | Warm nudge: "Your life plan will take shape after you set commitments with Sage." Link to start a conversation. Consistent with design philosophy: no lonely empty states. |
| **North star section empty or missing** | North star card hidden. Home screen starts with commitments/priorities instead. The narrative still flows — just shorter. |

---

## Markdown Section Extraction Reliability

**Risk:** `extractMarkdownSection()` matches headings by exact text. If Sage produces "## North Star" instead of "## Your North Star", extraction fails silently (returns `null`).

**Mitigation:**
1. The prompts in `lib/ai/prompts.ts` include exact example output with correct heading text
2. The `[FILE_UPDATE]` block mechanism ensures Sage writes full file replacements (not partial edits)
3. Fallback gracefully — missing sections result in hidden UI sections, not errors
4. The `extractCommitments()` parser should be lenient with markdown variations (e.g., accept both `**Status:**` and `**Status**:`)

---

## Files Changed Summary

| File | Phase | Change |
|------|-------|--------|
| `components/ui/compounding-engine-card.tsx` | 1 | Rename to `north-star-card.tsx`, update label + show full paragraph |
| `components/life-map/synthesis-section.tsx` | 1 | Rename all labels to coaching vocabulary |
| `lib/ai/prompts.ts` | 1, 5 | Rename context injection labels in `getWeeklyCheckinPrompt()` (e.g., `Primary Compounding Engine:` → `North Star:`); add commitment heading stability guardrail |
| `lib/supabase/home-data.ts` | 1, 2 | Read life plan, expand interface, parse commitments, update sage lines |
| `lib/markdown/extract.ts` | 1 | Add `extractCommitments()` helper |
| `app/(main)/home/page.tsx` | 1, 2 | New layout, new components, vocabulary |
| `components/home/commitment-card.tsx` | 2 | **New** — compact commitment display for home screen |
| `components/life-map/segmented-control.tsx` | 3 | **New** — "Where I Am" / "What I'm Doing" toggle |
| `components/life-map/life-plan-view.tsx` | 3 | **New** — full life plan display |
| `app/(main)/life-map/page.tsx` | 3 | Add segmented control, conditional rendering |
| `components/chat/pinned-context-card.tsx` | 4 | **New** — pinned commitments in check-in chat |
| `app/(main)/chat/page.tsx` | 4 | Pass commitments to chat view for weekly check-ins |
| `lib/ai/prompts.ts` | 5 | Reinforce "because" clause and structured commitment format |

---

## Anti-Patterns to Avoid

- **Don't show empty framework sections.** If boundaries data doesn't exist, don't show the boundaries section. No empty placeholders.
- **Don't let next steps become a to-do list.** Keep altitude directional ("prepare talking points"), not granular ("open Google Docs, create new document, write bullet 1...").
- **Don't use framework jargon in the UI.** "Compounding engine," "anchor projects," "cut criteria" — these stay in internal docs only.
- **Don't read full file content for existence checks.** Use `fileExists()` or check for `null` returns.
- **Don't add new database tables.** All data for this feature lives in markdown files already.
- **Don't break the extraction contract.** If you change markdown section headings in prompts, update the extraction code to match.

---

## Out of Scope (Next Sprint)

Items 8-10 from the original design doc remain deferred:
- Daily workflow MVP (morning focus + end-of-day capture)
- Execution layer data model (tactical Task interface beneath NextStep)
- Agent decomposition flow (Sage proposes task breakdown, user approves)
- Live-updating pinned card during conversation (static read at session start is sufficient for MVP)

---

## References

- Original design doc: `Docs/plans/2026-02-14-narrative-home-approachability-design.md`
- Markdown architecture plan: `Docs/plans/2026-02-14-feat-markdown-data-architecture-plan.md`
- Security hardening: `docs/solutions/security-issues/markdown-storage-security-review-fixes.md`
- Design system: `.claude/skills/meos-design/SKILL.md`
- Current home data service: `lib/supabase/home-data.ts`
- Markdown extraction helpers: `lib/markdown/extract.ts`
- User file system: `lib/markdown/user-file-system.ts`
- Sage prompts: `lib/ai/prompts.ts`
