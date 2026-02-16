# MeOS Steering Doc

> Lightweight roadmap overlay. Origin docs (MVP_PRD, vision, UX_design) remain source of truth for deep reference. This doc tracks sequencing and decisions.
>
> **Update protocol:** Read at session start. Update when shipping, capturing ideas, or making strategic decisions.

---

## Current Focus

_Nothing active — ready for next sprint planning._

---

## Up Next

1. **Playtest R3 + validation** — test shipped retention features (closings, push, ad-hoc sessions) with real users. Collect feedback before building more.
2. **POS Module design: Daily Journal** — 2-minute conversational reflection that updates Life Map. First module of the POS expansion. Needs brainstorm + design doc.
3. **Recovery flow** — what happens when a user disappears for 2+ weeks. Currently undesigned. (Ref: `Docs/feedback/20260216_MeOS_UX_Architecture.md` Gap 11)

---

## Backlog

### Onboarding & First Session

- [ ] Refine life mapping arc pacing based on R3 playtest feedback
- [ ] Explore shorter "quick map" option (10 min vs 20-30 min)
- [ ] First-session-to-check-in bridge (what happens in the days between?)

### Retention & Re-engagement

- [ ] Recovery flow for lapsed users (2+ weeks absent) — Gap 11
- [ ] Micro-moments: daily nudges, win recognition — Gap 16
- [ ] Commitment success rate visibility — Gap 15
- [ ] Tune push notification timing and copy based on playtest data

### Conversational UX

- [ ] Emotional arc design: explicit rising tension → recognition → catharsis → warm closure
- [ ] Mini-arc transitions between domains (smoother topic switching)
- [ ] Sage personality tuning based on playtest feedback (too gentle? too pushy?)
- [ ] Session state machine expansion (more granular `detectSessionState`)
- [ ] Prompt engineering for POS module conversations (different tone than reflections)

### POS Modules

- [ ] Daily journal / 2-minute reflection — first POS module target
- [ ] Quick capture ("Hey Sage, remind me...") — zero-friction input
- [ ] Day planner — calendar integration + Life Map priorities
- [ ] Each module = prompt + tools + card type, not a separate screen (Sage as unified interface)

### System Intelligence

- [ ] Cross-domain pattern surfacing ("You've mentioned burnout in 3 domains") — Gap 14
- [ ] Progressive trust ladder (earn more capabilities over time) — Gap 12
- [ ] Sentiment tracking over time (mood graph from pulse checks) — Gap 13
- [ ] Smarter context injection (prioritize recently changed domains)

### Tool Use & Agents

- [ ] Tool use architecture design (calendar search, email drafts, web research) — Gap 10
- [ ] Task decomposition: Sage proposes breakdown, user approves
- [ ] Agent queue: autonomous execution of approved tasks
- [ ] Approval surface: user reviews agent outputs

### Design & Polish

- [ ] Accessibility audit (screen reader, contrast, focus management)
- [ ] Animation performance pass (breathing orb on low-end devices)
- [ ] Empty-to-populated state transitions (first check-in, first domain)
- [ ] Dark mode (if demand surfaces)

### Infrastructure

- [ ] Monitoring and error tracking (Sentry or similar)
- [ ] Service worker refinement (offline support, cache strategy)
- [ ] File system performance: batch reads, metadata index queries
- [ ] Rate limiting on API routes

---

## Shipped

### Sprint: UX Architecture Gaps (Feb 16) — PR #9
Domain editing via Sage CTA, session type headers, trend arrows on domain cards, history actions.

### Sprint: Retention (Feb 16) — PR #7
Session closing rituals, ad-hoc sessions, push notifications, reflection prompts.

### Sprint: Onboarding Rework (Feb 16) — PR #6
6-screen flow with name input, trust conversation, mini-conversation, pulse check radar, contextual Sage greeting.

### Security & Idempotency Fixes (Feb 15)
Closed RLS hole in markdown storage, added idempotency guard, fixed push error handling.

### Sprint: Playtest R2 Polish (Feb 15)
File_update domain cards in chat, voice MIME fixes, prompt tuning (2-3 sentences, single question), Life Map status labels and CTAs.

### Sprint: Post-Playtest R1 Fixes (Feb 13)
Multi-block parser, pulse check component, life map context injection, session state detection, dynamic Sage line.

### Markdown Data Architecture (Feb 14)
Supabase Storage layer, UserFileSystem service, [FILE_UPDATE] parser, migration from relational data, context injection rewrite.

### Narrative Home + Vocabulary Layer (Feb 14)
North star / boundaries / commitments vocabulary mapping, home screen layout.

### Breathing Orb + Palette Refresh (Feb 13)
Amber breathing orb as visual identity, brighter warm color tokens.

---

## Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| Feb 16 | **Vision pivot: Life mapping → Personal Operating System** | Life mapping and reflections are how the system learns. POS modules (journal, planner, capture) are what give daily utility. Without daily utility, retention depends entirely on weekly check-in cadence — too fragile. |
| Feb 14 | **Markdown-native data architecture** | Relational tables for life map content created impedance mismatch with LLM I/O. Markdown files in Supabase Storage align naturally with how Sage reads and writes. ~40% scope reduction for MVP. |
| Feb 14 | **Vocabulary layer: type fields → coaching language** | Users resonated with "north star" and "boundaries" over technical terms. Map at presentation layer, don't rename type fields. |
| Feb 13 | **Warm palette, not productivity aesthetic** | Playtest R1 showed users responded to warmth. Committed to amber/cream/earth tones. No cold blues, no sterile whites, no dashboard layouts. |
