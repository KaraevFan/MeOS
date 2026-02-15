# MeOS Data Architecture Proposal: Markdown-Native, Cloud-Hosted

**Status:** Proposal — pending founder review
**Date:** 2026-02-14
**Decision:** Adopt a hybrid "Path C" architecture — real Markdown files as canonical data format, hosted in cloud storage, with a relational index for orchestration.

---

## Context & Problem Statement

MeOS currently stores user data (Life Map domains, check-in history, conversation transcripts) in Supabase relational tables. This works for the Sprint 1 MVP but creates tensions as the product evolves:

1. **Agent operability:** As MeOS moves toward agentic features (Sage reading/writing user context, future tool-use capabilities), relational rows are awkward for LLMs to read and reason about. Structured Markdown is the native format AI agents consume and produce.

2. **Composability with the ecosystem:** OpenClaw (175k+ GitHub stars) and the broader agentic AI ecosystem are converging on local Markdown files as the standard interface for personal AI data. If MeOS data is locked in relational tables, interoperability requires building and maintaining API adapters. If it's Markdown files, the data format *is* the API.

3. **User trust and portability:** MeOS targets "productivity tool bouncers" — people who've been burned by lock-in. A data architecture where user data exists as human-readable files they could inspect, export, or migrate is a meaningful trust signal. "Export as Markdown" as an afterthought is not the same as "your data IS Markdown."

4. **Future-proofing for local-first:** The local-first software movement is accelerating. If MeOS ever ships a desktop companion, an OpenClaw skill, or native mobile with local storage, a Markdown-native data model makes migration trivial.

### Why not go fully local-first?

We evaluated three paths. Fully local (Path B, à la OpenClaw/Obsidian) was rejected because:

- **Target user mismatch:** MeOS users are the people who *bounced off* Obsidian and Notion. Giving them a folder of `.md` files to manage triggers the same "this feels like homework" response that killed every previous tool for them. OpenClaw's user is a developer running a Mac Mini server. Ours is someone who opens a PWA on their phone, talks, and closes it.
- **Mobile-first PWA constraint:** On mobile, there is no meaningful local filesystem. The concept of "here are your local files" doesn't map to the interaction model.
- **Proactive features require server-side state:** Weekly check-in push notifications, pattern tracking across months, the "you've mentioned feeling stuck on X three weeks in a row" insight — all of this needs a persistent server that can reason over accumulated data on a schedule. Purely local makes the ambient/proactive Layer 2 features extremely difficult.
- **Zero setup is non-negotiable:** The product principle is "get to the conversation as fast as possible." Any architecture that requires the user to configure file paths, sync services, or storage locations violates this.

### Why not stay with pure relational tables?

Pure Supabase tables (Path A) would be faster to ship but creates problems:

- LLM context injection requires serializing rows → Markdown on every conversation, adding a translation layer that drifts from the source of truth
- No real composability — interop with OpenClaw, Obsidian, or any file-based agent requires building API adapters
- "Export your data" becomes an engineering project rather than a trivial file copy
- The data model encourages thinking in database schemas rather than documents, which fights against the product's document-centric nature (Life Map = a document, not a collection of rows)

---

## Chosen Architecture: Path C — Cloud-Hosted Markdown Files

### Core Principle

**Markdown files are the canonical source of truth. The cloud database is a read-optimized index.**

Every meaningful piece of user data — Life Map domains, Life Plan, check-in summaries, Sage's context model — exists as a real `.md` file with YAML frontmatter. These files live in cloud storage (Supabase Storage buckets). Supabase Postgres serves as an index and orchestration layer: user accounts, notification schedules, search indexes, session metadata.

### User File Structure

Each user gets a storage bucket with this structure:

```
/users/{user_id}/
├── life-map/
│   ├── _overview.md            # Narrative summary, priorities, tensions, anti-goals
│   ├── career.md
│   ├── relationships.md
│   ├── health.md
│   ├── finances.md
│   ├── learning.md
│   ├── creative-pursuits.md
│   ├── play.md
│   └── meaning.md
├── life-plan/
│   ├── current.md              # Active quarterly plan
│   └── archive/
│       └── 2026-q1.md
├── check-ins/
│   ├── 2026-02-09-weekly.md
│   ├── 2026-02-02-weekly.md
│   └── ...
├── journal/                    # Future: freeform entries
│   └── ...
└── sage/
    ├── context.md              # Sage's working model of the user
    └── patterns.md             # Observed patterns, recurring themes
```

### File Format Specification

Every file follows a consistent format: YAML frontmatter for structured metadata + Markdown body for human-readable content.

**Example: Life Map Domain File (`career.md`)**

```markdown
---
domain: career
status: needs-attention          # thriving | stable | needs-attention | in-crisis
score: 3                         # 1-5 from Pulse Check
last_updated: 2026-02-09T14:30:00Z
updated_by: sage                 # sage | user
version: 3
---

# Career

## Current State
Senior product designer at a mid-stage startup. Three years in. The role has plateaued — doing good work but not growing. Starting to feel the itch to build something of my own.

## What's Working
- Strong design skills and shipping cadence
- Good relationship with engineering team
- Stable income that covers obligations

## What's Not Working
- No clear growth path at current company
- Creative energy going toward side projects, not the day job
- Feeling increasingly misaligned with company direction

## Key Tension
Security of stable employment vs. the pull toward entrepreneurship. Not ready to leap but increasingly frustrated staying.

## Stated Intention
Explore the entrepreneurship path seriously over the next quarter — validate one idea, talk to 10 potential users — without quitting the day job yet.
```

**Example: Check-in File (`2026-02-09-weekly.md`)**

```markdown
---
type: weekly-check-in
date: 2026-02-09
duration_minutes: 8
domains_discussed:
  - career
  - health
mood: 3                          # 1-5 self-reported
pulse_scores:
  career: 3
  relationships: 4
  health: 2
  finances: 4
  learning: 3
  creative-pursuits: 3
  play: 2
  meaning: 3
---

# Weekly Check-in — Feb 9, 2026

## Summary
Productive week at work but health took a hit — skipped exercise three days and sleep was poor. Career restlessness is increasing; spent two evenings working on the MeOS idea. Recognized a pattern: when work feels stale, health discipline drops.

## Key Moments
- Had a good 1:1 with manager — brought up growth concerns for the first time
- Completed first MeOS prototype session with a friend — they had the "wow" moment
- Missed gym Monday, Wednesday, Thursday

## Patterns Surfaced
- Third week in a row where health scores drop when career frustration rises
- Energy for side project is consistently high — signal worth paying attention to

## Sage's Observations
The career-health connection is becoming a clear pattern. When work doesn't feel meaningful, self-care drops — possibly because motivation is systemic, not domain-specific. The MeOS energy is notable: this is the most sustained enthusiasm for a project in the past two months.

## Updates to Life Map
- career.md: Updated key tension to reflect increasing urgency
- health.md: Added pattern note about career-health correlation
```

**Example: Sage Context File (`sage/context.md`)**

```markdown
---
user_name: Tom
member_since: 2026-01-15
total_sessions: 6
last_session: 2026-02-09
life_map_completion: 8/8 domains
---

# Sage's Working Model

## Who Tom Is
Solo founder exploring MeOS while working full-time as a senior product designer. High agency, reflective, tends toward over-analysis. ADHD-suspected — high novelty-seeking, struggles with sustained execution on things that don't feel energizing.

## Current Priorities
1. Validate MeOS with real users (highest energy)
2. Maintain health fundamentals despite career restlessness
3. Have honest conversation with self about timeline for leaving day job

## Active Tensions
- Security vs. autonomy (career)
- Building in public vs. staying under the radar until ready
- Deep work on MeOS vs. maintaining day job performance

## Communication Notes
- Responds well to direct, non-saccharine observations
- Appreciates when patterns are named explicitly
- Dislikes vague encouragement — prefers concrete "here's what I notice"
- Voice-first preference, checks in on Sunday evenings

## Anti-Goals (things Tom explicitly does NOT want)
- Becoming a "productivity influencer" — wants to build a real product
- Optimizing for metrics over meaning
- Burning out by trying to do both jobs at 100%
```

### How Sage Reads and Writes

**Reading (context injection for conversations):**

Before each conversation, the system assembles Sage's context by reading the relevant Markdown files and injecting them into the system prompt. For a weekly check-in, this means:

1. Read `sage/context.md` (always)
2. Read `life-map/_overview.md` (always)
3. Read the domain files relevant to the session (based on Pulse Check scores or user selection)
4. Read the last 2-3 check-in files for continuity
5. Read `life-plan/current.md` if it exists

This assembled context replaces what would otherwise be a complex SQL query joining multiple tables. The files ARE the context — no serialization layer needed.

**Writing (after conversations):**

After a conversation, Sage produces structured outputs that map directly to file updates:

1. **Domain updates:** Sage generates updated Markdown for any domain files that changed. The app writes these back to storage, incrementing the `version` in frontmatter.
2. **New check-in file:** The check-in summary is written as a new `.md` file in `/check-ins/`.
3. **Context update:** `sage/context.md` is updated with any new observations, priority shifts, or communication notes.
4. **Pattern update:** `sage/patterns.md` is appended with any newly surfaced patterns.

Each write operation is atomic at the file level. The Supabase index is updated asynchronously after file writes succeed.

### The Role of Supabase Postgres

The relational database shifts from "source of truth" to "orchestration and index layer." It handles:

| Concern | Supabase Role |
|---|---|
| **User accounts & auth** | Primary — users table, OAuth tokens, session management |
| **Notification scheduling** | Primary — next check-in date, push notification preferences, timezone |
| **File index** | Secondary — a `user_files` table that indexes file paths, last_modified timestamps, and extracted frontmatter for fast queries without reading files |
| **Search** | Secondary — full-text search index over file contents for "find where I talked about X" |
| **Session metadata** | Primary — conversation session IDs, timestamps, token usage, cost tracking |
| **Billing/subscription** | Primary — plan status, usage counters |
| **Analytics** | Primary — engagement metrics, feature usage |

**Critical principle:** If the Supabase database were wiped but the storage files survived, no user data would be lost. The database can be fully rebuilt by re-indexing the files.

### Sync and Consistency

Since this is a single-user system (no collaboration), consistency is straightforward:

- **Write path:** App writes to storage file → updates Supabase index → confirms to user
- **Read path:** App reads from storage files directly (or from index for metadata-only queries)
- **Conflict scenario:** Only possible if user has multiple tabs/devices. Resolve with last-write-wins on the file level, since check-ins and life map updates are infrequent and user-initiated.
- **No CRDTs needed:** This is not a collaborative editing problem. One user, one AI, sequential conversations.

### Export and Composability

**User-facing export:** A "Download my data" button triggers a zip of the entire user directory. The user gets a folder of `.md` files they can open in any text editor, Obsidian, or feed to any AI agent. This is not a feature to build — it's an inherent property of the architecture.

**OpenClaw integration path:** An OpenClaw skill can be pointed at the user's MeOS storage URL (with auth token). It reads the same Markdown files Sage reads. No API adapter needed — the file format is the interface contract.

**Obsidian sync (future):** A two-way sync between the MeOS cloud folder and a local Obsidian vault is architecturally straightforward — it's file sync, not data transformation.

---

## Implementation Plan

### Phase 1: Introduce Markdown File Layer (Current Sprint)

**Goal:** Establish the file-based data model alongside existing Supabase tables. New writes go to both. Reads migrate incrementally.

1. **Set up Supabase Storage bucket structure** — create per-user buckets with the folder schema above
2. **Define file format schemas** — finalize YAML frontmatter fields for each file type (domain, check-in, context, plan). Create TypeScript types that mirror the frontmatter structure.
3. **Build file read/write utility layer** — a `UserFileSystem` service class that abstracts reading/writing Markdown files to Supabase Storage. Methods like `readDomain(userId, domain)`, `writeCheckIn(userId, data)`, `readSageContext(userId)`.
4. **Migrate Life Map data** — write a migration that takes existing Life Map data from Supabase tables and generates the initial set of Markdown files per user. Keep the tables as a fallback during transition.
5. **Update Sage context injection** — modify the conversation system prompt builder to read from Markdown files instead of database queries. This is the highest-impact change — once Sage reads files, the architecture is real.

### Phase 2: File-First for New Features

**Goal:** All new data types are file-first. No new Supabase tables for user content.

6. **Life Plan as Markdown** — the new Life Plan feature (bridging Life Map to quarterly planning) is built entirely as file operations on `life-plan/current.md`.
7. **Check-in summaries as files** — weekly check-in outputs write to `/check-ins/` as individual Markdown files rather than database rows.
8. **Build the index layer** — create a `file_index` table in Supabase that stores extracted frontmatter metadata for each file (path, type, domain, date, scores, last_modified). Updated via a trigger/webhook after file writes.
9. **Update History view** — the session history UI reads from the file index to list past check-ins, then fetches the full Markdown file on tap.

### Phase 3: Deprecate Content Tables

**Goal:** Supabase tables no longer store Life Map content, check-in content, or Sage context. Only orchestration data remains.

10. **Verify file-first reads everywhere** — audit all code paths that read user content and confirm they go through the `UserFileSystem` layer.
11. **Drop legacy content tables** — remove the old relational tables for Life Map domains, check-in content, etc. The storage files are now the sole source of truth.
12. **Build export feature** — add the "Download my data" button that zips the user's file tree. Should be trivial at this point.

### Future Phases (Post-MVP)

- **OpenClaw skill** — expose the user's file tree via authenticated URL for OpenClaw agent access
- **Local sync option** — for power users, allow syncing the cloud file tree to a local folder (Obsidian vault compatible)
- **File versioning** — leverage Supabase Storage versioning or a simple git-like changelog to track how files evolve over time
- **Full-text search** — index file contents for natural language search ("when did I first talk about switching jobs?")

---

## Technical Considerations

### File Size and Performance

- Individual Markdown files will be small (1-10KB typical, 50KB max for a very detailed domain)
- Reading 5-8 files to assemble Sage's context adds ~50-100ms vs. a database query — negligible for a conversation that takes seconds to process
- The file index table ensures we never need to scan the storage bucket for metadata queries

### Storage Costs

- Supabase Storage is priced per GB. A single user's entire file tree will be < 1MB even after a year of weekly check-ins
- At 1000 users: ~1GB total storage. Cost is negligible.

### Security

- Supabase Storage respects Row Level Security (RLS) policies — each user can only access their own bucket
- Files contain sensitive personal data — ensure bucket policies prevent public access
- The Markdown files should never be served to the client raw — always go through the API layer which enforces auth

### Frontmatter Schema Versioning

- Include a `schema_version` field in frontmatter to support future migrations
- The `UserFileSystem` service should handle reading old schema versions gracefully

---

## Key Risks and Mitigations

| Risk | Mitigation |
|---|---|
| **Slower reads than database** | File index table for metadata queries; direct file reads only when full content needed |
| **Consistency between files and index** | Index is always rebuildable from files; async index updates with retry |
| **File format becomes a rigid contract** | Schema versioning in frontmatter; migration utilities in UserFileSystem |
| **Supabase Storage limitations** | Storage API is simple (read/write/list); if we outgrow it, migrating to S3 or similar is straightforward since it's just files |
| **Increased complexity vs. simple tables** | UserFileSystem abstraction keeps the rest of the app clean; complexity is contained in one service layer |

---

## Decision Record

**Decision:** Adopt Path C — Markdown files as canonical source of truth, hosted in Supabase Storage, with Postgres as an orchestration/index layer.

**Rationale:**
- Aligns AI agent interface (Markdown) with data storage format — eliminates serialization layer
- Enables real composability with OpenClaw, Obsidian, and the broader agentic ecosystem
- Delivers genuine data portability as an architectural property, not an afterthought feature
- Preserves all cloud benefits (cross-device, push notifications, zero setup) that our target user requires
- Future-proofs for local-first evolution without requiring re-architecture

**Tradeoffs accepted:**
- More engineering complexity than pure relational tables
- File operations are slightly slower than database queries (mitigated by index)
- Markdown file format becomes a versioned contract that needs careful stewardship
- Slightly more work upfront in Phase 1 vs. just adding Supabase columns

**Tradeoffs rejected:**
- Pure local-first (Path B): incompatible with target user, mobile-first PWA, and proactive server-side features
- Pure relational (Path A): sacrifices composability, agent-friendliness, and genuine portability