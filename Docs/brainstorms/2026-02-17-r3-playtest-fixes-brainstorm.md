# R3 Playtest Fixes — Brainstorm

**Date:** 2026-02-17
**Status:** Approved
**Source:** `Docs/feedback/20260217_R3_playtest.md`

---

## What We're Building

Six categories of fixes and features from the R3 playtest, ranging from prompt-level changes to a new desktop sidebar component. The goal is to ship all of these before Wave 1 external testing so testers experience the polished flow.

**Priority stack:**
1. P0: Cap first life-mapping session at 2-3 domains (prompt change)
2. P0: Defer prescriptions to synthesis phase (prompt change)
3. P1: Desktop artifact sidebar with live domain slots + insights (new component)
4. P1: Home screen refinements (reflection nudge upgrade, boundary grounding)
5. P1: Life map view refinements (spider chart, domain previews, status logic)
6. P1: UX polish (pulse check UI, spider chart blurb, quick replies, message spacing)

---

## Why This Approach

The R3 playtest revealed that Sage's conversational quality is strong but the structural experience needs work. Two domains already felt long at ~25 minutes — the current design implying all 8 would produce a 90-minute marathon. The sidebar addresses the "is this going anywhere?" anxiety by making the life map build visible during conversation. The prompt fixes prevent Sage from prescribing before it has the full picture.

All items serve the core retention question: **Do users who complete life mapping come back for a weekly check-in?**

---

## Key Decisions

### Session Length
- **Sage proposes 2-3 priority domains, user confirms.** Sage picks based on lowest pulse ratings / sharpest contrasts, explicitly tells the user they won't cover everything today.
- **Soft default to wrap up after 2-3 domains.** No hard cap — user can say "let's keep going." Sage suggests wrapping up and synthesizing.
- **Unexplored domains are a retention mechanic.** Synthesis references them as "areas to dig into next time." Each one is a reason to come back.

### Prescription Timing
- **Exploration mode: reflect, connect, bookmark.** Sage may acknowledge potential actions ("that sounds worth building a habit around — we'll come back to this") but does NOT propose commitments, schedules, or routines.
- **Synthesis mode: earned prescriptions.** After all priority domains are explored, Sage proposes 2-3 concrete next steps informed by cross-domain understanding. Recommendations reference connections between domains.

### Artifact Sidebar Architecture
- **CSS Grid layout on chat page.** `grid-cols-1 lg:grid-cols-[1fr_320px]`. Sidebar only renders during life_mapping sessions at `lg:` breakpoint. Mobile is completely unaffected.
- **Supabase Realtime for data flow.** Sidebar subscribes to `file_index` table changes. When domain files are written, corresponding sidebar slots update. Chose Realtime over React state to avoid refactoring when the sidebar extends to other pages.
- **Cross-cutting insights via `session-insights` FILE_UPDATE type.** Sage emits `[FILE_UPDATE type="session-insights"]` after the 2nd+ domain card. Writes to `sage/session-insights.md` — fits existing pipeline, already within write permissions, no new infrastructure needed.
- **Phase 1 scope: Desktop only.** No mobile bottom sheet. No animated transitions. Static rendering with Supabase Realtime subscriptions.

### Domain Frontmatter Additions
- **`preview_line` field:** Sage generates a one-line summary of the most salient insight for each domain. Displayed as the collapsed preview on Life Map view and in sidebar slots.
- **`status` override:** Sage can override pulse-derived status when the conversation reveals a different reality. Optional field — falls back to pulse data if absent.

### Home Screen
- **"Something to sit with" = upgraded reflection nudge.** Sage generates a `[REFLECTION_PROMPT]` block during synthesis containing a specific, provocative question from the conversation. Stored in existing `reflection_prompts` table. Existing `ReflectionNudgeCard` renders it.
- **Active commitments fixed by P0 #2.** Once prescriptions are deferred to synthesis, commitments in `life-plan/current.md` naturally reflect cross-domain-aware recommendations.
- **Boundaries grounding:** Prompt constraint — boundaries must cite explicit user statements. Inferred numbers flagged as inference.
- **No spider chart on home.** Reserved for Life Map view to keep home narrative-focused.

### Life Map View
- **Spider chart at top as visual anchor.** Compact radar chart above domain grid. Reuses existing `radar-chart.tsx` component. Fetches latest pulse ratings.
- **Domain previews show `preview_line`** instead of truncated current state. Falls back to current state if preview_line not in frontmatter.
- **Status derived from conversation + pulse.** Domain frontmatter `status` overrides pulse-derived status when present.
- **"Explore with Sage" CTA already exists.** No change needed.

### UX Polish
- **Pulse check UI:** Numbers (1-5) on rating circles, subtle color gradient (warm red → green), tighter spacing, tap animation (Framer Motion scale), consider auto-advance after 500ms.
- **Spider chart blurb:** Quick Haiku API call with pulse ratings → 1-2 sentence specific observation. Fallback: conditional logic template.
- **Quick reply buttons:** Increased border contrast (`border-text-secondary/25`), subtle background tint.
- **Message spacing:** Reduce gap between last message and quick replies. Anchor closer.
- **Intake mini-conversation:** Keep as-is. Accepted tradeoff.

---

## Files Affected

### Prompt changes (P0s + sidebar instructions)
- `lib/ai/prompts.ts` — Session structure, exploration/synthesis modes, preview_line generation, session-insights generation, reflection prompt generation, boundaries grounding

### New sidebar component
- `app/(main)/chat/page.tsx` — CSS Grid wrapper for sidebar
- `components/chat/life-map-sidebar.tsx` — New component
- `components/onboarding/radar-chart.tsx` — Reuse (may need size prop)

### Data model additions
- `lib/markdown/constants.ts` — Add `session-insights` to FILE_TYPES
- `types/markdown-files.ts` — Add `preview_line` and `status` to domain frontmatter schema
- `lib/markdown/frontmatter.ts` — Update domain frontmatter auto-generation
- `lib/ai/parser.ts` — Handle `session-insights` type and `[REFLECTION_PROMPT]` block
- `lib/markdown/file-write-handler.ts` — Route `session-insights` to `sage/session-insights.md`

### Home screen
- `components/chat/chat-view.tsx` — Parse and store `[REFLECTION_PROMPT]` block
- `lib/supabase/home-data.ts` — May need to adjust reflection prompt query

### Life Map view
- `app/(main)/life-map/page.tsx` — Add spider chart at top
- `components/life-map/domain-detail-card.tsx` — Use `preview_line` for collapsed preview, read `status` from frontmatter
- `components/life-map/domain-grid.tsx` — Pass frontmatter status through

### UX polish
- `components/chat/pulse-check-card.tsx` — Rating circle UI upgrades
- `components/onboarding/summary-screen.tsx` — Haiku blurb call
- `components/chat/quick-reply-buttons.tsx` — Border contrast
- `components/chat/chat-view.tsx` — Message/quick-reply spacing

---

## Open Questions

None — all decisions resolved during brainstorm.

---

## Next Steps

Run `/workflows:plan` to create the implementation plan with task ordering, dependencies, and estimated scope per item.
