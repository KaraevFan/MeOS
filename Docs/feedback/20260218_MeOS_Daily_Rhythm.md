# MeOS Daily Rhythm & Journal Module: Design Specification

**Date:** February 18, 2026
**Status:** Design synthesis — ready for milestone scoping and UI exploration
**Context:** Synthesized from design session covering journal module, daily rhythm architecture, home screen redesign, agent-native technical architecture, and integration mapping.

---

## 1. Core Design Insight

**The journal is not a feature. It's a byproduct of a daily rhythm.**

Users don't want to "journal." They want to close their day, empty their head, and wake up with clarity. The journaling happens as a side effect of rituals they already want to do. The product should be designed around this — the *flow* is the feature, the *file* is the artifact.

This reframes the entire module from "add journaling to MeOS" to "design a daily rhythm that produces structured data as its output."

---

## 2. The Daily Rhythm: Architecture Overview

### 2.1 The Bookend Model

Two ritualistic sessions bracket the user's day. Everything else is lightweight capture in between.

```
Morning:   "Open the Day"    — plan, intention, calendar-aware       (2 min)
Mid-day:   Quick Captures     — breadcrumbs, voice memos, thoughts   (10 sec each)
Mid-day:   One Nudge           — micro-commitment check               (30 sec, system-initiated)
Mid-day:   Home Screen         — context-aware surface                 (passive)
Evening:   "Close the Day"   — reflect, synthesize, release          (2-3 min)
```

**Total active user time: under 5 minutes/day.**

The user only *initiates* two sessions (morning + evening). Everything else is either passive or a single tap.

### 2.2 New Session Types

Added to the existing `life_mapping` and `check_in` session types:

| Session Type | Direction | Duration | Output File | Voice-First? |
|---|---|---|---|---|
| `open_day` | Forward-looking | ~2 min | `day-plans/{date}-plan.md` | Yes |
| `close_day` | Backward-looking | ~2-3 min | `daily-logs/{date}-journal.md` | Yes |
| `quick_capture` | N/A (no conversation) | ~10 sec | `captures/{date}-{timestamp}.md` | Yes |
| `ad_hoc` | Variable (user-driven) | Variable | Depends on intent | Optional |

**Key distinction:** Daily sessions (`open_day`, `close_day`) are *ritualistic* — same shape every time, predictable, habitual. `ad_hoc` is *exploratory* — user-driven, variable length, different energy. These should not be conflated.

---

## 3. Session Designs

### 3.1 "Open the Day" — Morning Flow

**Purpose:** Orient the user toward what matters today. Produce a day plan artifact that the evening session can reference.

**Step 1: The Briefing (passive, 30 seconds to read)**
When the user taps "Open your day," they see a lightweight briefing card *before* any conversation starts:
- Today's calendar at a glance (pulled from calendar integration)
- Active priorities (from life plan, collapsed to titles)
- Yesterday's evening reflection summary (one line from last journal)
- Any outstanding captures/tasks from yesterday

This is not AI-generated content to read — it's the user's *own data*, organized. A few lightweight artifacts to anchor and orient the day.

**Step 2: The Intention Chat (voice-first, 60-90 seconds)**
Sage opens with one contextual question drawn from the calendar and priorities:
- "You've got a packed afternoon — what's the one thing that would make today feel like a win?"
- "Your morning is clear until 11. What do you want to protect that time for?"

The user talks. Sage may ask one follow-up. Done.

**Step 3: The Day Plan Artifact**
Sage produces a compact day plan file with structured frontmatter:

```markdown
---
date: 2026-02-18
type: day-plan
intention: "Ship the journal module prototype"
energy_morning: high
calendar_events: 3
key_commitments: [meos-build, plaud-prep]
---

## Day Plan — Feb 18, 2026

**Intention:** Ship the journal module prototype
**Calendar:** 3 meetings (afternoon), morning clear for maker block
**Priorities:** Continue MeOS daily rhythm build, prep Plaud materials

Morning intention set via voice at 7:45am.
```

**Future additions (not MVP):**
- Personalized news/reading digest relevant to user's interests
- Weather or commute context
- Energy prediction based on sleep data (requires health integration)

### 3.2 "Close the Day" — Evening Flow

**Purpose:** Help the user process their day, empty their head, and produce a journal artifact. Emotional frame is *release*, not *review*.

**Step 1: Context Loading**
Sage pulls:
1. Today's day plan (morning intention)
2. Today's calendar (what actually happened)
3. Any quick captures from the day
4. Current life map priorities and active tensions
5. Yesterday's journal entry (for continuity)

**Step 2: Voice-First Conversation (2-3 exchanges max)**
Sage opens with ONE specific question drawn from the day's context:
- "You captured a note at 2pm about feeling stuck on onboarding. Want to unpack that?"
- "You set an intention to protect your maker block — how did that go?"
- "Your calendar was packed today. What's one thing you want to let go of before bed?"

If the user gives a quick "fine, nothing major" response → accept warmly, close.
If they share something significant → one follow-up, then close.

**Key behavioral rules:**
- Never push for more depth than offered — this is a 2-minute wind-down
- Never make the user feel like this is a performance review
- Do NOT suggest action items (that's morning territory)
- Close with warmth: "Thanks for checking in. Sleep well." or similar
- Capture energy/mood signal if naturally expressed (don't ask for a rating)

**Step 3: Synthesis & Journal Artifact**
Sage takes the voice transcript, extracts key points, and produces:

```markdown
---
date: 2026-02-18
type: daily-journal
energy: moderate
mood_signal: productive-but-grinding
domains_touched: [career, health]
intention_fulfilled: partial
captures_referenced: 2
connected_to_plan: true
---

## Daily Reflection — Feb 18, 2026

Spent the day deep in the MVP build. Energy was moderate — productive but
grinding. Protected the morning maker block successfully. Afternoon meetings
ran long but the journal module conversation yielded clear architecture.

Side project (Habit Stacker) didn't get attention — third day this week.
Pattern worth surfacing in next check-in.

**Quick captures folded in:**
- 2:14pm: "Feeling stuck on onboarding flow — need to simplify"
- 4:30pm: "Good convo with Claude on agent-native arch for MeOS"
```

**Step 4: JournalCard (the "receipt")**
A compact inline card rendered in chat after the journal concludes:
- Date + time
- 1-2 sentence summary
- Energy indicator (subtle dot or word, not a scale)
- Connected domain tags (small pills)
- Captures folded in (count)
- Subtle footer: "This feeds into your next check-in"

Visually: compact, warm background, rounded corners. Lighter than domain cards. The feeling should be "captured" — a receipt that says the system heard you.

### 3.3 Quick Capture

**Purpose:** Friction-free thought capture throughout the day. Not a conversation — just a write operation.

**Input UX:** One button, one action.
- User opens quick capture (from home screen FAB or notification)
- Talks (voice) or types (text)
- Hits save
- Done. No AI response. No conversation. Just: captured.

**Smart routing downstream (system handles classification):**
- If it detects an action item → auto-tag as task, add to backlog
- If it's a thought/reflection → auto-tag as note, route to evening synthesis
- If it's ambiguous → keep as-is, surface in evening for user to triage

**Evening synthesis integration:**
Sage references quick captures during "Close the Day":
- "You dropped a note at 2pm about feeling stuck on the onboarding flow — want to unpack that?"
- Captures are listed in the journal artifact for the permanent record

**On the relationship between quick captures and to-dos:**
These are *related but different*. Quick captures are inputs to the system (thoughts, observations, ideas). To-dos are commitments that require action (implied completion state). The user doesn't always know which they're creating in the moment.

**Design decision:** One input surface, smart routing downstream. The *input* UX is dead simple. The *output* UX is where the intelligence lives. This avoids building a full task management system now — a backlog accumulates and surfaces at the right moments. Task scheduling and project management can come later.

### 3.4 Mid-Day Nudge

**Purpose:** Lightweight accountability check tied to morning intention.

**Trigger:** System-initiated, once per day, mid-afternoon.
**Format:** Push notification or home screen card.
**Content:** References the morning intention specifically:
- "You set an intention to protect your maker block. Still on track?"
- One tap: yes / no / snooze

**Key constraint:** This is NOT a "don't forget to journal!" guilt trigger. It's a micro-accountability moment tied to something the user chose that morning.

---

## 4. Home Screen Redesign

### 4.1 Current Problem

The current home screen tries to be a dashboard AND an entry point AND a status display simultaneously. It shows: reflection prompt, north star, active commitments, next check-in countdown, boundaries, and the voice CTA. Too much cognitive load for a front door.

### 4.2 Design Principle: Concierge, Not Dashboard

The home screen should be **what's happening now and what's next** — time-aware, contextual, action-oriented. Think concierge who knows what time it is, not a wall of status panels.

### 4.3 Content Redistribution

**Moves to Life Map tab:**
- North star narrative (identity-level, changes slowly)
- Active commitments with sub-tasks (direction-level)
- Boundaries (identity-level)
- Quarterly focus areas
- Radar chart remains in Life Map

This makes the Life Map tab richer (currently underutilized — just radar + narrative) and makes the home screen lighter.

**Stays on Home Screen (but becomes contextual):**
- Time-aware greeting
- Primary CTA (changes based on time of day)
- "Something to sit with" reflection prompt (nice touch, keep it)
- Contextual cards (calendar, captures, nudges)
- Quick capture button (persistent, always accessible)

### 4.4 Card-Stack Architecture

The home screen is a prioritized stream of cards that reorder based on time of day. All cards remain scrollable — nothing is hidden, just weighted differently.

**Morning state (before ~11am):**
1. Hero card: "Open your day" CTA
2. Today's calendar summary
3. Yesterday's intention check — did you follow through?
4. Quick capture FAB (persistent)
5. Active commitments (collapsed, tappable to Life Map)
6. "Something to sit with" prompt

**Mid-day state (~11am - 6pm):**
1. Hero card: Quick capture CTA ("Drop a thought")
2. Any unresolved morning intentions flagged
3. Mid-day nudge card (if micro-commitment check is due)
4. Calendar: what's next
5. Quick capture FAB (persistent)
6. Context-aware card (e.g., "Your 1:1 just ended. Anything worth capturing?")

**Evening state (after ~6pm):**
1. Hero card: "Close your day" CTA
2. Today's breadcrumbs (quick captures laid out as mini-timeline)
3. Morning intention recall — "You set out to..."
4. Quick capture FAB (persistent)
5. "Something to sit with" prompt
6. Next check-in (if within 2 days)

### 4.5 The Voice Orb

The large voice button at the bottom of the current screen is beautiful. In the new model, it should be contextual:
- Morning → opens "Open your day" flow
- Mid-day → opens quick capture in voice mode
- Evening → opens "Close your day" flow
- Always accessible as generic "Talk to Sage" via long-press or Chat tab

**Important:** All features remain accessible at all times. The time-based behavior only affects *default action* and *card ordering* — it never removes functionality.

### 4.6 Design Inspirations

- **Spotify:** Different home screen content at 7am vs 10pm. Morning surfaces energetic content, evening surfaces wind-down. Everything still accessible, just ordered differently.
- **Google Maps:** Transitions to dark mode as night falls. Context-aware surfacing of what matters at the moment.
- **Airbnb/Uber:** Completely different feature sets depending on user state (guest vs host). Demonstrates that contextual UX can be dramatic without being confusing.
- **Weather apps:** Visual adaptation to real-time conditions (rain animations, brightness shifts). Shows how ambient context can be communicated through aesthetics, not just content.

**Key UX research finding:** Adaptive UIs can boost task-completion rates by up to 22% and engagement by ~31% (per mobile design trend studies).

---

## 5. Data Architecture

### 5.1 Core Principle: Capture Down, Synthesize Up

The journal entry is the **leaf node** — the smallest, most frequent unit of capture. Everything else (weekly reflections, quarterly reviews, life map updates) is a **computed layer** that runs on top of those leaf nodes.

The journal doesn't need to know about the life map. The life map needs to know about the journals.

Intelligence flows *upward* through the stack — either through Sage during check-ins, through agents built later, or through batch reflection sessions.

### 5.2 Atomic File Types

Each interaction produces a discrete, parseable file:

| File Type | Path | Frequency | Producer |
|---|---|---|---|
| Day Plan | `day-plans/{date}-plan.md` | Daily (morning) | `open_day` session |
| Journal Entry | `daily-logs/{date}-journal.md` | Daily (evening) | `close_day` session |
| Quick Capture | `captures/{date}-{timestamp}.md` | Ad hoc | `quick_capture` |
| Check-In Summary | `check-ins/{date}-checkin.md` | Weekly | `check_in` session |
| Life Map | `life-map/_overview.md` + domain files | Rare updates | `check_in` or agent |
| Life Plan | `life-plan/current.md` | Periodic | `check_in` or agent |
| Sage Context | `sage/context.md` | After each session | System |

### 5.3 Frontmatter Design

Rich frontmatter on atomic files is cheap to generate at write time and expensive to reconstruct later. This metadata powers the agent/synthesis layer.

**Day Plan frontmatter:**
```yaml
date: 2026-02-18
type: day-plan
intention: "Ship the journal module prototype"
energy_morning: high
calendar_events: 3
key_commitments: [meos-build, plaud-prep]
created_at: "2026-02-18T07:45:00+09:00"
```

**Journal frontmatter:**
```yaml
date: 2026-02-18
type: daily-journal
energy: moderate
mood_signal: productive-but-grinding
domains_touched: [career, health]
intention_fulfilled: partial
captures_referenced: 2
connected_to_plan: true
session_depth: standard  # vs quick-checkin vs deep-processing
created_at: "2026-02-18T21:30:00+09:00"
```

**Quick Capture frontmatter:**
```yaml
date: 2026-02-18
type: capture
timestamp: "2026-02-18T14:14:00+09:00"
input_mode: voice
classification: thought  # or task, idea, tension
auto_tags: [meos, onboarding, stuck]
folded_into_journal: true  # updated after evening synthesis
```

### 5.4 Write Permissions by Session Type

This is a critical architectural boundary. Each session type has explicit write access:

| Session Type | Can Write To | Cannot Write To |
|---|---|---|
| `open_day` | `day-plans/`, `sage/context.md` | `life-map/`, `life-plan/` |
| `close_day` | `daily-logs/`, `sage/context.md` | `life-map/`, `life-plan/` |
| `quick_capture` | `captures/` | Everything else |
| `check_in` | `check-ins/`, `life-map/`, `life-plan/`, `sage/context.md` | `day-plans/`, `daily-logs/` |
| `ad_hoc` | `sage/context.md` (soft updates) | Hard writes require elevation |

**Design principle:** Daily sessions don't mutate the life map, but they are *queryable* as a signal source. The boundary is enforced at the tool level, not in prompts. Sage literally cannot write to life map paths during a journal session because the tool won't allow it.

### 5.5 Context Injection by Session Type

Each session type reads different context to stay focused:

**`open_day` reads:**
1. Today's calendar events (from integration)
2. `life-plan/current.md` (active commitments)
3. Last `daily-logs/*.md` entry (yesterday's journal)
4. Any unprocessed `captures/` from yesterday
5. `sage/context.md` (Sage's working model)

**`close_day` reads:**
1. Today's `day-plans/{date}-plan.md` (morning intention)
2. Today's calendar events (what actually happened)
3. Today's `captures/*` (breadcrumbs from the day)
4. `life-map/_overview.md` (priorities, north star — for domain tagging)
5. `sage/context.md`
6. Last `daily-logs/*.md` (yesterday, for continuity)

**`check_in` reads:**
1. All `daily-logs/` since last check-in (the week's journals)
2. All `day-plans/` since last check-in (intention vs reality)
3. All `captures/` since last check-in (unprocessed thoughts)
4. `life-map/` (full life map for deep reference)
5. `life-plan/current.md`
6. Last `check-ins/*.md`
7. `sage/context.md`

This is where the compounding value lives — weekly check-ins become dramatically richer because they synthesize 7 days of structured daily data instead of asking "how was your week?" cold.

---

## 6. Loop Architecture Update

### 6.1 New Loop: Daily Rhythm Loop (PRIMARY retention mechanism)

```
Open the Day → Quick Captures → Mid-day Nudge → Close the Day → Sleep → Open the Day
```

- **Cycle:** 24 hours
- **Reinforcement:** "My day has shape." The user feels oriented in the morning and released in the evening.
- **Status:** NEW — this is the most important addition

This replaces the weekly check-in as the primary retention loop. 7 days is too long for habit formation, especially for ADHD-adjacent users. The daily rhythm closes the post-onboarding gap.

### 6.2 Updated Loop Inventory

| Loop | Cycle | Reinforcement | Status | Change |
|---|---|---|---|---|
| 1. Core Conversation Loop | Real-time | Visible progress | ✅ Working | Unchanged |
| 2. **Daily Rhythm Loop** | **24 hours** | **"My day has shape"** | **🆕 NEW** | **Primary retention** |
| 3. Weekly Check-In Loop | 7 days | "Feeling known" | ⚠️ Partial | Now sits on top of daily data |
| 4. Micro-Commitment Loop | 24 hours | Accountability | ⚠️ Designed | Activated by morning intention + mid-day nudge |
| 5. Pattern Detection Loop | 3+ weeks | "System sees what I can't" | ❌ Not built | Enabled by daily data accumulation |
| 6. Domain Drift Loop | Variable | Proactive intelligence | ❌ Conceptual | Unchanged |
| 7. Trust Ladder / Progression | Weeks-months | Increasing capability | ❌ Designed | Unchanged |
| 8. Recovery Loop | 1-4+ weeks | No guilt, warm return | ❌ Not designed | Unchanged |

### 6.3 Impact on Golden Path

The post-onboarding cliff (GAP 3 from audit) is resolved:

- **Day 0:** Life mapping (the big session)
- **Day 1 morning:** First "Open the Day" — Sage references yesterday's mapping, asks about one intention
- **Day 1 evening:** First "Close the Day" — lightweight, 2 minutes, first journal entry
- **Days 2-6:** Daily rhythm builds habit. Quick captures start appearing naturally.
- **Day 7:** Weekly check-in has 7 days of structured data to synthesize
- **Day 14:** Pattern detection has real data to work with
- **Day 30:** User has ~30 journal entries, ~30 day plans, rich life map trajectory

By the time the first weekly check-in arrives, the user has already built a daily relationship with Sage. The check-in isn't a cold re-engagement — it's a natural deepening.

---

## 7. Market Research: Best-in-Class Patterns

### 7.1 Landscape Summary

The AI journaling market has converged around three archetypes:

**1. Conversational AI Journals (Rosebud, Reflection)**
Core insight: journaling feels like talking to yourself, which is why people quit. Dialogue changes the emotional register. Rosebud's UX loop: write a few lines → AI replies with one curious question → go deeper → session wraps with summary + key insights + auto-tags.

**2. Structured Micro-Journals (Five Minute Journal, Daylio, Grid Diary)**
Solve the blank page problem by removing it. Daylio: mood selection via emoji + activity taps, zero writing required, trend charts over time. Minimum viable entry: 30 seconds.

**3. Framework-Based Thinking Tools (Mindsera, Stoic)**
Use journaling as delivery mechanism for cognitive frameworks (first principles, CBT reframes, Stoic philosophy). Position as "cognitive fitness" not "diary."

### 7.2 Design Patterns to Adopt

**Friction is the enemy, not features.**
Best retention apps all share: trivially small minimum entry. One sentence, one emoji, one voice memo. Perceived commitment matters more than actual time.

**The AI should ask, not assess.**
Users love good follow-up questions. They hate performance reviews. The tone should be curious and supportive, one question at a time.

**Post-entry synthesis is the real value.**
Auto-tagging, pattern detection across entries, and weekly round-ups are the features that create compounding value. The journal entry is the input; the longitudinal insight is the product. Rosebud's weekly reports (3 insights + 3 wins) are consistently cited as the stickiest feature.

**Voice input is table stakes, but fragile.**
Multiple Rosebud reviews call out losing voice recordings as deal-breaking. Lesson: raw capture must be saved *before* any AI processing. Users share vulnerable things — losing content destroys trust instantly.

**The "receipt" pattern matters.**
After an entry, users want a compact artifact that says "captured." Visual confirmation that reflection was received and will compound. This maps to MeOS JournalCard.

**Evening reflection prompts outperform morning.**
5pm+ triggers have higher engagement. The "Resonance" study found AI-generated prompts based on past entries improved positive affect.

### 7.3 MeOS Differentiation

Most journaling apps are **standalone** — they don't connect reflection to an existing system of priorities, commitments, and life domains. MeOS's journal feeds signal into Sage's check-in cycle and life map. The journal is a **sensor, not a destination.** This is the architectural advantage of building inside MeOS rather than as a standalone app.

---

## 8. Agent-Native Technical Architecture

### 8.1 Core Principle

Inspired by Every's agent-native framework: instead of coding every feature, define a few simple tools the AI can use — read file, write file, list files, read calendar — and let Sage combine them via *skills* (text-based instruction sets) to produce the desired outcome.

The session types (`open_day`, `close_day`, etc.) are not hard-coded flows. They are **skills** — markdown files describing the conversational arc, available tools, and read/write permissions. Iterating on the experience means editing text files, not rewriting code.

### 8.2 Tool Set

Atomic, single-purpose tools:

| Tool | Description | Used By |
|---|---|---|
| `read_file` | Read a markdown file from user storage | All sessions |
| `write_file` | Write/update a markdown file (path-restricted by session type) | All sessions |
| `list_files` | List files in a directory (with date/type filtering) | All sessions |
| `read_calendar` | Read today's calendar events from integration | `open_day`, `close_day` |
| `create_capture` | Quick-write a capture file with auto-classification | `quick_capture` |
| `update_context` | Update Sage's working model in `sage/context.md` | All sessions |

### 8.3 Skills (Session-Type Definitions)

Each session type is a skill file that describes:
- **Conversational arc:** Opening, depth rules, closing ritual
- **Available tools:** Which of the above tools this session can use
- **Write permissions:** Which paths the `write_file` tool can target
- **Context injection:** Which files to `read_file` before starting
- **Output format:** Template for the atomic file to produce

Example skill reference (not the full prompt):
```
Skill: close_day
Tools: read_file, write_file, list_files, read_calendar, update_context
Write paths: daily-logs/, sage/
Read context: day-plans/{today}, captures/{today}/*, life-map/_overview.md, sage/context.md
Arc: 1 opening question → max 1 follow-up → synthesis → JournalCard
Duration: 2-3 minutes
Tone: Warm, releasing, not evaluative
```

### 8.4 Guardrails in Tools, Not Prompts

From the Every article: "There's a guarantee in the tool, versus prompts, which are still suggestions."

For MeOS:
- Write permission boundaries enforced at the tool level (journal sessions literally cannot write to life-map paths)
- Quick capture classification is a tool behavior, not a prompt instruction
- Any future destructive actions (deleting entries, modifying life map) require tool-level confirmation parameters

### 8.5 Composability: Emergent Capabilities

With `read_file` + `write_file` + `list_files` + `read_calendar`, Sage can do things never explicitly designed:
- "Compare my last 7 day plans against what actually happened in my journals" → list + read + synthesize
- "What patterns do you see in my quick captures this month?" → list + read + analyze
- "When was the last time I mentioned feeling stuck?" → list + read + search

These aren't features. They emerge from the tool set. This is the agent-native test: unanticipated outcomes from tool composition.

### 8.6 Future-Proofing

The markdown-based data layer is **durable and model-agnostic.** Skills and prompts are the scaffolding that evolves. Data persists. Expect to iterate on skills every few months as models improve, but the atomic files and their frontmatter schemas are the stable layer.

Adding second brain features, project tracking, or research capabilities means: more card types on the home screen, more session types (skills), and more atomic file types. The architecture accommodates this without redesign — as long as the home screen stays a prioritized contextual stream and Sage remains the primary interaction layer.

---

## 9. Integration Mapping

### 9.1 Required for MVP (Daily Rhythm)

| Integration | Access | Purpose | Priority |
|---|---|---|---|
| **Google Calendar** | Read-only | Morning briefing, mid-day context, evening "what happened" synthesis | **P0 — Required** |
| **Voice transcription** (Whisper / Deepgram / native) | Local/API | Voice-first capture and journaling | **P0 — Required** |

### 9.2 High-Value, Post-MVP

| Integration | Access | Purpose | Priority |
|---|---|---|---|
| Contacts / People graph | Read-only | Enrich meeting context (who was in that meeting?) | P1 |
| Location (passive) | Read-only | Context-aware surfacing (home vs office vs traveling) | P2 |

### 9.3 Future "Second Brain" Layer

| Integration | Access | Purpose | Priority |
|---|---|---|---|
| Notes/Docs (Notion, Obsidian) | Read/Write | Quick capture routing to existing knowledge systems | P2 |
| Task managers (Todoist, Things, Linear) | Read/Write | Bidirectional task sync when backlog matures | P2 |
| Health (Apple Health, Oura) | Read-only | Sleep/energy data for pattern detection | P3 |
| Email | Read-only | Context-aware surfacing ("unread from Plaud CEO") | P3 |
| Messaging (Slack, WhatsApp) | Read-only | Much further out, higher complexity | P4 |

**Note:** Calendar alone enables: morning briefing, mid-day contextual nudges, evening "what actually happened" synthesis. It's the 80/20 integration.

---

## 10. UX Architecture Alignment

### 10.1 Three Design Layers (from original audit)

**Layer 1 (Structural UX):** Four tabs remain. Home screen becomes contextual card stack. Life Map tab absorbs identity/direction content. No structural changes to nav.

**Layer 2 (Conversational UX):** Four new session types with designed arcs (`open_day`, `close_day`, `quick_capture`, `ad_hoc`). Each has specific prompt design, duration expectations, and closure rituals.

**Layer 3 (System UX):** New time-awareness capability. The system needs to know *when* it is in the user's day — morning mode vs evening mode vs mid-day context. This is a new dimension of session state awareness identified as the biggest gap in the original audit.

### 10.2 Gap Resolution

| Original Gap | Resolution |
|---|---|
| GAP 1: No session completion ritual | Evening "Close the Day" has designed closing + JournalCard receipt |
| GAP 2: "Talk to Sage" undefined | `ad_hoc` session type with intent triage. Daily sessions provide structured alternatives. |
| GAP 3: Post-onboarding cliff (7-day gap) | Daily rhythm means next event is tomorrow morning, not 7 days away |
| GAP 4: Push notifications | Required for mid-day nudge and evening "Close your day" trigger |
| GAP 6: No session type indication | Each session now has clear label + duration estimate |
| GAP 8: No closure mechanism | Each session type has designed closing sequence |

---

## 11. Open Design Questions

### 11.1 For UI Exploration (Magic Patterns)

1. **Home screen card-stack layout:** How do cards visually shift between morning/mid-day/evening? Subtle reordering or more dramatic state change?
2. **Quick capture surface:** Bottom sheet? Floating button? Full-screen takeover? What feels fastest for "open and talk"?
3. **JournalCard design:** How compact? What information density? How does it differ from domain cards?
4. **Life Map enrichment:** What does the Life Map tab look like with commitments, boundaries, and quarterly focus moved there?
5. **Voice orb behavior:** How does the contextual voice button communicate what it will do at different times of day?
6. **Briefing card (morning):** What does a calendar + priorities + yesterday summary look like in a single glanceable card?
7. **Evening breadcrumbs:** How are quick captures displayed as a timeline before the evening conversation starts?

### 11.2 For Technical Scoping (Claude Code)

1. **Calendar integration:** Google Calendar OAuth + read-only event fetching. Minimum viable: today's events with time, title, attendees.
2. **Session type router:** Extend `detectSessionState` to include time-awareness and route to appropriate session type.
3. **File system setup:** Create directory structure for `day-plans/`, `daily-logs/`, `captures/` with frontmatter parsing.
4. **Skill files:** Create markdown-based skill definitions for `open_day` and `close_day` session types.
5. **Quick capture endpoint:** Minimal write path — voice input → transcription → auto-tag → save to `captures/`.
6. **Home screen API:** Endpoint that returns prioritized card data based on time of day and available context.
7. **Write permission enforcement:** Tool-level path restrictions per session type.

### 11.3 For Product Decisions (Tom)

1. How opinionated should the time-of-day defaults be? (Current proposal: default to time-aware, user can override)
2. Should the morning flow be gated behind evening completion? (Proposal: no — keep them independent)
3. What's the minimum weekly check-in integration? (Proposal: weekly check-in references all daily data automatically)
4. When do we introduce the task backlog vs keeping everything as captures? (Proposal: captures only for MVP, task promotion later)

---

## 12. Milestone Scoping Recommendation

### Phase 1: "Close the Day" (ship first, test stickiness)

Build the evening flow end-to-end:
- `close_day` session type with designed prompt
- Voice-first conversation (2-3 exchanges)
- Journal artifact output with structured frontmatter
- JournalCard component
- Home screen evening CTA ("Close your day")
- File storage to `daily-logs/`

**Why evening first:** It's closest to what Tom already does. The reflection data is richer for testing the synthesis layer. And it validates whether the daily habit sticks before investing in the morning flow.

### Phase 2: "Open the Day" + Calendar Integration

- Google Calendar read-only integration
- `open_day` session type with morning briefing card
- Day plan artifact output
- Home screen morning state
- Intention → evening recall loop (evening references morning plan)

### Phase 3: Quick Capture + Mid-Day Layer

- Quick capture input surface (voice + text)
- Auto-classification (thought vs task vs idea)
- Capture → evening synthesis integration
- Mid-day nudge notification
- Home screen mid-day state

### Phase 4: Weekly Check-In Enhancement

- Weekly check-in now reads from all daily data
- Pattern detection across journals and day plans
- Intention-vs-reality drift analysis
- Richer synthesis powered by 7 days of structured data

---

*This document synthesizes design conversations from February 18, 2026. It is intended as the foundation for milestone scoping, UI exploration, and technical architecture decisions.*