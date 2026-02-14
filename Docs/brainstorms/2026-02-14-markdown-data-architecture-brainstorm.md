# Markdown Data Architecture: Reconciling File-First Data Model with Life Plan Design

**Date:** 2026-02-14
**Status:** Brainstorm complete, ready for planning
**Input docs:**
- `Docs/generated/feedback/20260214_Data_architecture_as_markdown_proposal.md` (Path C architecture)
- `Docs/generated/feedback/20260214_Life_plan_UI_Narrative_Home` (life plan + narrative home design)
- `Docs/plans/2026-02-14-narrative-home-approachability-design.md` (approved design direction)

---

## What We're Building

A markdown-native data layer for MeOS that:

1. **Makes markdown files the canonical source of truth** for all user-facing data (life map, life plan, check-ins, Sage context)
2. **Supports the life plan altitude model** from the narrative home design (strategic layer in files, tactical/agentic in relational DB)
3. **Shifts Sage to "think in markdown"** — outputting file body content in `[FILE_UPDATE]` blocks that the system wraps with YAML frontmatter and writes to Supabase Storage
4. **Keeps Supabase Postgres as orchestration/index layer** — auth, notifications, session metadata, file index, task queues

The scope is full Phase 1 + Phase 2 from the data architecture proposal: storage buckets, file format schemas, UserFileSystem service, life map migration, context injection rewrite, AND file-first for new features (life plan, check-in summaries).

---

## Why This Approach

1. **Eliminates the serialization layer** — today, `buildConversationContext()` runs 5+ DB queries and serializes rows into text for Sage's system prompt. With markdown files, the files ARE the context. Read files, inject them. No translation.
2. **Aligns Sage's input and output format** — Sage reads markdown and writes markdown. The data format is the interface contract, not an intermediate representation.
3. **Enables real data portability** — "Download my data" is a zip of readable `.md` files, not a database export. An architectural property, not a feature.
4. **Supports the narrative home design** — the split-by-altitude file model maps 1:1 to the Life Map tab's "Where I Am" / "What I'm Doing" views.
5. **Future-proofs for composability** — OpenClaw, Obsidian, or any file-based agent can read the same files Sage reads.

---

## Key Decisions

### 1. Split by altitude — two markdown file trees for two types of data

| Layer | File Location | Data | UI Surface | Update Cadence |
|-------|--------------|------|------------|----------------|
| **Identity** | `life-map/_overview.md` + domain files | Narrative summary, north star (with "because" clause), priorities, tensions, domain states | "Where I Am" tab | Quarterly |
| **Action** | `life-plan/current.md` | Quarter theme, commitments, next steps, boundaries, things to protect | "What I'm Doing" tab, Home screen | Weekly |
| **Tactical/Agentic** | Supabase relational tables | Task decompositions, execution queue, agent state, approval status | Hidden infrastructure (future) | Daily |

**Rationale:** Identity and action data have different cadences, different audiences (reflection vs. execution), and map to different UI surfaces. The tactical/agentic layer is operational state (queues, status machines) that relational DBs handle well. The principle: user-facing data = markdown, system-facing data = relational.

### 2. Sage outputs markdown body in `[FILE_UPDATE]` blocks

**Current format:**
```
[DOMAIN_SUMMARY]
Domain: career
Current state: Senior product designer...
What's working:
- Strong design skills
[/DOMAIN_SUMMARY]
```

**New format:**
```
[FILE_UPDATE path="life-map/career.md"]
# Career

## Current State
Senior product designer at a mid-stage startup...

## What's Working
- Strong design skills and shipping cadence

## What's Not Working
- No clear growth path at current company

## Key Tension
Security of stable employment vs. the pull toward entrepreneurship.

## Stated Intention
Explore the entrepreneurship path seriously over the next quarter.
[/FILE_UPDATE]
```

**System responsibilities:**
- Parse the `[FILE_UPDATE]` block, extract `path` attribute and body content
- Read existing file's YAML frontmatter (or create new frontmatter for new files)
- Auto-generate metadata: `last_updated`, `version++`, `updated_by: sage`, `schema_version`
- Write frontmatter + body to Supabase Storage
- Update the file index table (async)
- Render the content as a card in chat (same UX as today's domain cards)

**Key benefit:** Sage's output IS the file content (body portion). No translation layer. System handles only the metadata Sage shouldn't worry about.

### 3. File format: hybrid (YAML frontmatter + markdown body)

YAML frontmatter for structured metadata (types, dates, status, scores). Markdown body for narrative content (the part humans read and Sage writes). The frontmatter is system-generated; Sage writes the body.

### 4. Supabase Postgres remains the orchestration layer

| Concern | Stays in Postgres | Rationale |
|---------|------------------|-----------|
| User accounts & auth | Yes | Primary — OAuth, sessions, tokens |
| Notification scheduling | Yes | Primary — next_checkin_at, push prefs, timezone |
| File index | Yes (new table) | Secondary — indexes file paths, frontmatter for fast queries |
| Full-text search | Yes (future) | Secondary — index file contents for "find where I talked about X" |
| Session metadata | Yes | Primary — session IDs, timestamps, token usage, cost tracking |
| Messages (transcript) | Yes | Primary — conversation messages for chat UI replay |
| Task queue (future) | Yes | Primary — tactical/agentic execution state |
| Billing/analytics | Yes | Primary — engagement metrics, usage counters |

**Critical principle:** If Postgres were wiped but storage files survived, no user content would be lost. The database can be rebuilt by re-indexing the files.

### 5. Data architecture first, UI features in parallel thread

This thread builds the markdown data layer foundation. The UI thread (vocabulary rename, home layout, life plan view) runs in parallel and will build on top of this architecture. This brainstorm produces architecture documentation that the UI thread references.

---

## File Structure (Reconciled)

```
/users/{user_id}/
├── life-map/
│   ├── _overview.md            # Identity: narrative, north star, priorities, tensions
│   ├── career.md               # Domain file
│   ├── relationships.md
│   ├── health.md
│   ├── finances.md
│   ├── learning.md
│   ├── creative-pursuits.md
│   ├── play.md
│   └── meaning.md
├── life-plan/
│   ├── current.md              # Action: quarter theme, commitments, next steps, boundaries
│   └── archive/
│       └── 2026-q1.md          # Archived quarterly plans
├── check-ins/
│   ├── 2026-02-09-weekly.md    # Individual check-in summaries
│   └── ...
└── sage/
    ├── context.md              # Sage's working model of the user
    └── patterns.md             # Observed patterns, recurring themes
```

### New file: `life-plan/current.md`

```markdown
---
type: life-plan
quarter: 2026-Q1
quarter_theme: "Building the bridge"
north_star_domain: career
status: active
created_at: 2026-02-09T14:30:00Z
last_updated: 2026-02-14T10:00:00Z
updated_by: sage
version: 3
schema_version: 1
---

# Life Plan -- Q1 2026

## Quarter Theme
Building the bridge -- transitioning from stable employment toward entrepreneurship without burning the safety net.

## Active Commitments

### Have the conversation with my manager about the role change
**Why it matters:** This directly addresses the career plateau -- the #1 source of restlessness that's bleeding into health and energy.
**Status:** in_progress

#### Next Steps
- [x] Draft talking points about why this role fits *(done)*
- [ ] Schedule the 1:1 *(active)*
- [ ] Follow up on their response *(upcoming)*

### Validate MeOS with 10 real users
**Why it matters:** The entrepreneurship pull is real -- this tests whether it's a viable path before making the leap.
**Status:** in_progress

#### Next Steps
- [x] Complete first prototype session *(done)*
- [ ] Recruit 5 more test users *(active)*
- [ ] Synthesize feedback into product decisions *(upcoming)*

## Things to Protect
- Morning walks (3+ days/week)
- Sunday evening planning
- Sleep before midnight

## Boundaries
- Not optimizing for social media presence right now
- Not taking on freelance work, even if it pays well
- Not committing to a launch date before validation is complete
```

### Updated: `life-map/_overview.md`

The existing proposal's overview file gets the north star "because" clause from the narrative home design:

```markdown
---
type: life-map-overview
user_id: {user_id}
last_updated: 2026-02-14T10:00:00Z
updated_by: sage
version: 5
schema_version: 1
domains_mapped: 8
---

# Life Map Overview

## Narrative Summary
Solo founder exploring MeOS while working full-time as a senior product designer. High agency, reflective, tends toward over-analysis. At a crossroads between security and autonomy.

## Your North Star
**Career transition** -- because financial independence unlocks everything else. When work feels meaningful, health improves, relationships get more attention, and creative energy has a direction.

## This Quarter's Focus
1. Have the honest conversation about the role change
2. Validate the MeOS idea with real users
3. Maintain health fundamentals despite career restlessness

## Tensions to Watch
- Security vs. autonomy (career)
- Building in public vs. staying under the radar
- Deep work on MeOS vs. maintaining day job performance

## Boundaries
- Not becoming a "productivity influencer"
- Not optimizing for metrics over meaning
- Not burning out by trying to do both jobs at 100%
```

---

## Sage Context Injection (New Model)

### Before each conversation, the system reads:

1. `sage/context.md` (always) -- who the user is, communication preferences
2. `life-map/_overview.md` (always) -- north star, priorities, tensions
3. `life-plan/current.md` (always, if exists) -- commitments, next steps
4. Relevant domain files (based on pulse check or user selection)
5. Last 2-3 `check-ins/*.md` files (for continuity)

### The assembled context replaces today's `buildConversationContext()`:

Instead of 5+ DB queries serialized into text, it's 4-6 file reads injected directly into the system prompt. The files ARE the context.

### What stays as DB queries:

- Session metadata (current session ID, type, status)
- Notification schedule (next_checkin_at)
- Message history (for chat UI, not for context injection)

---

## Home Screen Data Assembly

The home screen reads from multiple sources to build the narrative layout:

| Home Screen Section | Data Source | File/Table |
|---|---|---|
| Greeting | Sage context | `sage/context.md` → user_name |
| Sage's contextual line | Computed | Template interpolation from life plan + timing data |
| North star card | Life map overview | `life-map/_overview.md` → "Your North Star" section |
| Active commitments | Life plan | `life-plan/current.md` → "Active Commitments" section |
| Check-in prompt | DB (orchestration) | `users.next_checkin_at` |
| Boundaries | Life plan | `life-plan/current.md` → "Boundaries" section |

---

## Migration Path (Existing Data)

### What exists today (relational):
- `life_maps` table: narrative_summary, primary_compounding_engine, quarterly_priorities[], key_tensions[], anti_goals[]
- `life_map_domains` table: domain_name, current_state, whats_working[], whats_not_working[], desires[], tensions[], stated_intentions[], status
- `sessions` table: ai_summary, key_themes[], commitments_made[]
- `patterns` table: description, pattern_type, related_domain
- `pulse_check_ratings` table: domain_name, rating, rating_numeric

### Migration strategy:
1. Create Supabase Storage bucket with per-user folder structure
2. Create `file_index` table in Postgres (rich index: path, type, user_id, last_updated, domain_name, status, quarter, etc.)
3. Build `UserFileSystem` service layer (read/write/list/delete operations on storage)
4. Generate `life-map/_overview.md` from `life_maps` row (narrative, compounding engine → north star with "because" clause, priorities, tensions, anti-goals → boundaries)
5. Generate `life-map/{domain}.md` for each `life_map_domains` row
6. Generate `sage/context.md` from user profile + pattern data
7. Generate `sage/patterns.md` from `patterns` table
8. Generate `check-ins/*.md` from completed sessions with ai_summary
9. Generate `life-plan/current.md` from synthesis data (compounding engine, priorities, commitments) -- always created at synthesis, minimum: quarter theme + 1 commitment
10. Switch all read paths to UserFileSystem (no dual-read period -- clean cutover)
11. Switch all write paths to UserFileSystem (no dual-write -- old tables become read-only backup)
12. Update Sage prompts: `[FILE_UPDATE path="..."]` block format replaces `[DOMAIN_SUMMARY]`, `[LIFE_MAP_SYNTHESIS]`
13. Rewrite `buildConversationContext()` to read from files instead of DB queries

---

## Resolved Questions

1. **Where does life plan data live?** Split by altitude: `life-map/_overview.md` for identity, `life-plan/current.md` for action, tactical/agentic stays relational.
2. **File format for life plan?** Hybrid: YAML frontmatter for metadata, markdown body for content. Commitments use `###` headers with nested next steps as checklists.
3. **How does Sage output change?** `[FILE_UPDATE path="..."]` blocks containing markdown body. System generates frontmatter, writes to storage, renders as card in chat.
4. **Migration scope?** Full Phase 1 + 2: storage buckets, UserFileSystem, data migration, context injection rewrite, new features file-first.
5. **Implementation sequence?** Data architecture first. UI features (vocabulary, home layout, life plan view) run in parallel thread and build on this foundation.
6. **File index table schema?** Rich index. Index: file_path, file_type, user_id, last_updated, domain_name (for domain files), status, quarter, commitment_count, north_star_domain. Enables queries like "all users with in_crisis domains" or "users whose check-in is overdue" without reading files.
7. **Error handling for storage writes?** Retry + accept gracefully. Try the write, retry once on failure. If it still fails, the data is preserved in the chat message (messages table). A reconciliation step can regenerate files from message history if needed. No dual-write path, no queue system.
8. **Backward compatibility during transition?** No dual-write. Clean cutover after migration. Old relational content tables become read-only backup. If something breaks, the migration script can regenerate files. Simpler code, cleaner architecture.
9. **Life plan creation timing?** Always created at synthesis. Sage always generates at least a minimal plan (quarter theme + 1 commitment) during life mapping synthesis. The "pick this up next time" option means they'll refine it later, not that no plan exists. This ensures the home screen always has content to show after onboarding.
10. **Check-in file content?** Include plan diffs. Check-in files document what changed in the life plan (commitment status changes, new/completed next steps). Makes each check-in a self-contained record. Sage can reference "last check-in you moved X forward."

---

## Open Questions

None -- all questions resolved.
