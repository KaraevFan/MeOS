# CLAUDE.md

## Project Overview

**MeOS** is a voice-first AI life partner app. An AI guide called "Sage" helps users map their life through guided conversation and stay aligned through weekly check-ins. Currently in Sprint 1 build phase — going from spec to working MVP.

## Key Documentation

### Origin docs (source of truth — read BEFORE implementing anything):

- `Docs/vision.md` — Product vision, positioning, and long-term direction
- `Docs/MVP_PRD.md` — Complete build spec: product principles, Sage persona, data model, system prompts, conversation flows, sprint plan
- `Docs/UX_design.md` — Design philosophy, color palette, typography, screen specs, interaction patterns, user journey

When in doubt about product decisions, behavior, or design direction, consult these docs rather than guessing.

### Steering & Priorities

- `Docs/STEERING.md` — Current roadmap, backlog, and decisions log.
  Read this at session start to understand current priorities.
  When a feature ships or priorities change, update STEERING.md accordingly.
  When a new idea is captured (from brainstorms, feedback, or conversation), add it to the appropriate Backlog epic.

### Generated docs (`Docs/generated/`) — machine-derived reference material:

These are generated from the origin docs + codebase for human readability. Do NOT treat as source of truth — regenerate if stale.

## Tech Stack

- **Frontend:** Next.js 14+ (App Router) + Tailwind CSS — mobile-first PWA
- **Backend/DB:** Supabase (Postgres + Auth + Realtime)
- **AI:** Claude API (conversation engine)
- **Voice:** Whisper API or Deepgram (speech-to-text)
- **Hosting:** Vercel

## Project Structure

```
/app                    # Next.js App Router pages and layouts
  /api                  # API routes (Claude API proxy, voice transcription, session processing)
  /(auth)               # Auth pages (login, callback)
  /(main)               # Authenticated app shell with bottom tab nav
    /home               # Home screen
    /chat               # Conversation view (primary interface)
    /life-map           # Life Map structured view
    /history            # Past sessions list
/components
  /ui                   # Reusable UI primitives (buttons, cards, inputs)
  /chat                 # Chat-specific components (message bubbles, domain cards, voice button)
  /life-map             # Life map display components
/lib
  /supabase             # Supabase client, auth helpers, database queries
  /ai                   # Claude API integration, system prompts, structured output parsing
  /markdown             # Markdown file system: UserFileSystem, file write handler, frontmatter
  /voice                # Voice recording (MediaRecorder) + transcription API
  /utils                # General utilities
/types                  # TypeScript type definitions
/public                 # Static assets, PWA manifest, service worker
```

## Commands

```bash
npm run dev             # Start dev server
npm run build           # Production build
npm run lint            # ESLint
npm run type-check      # TypeScript strict check
npx supabase db push    # Push migrations to Supabase
npx supabase gen types  # Generate TypeScript types from DB schema
```

## Code Style & Conventions

- TypeScript strict mode. No `any` types — use `unknown` + type guards.
- Use named exports, not default exports (except Next.js pages/layouts which require default).
- Prefer server components by default. Use `'use client'` only when needed (interactivity, hooks, browser APIs).
- Tailwind utility classes only — no custom CSS files.
- Use `cn()` helper (clsx + tailwind-merge) for conditional class names.
- Async data fetching in server components, not in useEffect.
- Supabase Row Level Security (RLS) on all tables — never trust client-side auth alone.

## Critical Architecture Decisions

### Markdown-Native Data Architecture

Life map content is stored as **markdown files in Supabase Storage** — not in relational tables. Postgres handles orchestration (sessions, auth, pulse checks); Storage holds identity/content data.

**File structure per user** (in `user-files` bucket under `users/{user_id}/`):
```
life-map/
  _overview.md          # Narrative summary, north star, priorities, tensions, boundaries
  career.md             # Domain: Career / Work
  relationships.md      # Domain: Relationships
  health.md             # etc.
  ...
life-plan/
  current.md            # Quarter theme, active commitments, next steps, boundaries
check-ins/
  2026-02-14-weekly.md  # Check-in summaries
sage/
  context.md            # Sage's working model of the user
  patterns.md           # Observed patterns
```

**Key files:**
- `lib/markdown/user-file-system.ts` — Core `UserFileSystem` service for all file reads/writes
- `lib/markdown/file-write-handler.ts` — Handles `[FILE_UPDATE]` blocks from Sage output
- `lib/markdown/constants.ts` — Domain file map, path validation, session write permissions
- `lib/markdown/frontmatter.ts` — Auto-generates YAML frontmatter for each file type
- `lib/markdown/extract.ts` — Markdown section extraction helpers
- `types/markdown-files.ts` — Zod schemas for all file frontmatter types

### Structured Output Parsing

Sage outputs `[FILE_UPDATE]` blocks with semantic identifiers that the system resolves to file paths:
```
[FILE_UPDATE type="domain" name="Career / Work"]
# Career
## Current State
...
[/FILE_UPDATE]
```

Available types: `domain`, `overview`, `life-plan`, `check-in`, `sage-context`, `sage-patterns`.

The parser (`lib/ai/parser.ts`) handles both new `[FILE_UPDATE]` blocks and legacy `[DOMAIN_SUMMARY]`/`[LIFE_MAP_SYNTHESIS]`/`[SESSION_SUMMARY]` blocks for backward compat. Legacy blocks are rendered but no longer produced by updated prompts.

**Sage writes markdown body only — the system generates YAML frontmatter automatically.**

### Vocabulary Mapping (Data Layer → UI)

The `LifeMap` TypeScript type uses legacy field names from the original relational schema. The UI displays coaching vocabulary instead. Mapping happens at the presentation layer — do NOT rename the type fields.

| Type field | UI label | Where mapped |
|---|---|---|
| `primary_compounding_engine` | "Your north star" | `life-map/page.tsx`, `home/page.tsx` |
| `anti_goals` | "Boundaries" | `life-map/page.tsx`, `home/page.tsx` |
| `key_tensions` | "Tensions to watch" | `life-map/page.tsx` |

### Commitment Heading Stability

Commitment `###` headings in `life-plan/current.md` serve as **identity keys across sessions**. The prompt in `getWeeklyCheckinBasePrompt()` instructs Sage to never rename them. Changing a commitment heading breaks continuity tracking between check-ins. The `extractCommitments()` parser and React key props both rely on heading text stability.

### Session-Scoped Write Permissions

To prevent prompt injection, each session type has a whitelist of paths it can write to:
- `life_mapping` → `life-map/*`, `life-plan/current.md`, `sage/*`
- `weekly_checkin` → `check-ins/*`, `life-plan/current.md`, `life-map/*`, `sage/*`

### Conversation Memory (Token Management)

Context injection reads from markdown files (not DB tables):
1. `sage/context.md` — Sage's working model
2. `life-map/_overview.md` — Life map overview
3. `life-plan/current.md` — Current life plan
4. Last 3 `check-ins/*.md` — Recent check-in summaries
5. Domain files for domains with `needs_attention`/`in_crisis` status
6. Pulse check baseline (still from relational DB)

Full transcripts are stored in `messages` table for user review only.

### Voice Flow

Record → Stop → Transcribe → Display as message → Send to Claude. No real-time streaming transcription in MVP. Keep it simple.

## Design Constraints (Non-Negotiable)

- **Warm palette:** Soft amber/gold primary, cream backgrounds, dark warm gray text, earth tone accents. NOT cold blues or sterile whites.
- **Voice button is the hero:** 60px circle, warm amber, center-bottom, most prominent element.
- **Mobile-first PWA.** Touch targets minimum 44px.
- **No empty states** — every screen has a warm nudge toward conversation.
- **No guilt-inducing UI** — gentle consistency acknowledgment, never streaks or scores.
- **Sage responses are concise** — 2-4 sentences typical, longer only when synthesizing.

## Gotchas & Guardrails

- Supabase Auth uses PKCE flow for SSR. Use `@supabase/ssr` package, not `@supabase/auth-helpers-nextjs` (deprecated).
- Claude API calls must go through our API route — never expose the API key client-side.
- Voice recording uses MediaRecorder API — check browser compatibility, provide text fallback.
- PWA service worker must NOT cache API routes or Supabase realtime connections.
- Life map domain status enum is exactly: `thriving | stable | needs_attention | in_crisis`. Don't invent new values.
- Session types enum: `life_mapping | weekly_checkin | monthly_review | quarterly_review`. Only `life_mapping` and `weekly_checkin` are implemented in MVP.

## Skills

- `.claude/skills/meos-design/SKILL.md` — MeOS design system. Read this before building ANY frontend component. Contains design tokens, component patterns, anti-patterns, and typography rules. Prevents generic AI aesthetics.

## What's Out of Scope (Sprint 1)

Don't build these yet: daily nudges, content intake, habit tracking, social features, native app, payments, TTS, data visualizations, pattern detection beyond basic theme tracking.