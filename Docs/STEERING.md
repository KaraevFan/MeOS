# MeOS Steering Doc

> Lightweight roadmap overlay. Origin docs (MVP_PRD, vision, UX_design) remain source of truth for deep reference. This doc tracks sequencing and decisions.
>
> **Update protocol:** Read at session start. Update when shipping, capturing ideas, or making strategic decisions.

---

## Current Focus

**Staged Validation + POS Expansion** — validate the kernel with real users, then expand to daily utility modules. Full design: `Docs/plans/2026-02-16-pos-vision-strategy-design.md`

### This Week (Week 1)
- Ship UX architecture gaps branch (PR #9)
- R3 self-test of shipped retention features
- Recruit 8-10 external testers for Wave 1

### Week 2
- **Wave 1 testing:** 4-5 users do life mapping. Same-day interviews. Key question: does the "this gets me" moment happen?
- Fix issues surfaced during R3 self-test
- **Build:** Google Calendar OAuth plumbing (consent screen, token management, refresh, read access)

### Week 3
- **Ship:** Daily Journal module + Quick Capture module
- **Wave 2 testing:** Wave 1 returnees + new users test journal + capture + first check-in
- **Build:** Calendar write access (create/update/delete events)
- Module discovery: Day 2 push notification introduces journal. Sage introduces modules during first check-in.

### Week 4
- **Ship:** Day Planner with full calendar read/write. The "holy shit" module.
- **Wave 3 testing:** Full POS experience — life mapping → daily modules → check-in

### Weeks 5-6
- Iterate based on data. Expand to 15-20 beta users.
- **Decision gate:** Do users open the app 3+ days/week? Is the day planner better because of Life Map context?

---

## Up Next (After Weeks 5-6 Decision Gate)

Priority depends on what the data shows. If daily utility works:

1. **Ring 3: Pattern detection** — automated cross-session analysis, surfaced in check-ins
2. **Ring 3: Recovery flows** — lapsed user re-engagement (2+ weeks absent). Currently undesigned.
3. **Ring 3: Trust ladder** — per-capability progressive autonomy for Sage

If daily utility is weak but check-ins are strong:
1. Deepen check-in quality (pattern detection, richer context)
2. Defer additional modules
3. Investigate why daily cadence didn't stick

---

## Backlog

### Ring 2: Daily Utility (Active — Weeks 3-4)

- [ ] Daily journal module — session type + prompt + JournalCard
- [ ] Quick capture module — session type + prompt, writes to relevant domain/sage files
- [ ] Day planner module — calendar OAuth, bidirectional events, DailyPlanCard (3 states), end-of-day loop
- [ ] Module discovery mechanism — Day 1 home card, Day 2 push notification, Sage introduces during first check-in
- [ ] Home screen CTA evolution — time-aware: "Plan my day" / "How's today going?" / "How'd today go?"
- [ ] `daily-logs/` file path + write permissions for daily_planning and daily_journal session types
- [ ] End-of-day capture loop — push notification, quick-reply, daily log entry, feeds weekly rollup

### Ring 3: System Intelligence (Weeks 7-10)

- [ ] Automated pattern detection — cross-session themes, obstacles, sentiment
- [ ] Progressive trust ladder — per-capability, earned through successful interactions (L0→L1→L2)
- [ ] Recovery flows — graduated nudges, warm re-onboarding, no guilt
- [ ] Cross-domain pattern surfacing ("You've mentioned burnout in 3 domains")
- [ ] Sentiment tracking over time
- [ ] Smarter context injection (daily logs + recently changed domains)

### Ring 4: Agentic Execution (Q2)

- [ ] Task decomposition: Sage proposes breakdown, user approves
- [ ] Agent execution queue: draft emails, web research, calendar blocks, document outlines
- [ ] Approval surface: Sage proposes → user approves → agent executes → user reviews
- [ ] Expanded tool set: search_web, draft_email, create_document_outline

### Ring 5: Platform Expansion (Q3+)

- [ ] MCP server exposing Life Map to external AI systems
- [ ] OpenClaw skill (Life Map as structured identity layer)
- [ ] WhatsApp bot for zero-friction captures
- [ ] Monetization: freemium gate ($15-20/mo for unlimited check-ins + daily modules + agents)
- [ ] Smart calendar, knowledge capture, project manager modules

### Onboarding & First Session

- [ ] Refine life mapping arc pacing based on Wave 1 feedback
- [ ] Explore shorter "quick map" option (10 min vs 20-30 min)
- [ ] First-session-to-check-in bridge (module discovery handles this now)

### Conversational UX

- [ ] Emotional arc design: rising tension → recognition → catharsis → warm closure
- [ ] Mini-arc transitions between domains (smoother topic switching)
- [ ] Sage personality tuning based on playtest feedback
- [ ] Session state machine expansion (daily_planning, daily_journal, capture session types)
- [ ] Prompt engineering for POS module conversations (different tone than reflections)

### Design & Polish

- [ ] Accessibility audit (screen reader, contrast, focus management)
- [ ] Animation performance pass (breathing orb on low-end devices)
- [ ] Empty-to-populated state transitions (first check-in, first domain)
- [ ] Dark mode (if demand surfaces)

### Infrastructure

- [ ] Google Calendar OAuth (consent screen, token management, refresh logic)
- [ ] Calendar event CRUD with MeOS source tagging
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
| Feb 16 | **POS strategy: Staged validation with ring architecture** | Validate kernel (Wave 1) → daily utility modules (Wave 2-3) → system intelligence (Ring 3) → agentic execution (Ring 4). Don't build the next ring until the current one has its proof point. Day planner is the "holy shit" module — requires calendar from day one. Design doc: `Docs/plans/2026-02-16-pos-vision-strategy-design.md` |
| Feb 16 | **Day planner requires bidirectional calendar** | Read-only calendar gets 60% of the wow. Write access (Sage creates calendar blocks) gets 100%. Ship journal + capture first (no calendar needed), day planner last with full OAuth. |
| Feb 16 | **Module build order: Journal → Capture → Day Planner** | Journal is lowest-risk (extends existing conversation UX). Capture tests push-to-system behavior. Day planner is highest-impact but needs calendar OAuth — build plumbing in parallel, ship module last. |
| Feb 16 | **Vision pivot: Life mapping → Personal Operating System** | Life mapping and reflections are how the system learns. POS modules (journal, planner, capture) are what give daily utility. Without daily utility, retention depends entirely on weekly check-in cadence — too fragile. |
| Feb 14 | **Markdown-native data architecture** | Relational tables for life map content created impedance mismatch with LLM I/O. Markdown files in Supabase Storage align naturally with how Sage reads and writes. ~40% scope reduction for MVP. |
| Feb 14 | **Vocabulary layer: type fields → coaching language** | Users resonated with "north star" and "boundaries" over technical terms. Map at presentation layer, don't rename type fields. |
| Feb 13 | **Warm palette, not productivity aesthetic** | Playtest R1 showed users responded to warmth. Committed to amber/cream/earth tones. No cold blues, no sterile whites, no dashboard layouts. |
