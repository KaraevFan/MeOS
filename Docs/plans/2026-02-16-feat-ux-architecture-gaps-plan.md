---
title: "feat: UX Architecture Gaps — Domain Editing, Session Headers, Trends, History Actions"
type: feat
date: 2026-02-16
brainstorm: docs/brainstorms/2026-02-16-ux-architecture-gaps-brainstorm.md
source: Docs/feedback/20260216_MeOS_UX_Architecture.md (Gaps 5-7, 9)
---

# UX Architecture Gaps — Domain Editing, Session Headers, Trends, History Actions

## Overview

Ship the four remaining "Important" tier gaps from the Feb 16 UX Architecture audit:

1. **Domain editing UX** — "Talk to Sage about this" on explored domain cards
2. **Session type indication** — compact header in active chat
3. **Change-over-time trends** — trend arrows on domain cards from weekly re-ratings
4. **History view actions** — "Talk to Sage about this" on past sessions

## Architecture Prerequisite: Ad-Hoc Write Permission Override

**This must be resolved before Features 1 and 4.**

The current `SESSION_WRITE_PERMISSIONS.ad_hoc` only allows `sage/*` writes, and the ad-hoc prompt says "Do NOT emit domain updates." This means domain file updates are impossible from ad-hoc sessions — blocking the core purpose of "Talk to Sage about this."

### Approach: Contextual permission flag

Rather than creating a new session type or loosening all ad-hoc permissions, add an `explore` flag that widens permissions when the session is domain-focused:

**`lib/markdown/constants.ts`:**
- Add a new export: `AD_HOC_EXPLORE_WRITE_PERMISSIONS` that includes `life-map/*`, `life-plan/current.md`, and `sage/*`
- The file-write handler checks whether the session has an `explore` domain and uses the expanded permission set

**`lib/ai/prompts.ts` — `getAdHocPrompt()`:**
- Accept an optional `exploreDomain?: string` parameter
- When present, replace the "Do NOT emit domain updates" instruction with: "The user wants to revisit their {domain} domain. You MAY emit `[FILE_UPDATE type="domain" name="{domain}"]` blocks for this domain. Do not update other domains."

**`app/(main)/chat/page.tsx`:**
- When `?explore=` is present alongside `?type=ad_hoc` (or by itself), pass `exploreDomain` through to prompt construction
- Store `explore` domain in session metadata for permission checking

**`lib/ai/context.ts` — `buildConversationContext()`:**
- When `exploreDomain` is set, always inject that domain's markdown file regardless of status (currently only `needs_attention`/`in_crisis` domains are injected)

### Files to modify

| File | Change |
|------|--------|
| `lib/markdown/constants.ts` | Add `AD_HOC_EXPLORE_WRITE_PERMISSIONS` |
| `lib/markdown/file-write-handler.ts` | Check session metadata for explore flag when resolving permissions |
| `lib/ai/prompts.ts` | `getAdHocPrompt()` accepts `exploreDomain`, conditionally allows domain writes |
| `lib/ai/context.ts` | Inject explore domain file regardless of status |
| `app/(main)/chat/page.tsx` | Pass explore domain to prompt builder and session metadata |

---

## Feature 1: Domain Editing UX

**Gap 5 from audit.** Add a "Talk to Sage about this" CTA on explored domain cards in the Life Map.

### What to build

A small text CTA inside the expanded view of `DomainDetailCard`. Tapping it navigates to `/chat?type=ad_hoc&explore={domainName}`. The ad-hoc session opens with that domain's full context injected and write permissions for that domain enabled (via the prerequisite above).

### Implementation

**`components/life-map/domain-detail-card.tsx`:**

HTML validity fix: The component is currently a `<button>` element (line 87). A `<Link>` inside a `<button>` is invalid HTML. Fix:
- Change the outer element to `<div role="button" tabIndex={0}` with `onClick` and `onKeyDown` (Enter/Space) for expand/collapse
- Add the CTA as a regular `<Link>` inside the expanded section
- CTA goes after the "Last updated" footer (line 213-219), inside the expanded content
- Use `e.stopPropagation()` on the CTA to prevent toggling collapse
- CTA text: "Talk to Sage about this"
- Style: `text-xs font-medium text-primary hover:text-primary-hover transition-colors` (matches "Explore with Sage" pattern)
- Only show when card is expanded (`isExpanded && isExplored`)

**`app/(main)/chat/page.tsx`:**
- Already reads `params.explore`. When `explore` is present and no `type` param, default to `ad_hoc` (currently falls through to `detectSessionState`)
- Pass `exploreDomain` to `getAdHocPrompt()` call

**`components/chat/chat-view.tsx`:**
- The existing `exploreDomain` auto-send logic (lines 436-446) already sends "Let's explore {domain}". For revisits, change the message to: "I'd like to revisit my {domain} domain" (detectable via session metadata or a `revisit` flag)

### Acceptance criteria

- [x] Explored domain cards show "Talk to Sage about this" CTA when expanded
- [x] CTA navigates to `/chat?type=ad_hoc&explore={domain}`
- [x] Sage opens with that domain's full content in context
- [x] Sage can emit `[FILE_UPDATE type="domain"]` for the explored domain
- [x] HTML is valid (no nested interactive elements)
- [x] CTA does not trigger card expand/collapse

---

## Feature 2: Session Type Header in Chat

**Gap 6 from audit.** Show users what kind of conversation they're in and set time expectations.

### What to build

A compact, non-sticky header line at the top of the chat view. Shows session type label + approximate duration estimate. Scrolls with messages (not sticky — preserves mobile viewport space).

### Labels and durations

| Session Type | Label | Duration |
|---|---|---|
| `life_mapping` | "Life Mapping" | "~ 25 min" |
| `weekly_checkin` | "Weekly Check-In" | "~ 10 min" |
| `ad_hoc` | "Open Conversation" | — (no estimate) |
| `ad_hoc` + `?explore=` | "Exploring {domain}" | — |
| `ad_hoc` + `?nudge=` | "Reflection" | — |

Ad-hoc sessions are open-ended — no duration estimate shown. Duration is static (not elapsed time) to avoid clock-watching anxiety.

### Implementation

**New component: `components/chat/session-header.tsx`**

```tsx
// Props: sessionType, exploreDomain?, nudgeContext?
// Renders: single line with type icon + label + optional duration
// Style: text-[11px] text-text-secondary, centered, py-3
// Matches the meta text pattern used throughout the app
```

- Small dot or icon before the label (same warm palette)
- Duration in lighter weight: `text-[11px] text-text-secondary/60`
- Total height: ~32px including padding

**`components/chat/chat-view.tsx`:**
- Render `<SessionHeader>` as the first element inside the messages scroll container (`<div ref={scrollRef}>`, before the first message)
- Pass `sessionType`, `exploreDomain`, and `nudgeContext` as props
- This ensures it scrolls with messages and doesn't eat permanent viewport space

### Acceptance criteria

- [x] Chat view shows session type label at top
- [x] Duration estimate shown for structured sessions (life_mapping, weekly_checkin)
- [x] No duration shown for ad-hoc sessions
- [x] Contextual labels for explore and nudge sessions
- [x] Header scrolls with messages (not sticky)
- [x] Does not conflict with PinnedContextCard on check-ins

---

## Feature 3: Change-Over-Time Trends

**Gap 7 from audit.** Show trend arrows on domain cards based on pulse rating history from weekly re-ratings.

### What to build

Two parts: (A) a pulse re-rating step at the end of weekly check-ins, and (B) trend arrows on Life Map domain cards.

### Part A: Weekly pulse re-rating

**Prompt change — `lib/ai/prompts.ts`:**

Add to `getWeeklyCheckinBasePrompt()` closing sequence, between the verbal summary and `[FILE_UPDATE]` blocks:

```
Before generating FILE_UPDATE blocks, emit a [PULSE_CHECK] block to prompt the user
for a quick domain re-rating. Wait for their response before proceeding to file updates.
```

**Parser change — `lib/ai/parser.ts`:**
- Recognize `[PULSE_CHECK]` as a new block type
- When encountered during streaming, signal the UI to render the rating component

**Chat view — `components/chat/chat-view.tsx`:**
- When parser detects `[PULSE_CHECK]`, set a `showCheckinPulse` state flag
- Render an inline `PulseRatingCard` component (compact variant of the onboarding `PulseCheckCard`)
- Pre-populate with the user's most recent ratings as defaults
- Include a "Same as last time" quick action and a "Skip" button
- On submit: save ratings to `pulse_check_ratings` with `is_baseline = false`, then resume the check-in flow (trigger Sage to continue with FILE_UPDATEs)
- On skip: resume the check-in flow without saving ratings

**New component: `components/chat/pulse-rating-card.tsx`:**
- Compact inline card showing all 8 domains with 1-5 scale
- Pre-filled with previous ratings
- Only domains where the user changes the rating need interaction
- "Done" and "Skip" buttons
- Style: `bg-bg-sage rounded-lg border border-border p-4` (matches summary cards)

**`lib/supabase/pulse-check.ts`:**
- Add `getLatestRatingsPerDomain(supabase, userId)`: returns the most recent rating per domain across all sessions
- Used for pre-populating the re-rating card

### Part B: Trend arrows on domain cards

**`lib/supabase/pulse-check.ts`:**
- Add `getDomainTrends(supabase, userId)`: for each domain, fetch the two most recent ratings and compute direction
- Returns `Record<string, 'improving' | 'declining' | 'steady' | null>` (null = insufficient data)
- Query: group by `domain_name`, order by `created_at DESC`, take top 2 per domain
- Compare: if latest > previous → improving, latest < previous → declining, equal → steady

**`app/(main)/life-map/page.tsx`:**
- Call `getDomainTrends()` server-side
- Pass `trends` to `<LifeMapTabs>` → `<DomainGrid>` → `<DomainDetailCard>`

**`components/life-map/domain-detail-card.tsx`:**
- Accept new prop: `trend?: 'improving' | 'declining' | 'steady' | null`
- Render trend arrow next to status label (line 110):
  - Improving: small green `↑` + "improving" in `text-[11px] text-emerald-600`
  - Declining: small terracotta `↓` + "declining" in `text-[11px] text-terracotta`
  - Steady: small gray `→` + "steady" in `text-[11px] text-text-secondary`
  - Null: nothing shown
- Show on both collapsed and expanded views (arrow is compact enough at 12px)

### Acceptance criteria

- [x] Sage asks for domain re-rating near end of weekly check-ins
- [x] Compact pulse rating card renders inline in chat
- [x] Ratings saved to `pulse_check_ratings` with `is_baseline = false`
- [x] User can skip re-rating without friction
- [x] Pre-populated with most recent ratings
- [x] Life Map domain cards show trend arrows after 2+ rating sessions
- [x] No arrows shown when insufficient data (only baseline exists)
- [x] Trend compares latest vs. previous rating (week-over-week)

---

## Feature 4: History View Actions

**Gap 9 from audit.** Turn the history view from a dead-end archive into a conversation springboard.

### What to build

A "Talk to Sage about this" button on the session detail page. Opens a new ad-hoc conversation with the session's summary, themes, and metadata injected as context. Only shown when the session has an `ai_summary`.

### Implementation

**`app/(main)/history/[sessionId]/page.tsx`:**
- Add a CTA inside the summary footer card (after the summary text, lines 100-107)
- Link to `/chat?type=ad_hoc&session_context={sessionId}`
- Style: `w-full h-10 bg-primary text-white text-sm font-medium rounded-md` (matches app CTA pattern)
- Only render when `session.ai_summary` is truthy
- Add `ad_hoc: 'Conversation'` to `SESSION_TYPE_LABELS` map

**`app/(main)/chat/page.tsx`:**
- Read new `session_context` search param
- When present, fetch the referenced session server-side: `sessions` table → `ai_summary`, `key_themes`, `commitments_made`, `sentiment`, `domains_explored`, `session_type`, `created_at`
- Format as a context string and pass to `ChatView` as `sessionContext` prop

**`components/chat/chat-view.tsx`:**
- Accept new prop: `sessionContext?: string`
- In the ad-hoc `triggerSageResponse()` branch (lines 306-311), use `sessionContext` similarly to `nudgeContext`:

```
"The user is revisiting a past {sessionType} session from {date}.
Session summary: {summary}
Key themes: {themes}
Commitments discussed: {commitments}

Open by acknowledging this past session and asking what about it the user
wants to explore or revisit. Reference specific details from the summary."
```

**`components/history/session-card.tsx`:**
- Add `ad_hoc: 'Conversation'` to `SESSION_TYPE_LABELS` (line 5-10) so ad-hoc sessions display properly in the list

### Acceptance criteria

- [x] Session detail page shows "Talk to Sage about this" button inside summary card
- [x] Button hidden when `ai_summary` is null
- [x] Tapping navigates to new ad-hoc session with session context
- [x] Sage's opening message references the specific past session
- [x] Context includes summary + themes + commitments + date
- [x] Ad-hoc sessions show "Conversation" label in history list

---

## Implementation Order

Build in this sequence — each step unblocks the next:

| Phase | Feature | Effort | Dependencies |
|-------|---------|--------|--------------|
| 0 | Ad-hoc write permission override | Small | None — prerequisite |
| 1 | Session type header (Feature 2) | Small | None — pure UI |
| 2 | Domain editing CTA (Feature 1) | Small | Phase 0 |
| 3 | History actions (Feature 4) | Small | Phase 0 |
| 4 | Trend arrows — Part B display (Feature 3B) | Medium | None |
| 5 | Trend arrows — Part A re-rating (Feature 3A) | Medium | Phase 4 |

Phases 1-3 can be parallelized after Phase 0 is complete. Phase 4 (display) can start immediately with mock data while Phase 5 (data collection) is built.

---

## Technical Considerations

**HTML validity:** `DomainDetailCard` must be refactored from `<button>` to `<div role="button">` before adding the CTA link. This is a semantic fix, not a behavioral change.

**Session cleanup:** Multiple features create ad-hoc sessions. Add cleanup logic: when creating a new session, mark any previous `active` sessions of the same type as `abandoned`. This prevents session pile-up.

**Token budget:** History context injection adds ~200-400 tokens to the system prompt. This is within the existing token management budget (context injection already reads multiple markdown files).

**Security:** The explore permission override must validate the domain name against the `PULSE_DOMAINS` allowlist. Never allow arbitrary path writes from ad-hoc sessions. The `file-write-handler.ts` already validates paths — the override only widens the permitted set, not the validation logic.

**`[PULSE_CHECK]` parser block:** This is a new block type. It contains no body — it's purely a signal. The parser should handle it as a self-closing marker, similar to how `[SESSION_COMPLETE]` might work.

## References

- Brainstorm: `docs/brainstorms/2026-02-16-ux-architecture-gaps-brainstorm.md`
- Source audit: `Docs/feedback/20260216_MeOS_UX_Architecture.md`
- Domain card component: `components/life-map/domain-detail-card.tsx`
- Chat view: `components/chat/chat-view.tsx`
- Prompts: `lib/ai/prompts.ts`
- Pulse check queries: `lib/supabase/pulse-check.ts`
- Write permissions: `lib/markdown/constants.ts`
- File write handler: `lib/markdown/file-write-handler.ts`
- History detail: `app/(main)/history/[sessionId]/page.tsx`
- Context builder: `lib/ai/context.ts`
