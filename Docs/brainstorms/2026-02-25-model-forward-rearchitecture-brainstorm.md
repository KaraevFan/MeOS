# Model-Forward Rearchitecture Brainstorm

**Date:** 2026-02-25
**Status:** Validated, ready for implementation planning
**Source:** `Docs/model_forward_rearchitecture.md` (strategic plan) + brainstorm session resolving open questions

---

## What We're Building

A model-forward rearchitecture of MeOS that replaces rigid text-block parsing with Claude tool use, rewrites prescriptive session scripts as goal-oriented skills, and unifies the context injection pipeline. The goal: give Sage rich tools and a library of lightweight skills, then let the model figure out how to use them.

This is the bridge from the current architecture (regex parsing, 3,000-4,000 token prescriptive prompts, session-type-branched context) to a tool-native, skill-rich architecture where adding new capabilities is additive (drop a skill file, define tools, done).

---

## Key Decisions

### 1. Timing: After Wave 1 Testing

The rearchitecture happens after Wave 1 external testing completes. Wave 1 data informs which guardrails matter and which are just scaffolding. The rearchitecture becomes the bridge to Milestone 2 — open_day gets built on the new architecture, not the old one.

**Rationale:** Testing with the current architecture first gives real data about which constraints produce better conversations vs. which ones feel scripted. The skill rewrites can be tuned based on this data.

### 2. Tool Design: Hybrid (Content Writes vs. Side-Effect Actions)

**Content-write tools (fire-and-forget):**
- `save_file` — unified tool for all markdown file writes (10 file types: domain, overview, life-plan, check-in, daily-log, day-plan, weekly-plan, sage-context, sage-patterns, capture)
  - Parameters: `file_type` (enum), `file_name?` (string), `content` (string), `attributes?` (object with status, energy, mood_signal, domains_touched, preview_line, etc.)
  - Server executes, always returns `{ success: true }` to Claude
  - No round-trip needed — Claude doesn't need confirmation that a file was saved

**Side-effect tools (agentic loop — result returned to Claude):**
- `complete_session` — marks session/arc complete, triggers summary generation
- `show_pulse_check` — renders interactive pulse check UI, returns user ratings
- `show_options` — renders suggestion pills, returns user's choice
- `enter_structured_arc` — transitions into a structured arc, returns confirmation
- `save_day_plan` — writes structured data to Postgres for home screen
- `emit_reflection_prompt` — saves a deferred reflection prompt

**Rationale:** The "under-fund" principle from Boris Cherny — fewer, more powerful tools. One `save_file` handles all content writes. Side-effect tools get the agentic loop because Claude needs the result to continue the conversation (e.g., pulse check ratings inform the next question).

### 3. Streaming + Tool Execution: Hybrid Loop

**Fire-and-forget tools:** Claude calls `save_file`, stream continues. Server executes the write after Claude's turn. Client shows a subtle inline "saving..." shimmer indicator that dissolves.

**Agentic loop tools:** Stream pauses when Claude calls `complete_session`/`show_pulse_check`/etc. Server executes, sends tool result back to Claude, stream resumes with Claude's continued response. Multiple rounds possible.

**Rationale:** Keeps the common case (file saves) fast with no streaming interruption. Gives Claude agency where it matters (session lifecycle, interactive UI elements).

### 4. Context Injection: Unified, No Branching

Replace the 450-line session-type-branched `fetchAndInjectFileContext()` with a single pipeline:

1. **Context header** (~200 tokens) — structured snapshot for orientation
2. **Standing context** (always): sage/context.md, life-map/_overview.md, life-plan/current.md, weekly plan, sage/patterns.md, pulse check baseline
3. **Temporal context** (always, with timestamps): last 3 check-ins, last 7 daily logs, recent captures, today's day plan, yesterday's day plan + journal, calendar events, flagged domain files

~30% more tokens per request. Negligible at 200k context window. The model judges relevance using the context header.

**Rationale:** Simpler code, fewer bugs, richer model context. Trust the model to ignore irrelevant information rather than filtering it server-side.

### 5. Skill Invocation: Tool Calls for Arcs, Prompt Awareness for Approaches

**Structured arcs** (`open_day`, `close_day`, `weekly_checkin`, `life_mapping`) use the `enter_structured_arc` tool — they have lifecycle, session metadata, artifacts, and completion detection.

**Approach skills** (`domain_deep_dive`, `crisis_support`, `decision_helper`, `pattern_review`, `life_plan_revision`, `capture_review`) are listed in the base Sage prompt. Sage shifts approach naturally without announcing it or making a tool call.

**Context-driven loading** (system layer): API route appends relevant skills based on signals (time-of-day, session state, user request). Replaces the state machine's prompt routing.

**Rationale:** Arcs have real lifecycle — they need formal state transitions. Approaches are just conversational shifts. A good coach doesn't announce "I'm now entering crisis support mode."

### 6. Skill Scope: Ship All 6 New Skills

Ship all 6 proposed approach skills at launch: domain_deep_dive, crisis_support, decision_helper, pattern_review, life_plan_revision, capture_review.

**Rationale:** They're just markdown files — zero infrastructure cost. Observing whether Sage reaches for them organically is valuable data. Cheap to add, cheap to remove.

### 7. Migration: Clean Switch Per Skill

When a skill is migrated to use tools:
- Remove its `[FILE_UPDATE]` / `[SUGGESTED_REPLIES]` format instructions entirely
- Add tool usage guidance in the skill file
- Parser stays alive for unmigrated skills only
- Sprint G removes the parser after all skills are migrated and stable for 1+ week

**Rationale:** No ambiguity about which code path handles output. Each migration is atomic and testable.

### 8. Frontmatter: Structured Attributes via Tool Parameters

Model passes structured data (status, energy, mood_signal, etc.) as tool parameter attributes. Server generates YAML frontmatter. Sage writes markdown body only.

**Rationale:** Consistent with tool-use philosophy — typed inputs, not text parsing. Preserves the current principle.

---

## Architecture Overview

### Tool Classification

| Tool | Type | Loop | Client Indicator |
|------|------|------|-------------------|
| `save_file` | Content write | Fire-and-forget | Subtle "saving..." shimmer |
| `show_options` | Interactive UI | Agentic (waits for user choice) | Option pills rendered |
| `show_pulse_check` | Interactive UI | Agentic (waits for ratings) | Pulse check UI rendered |
| `save_day_plan` | Data write | Fire-and-forget | None (home screen updates) |
| `complete_session` | Lifecycle | Agentic (Sage reacts) | Session completion card |
| `enter_structured_arc` | Lifecycle | Agentic (confirms transition) | Arc header appears |
| `emit_reflection_prompt` | Data write | Fire-and-forget | None (deferred) |

### Skill Library at Launch

| Skill | Type | Tokens | Invocation |
|-------|------|--------|------------|
| `open_conversation` | Base layer | ~2,800 | Always loaded |
| `open_day` | Structured arc | ~350 | Context-driven + tool |
| `close_day` | Structured arc | ~300 | Context-driven + tool |
| `weekly_checkin` | Structured arc | ~450 | Context-driven + tool |
| `life_mapping` | Structured arc | ~500 | Context-driven + tool |
| `domain_deep_dive` | Approach | ~350 | Prompt awareness |
| `crisis_support` | Approach | ~300 | Prompt awareness |
| `decision_helper` | Approach | ~300 | Prompt awareness |
| `pattern_review` | Approach | ~250 | Prompt awareness |
| `life_plan_revision` | Approach | ~250 | Prompt awareness |
| `capture_review` | Approach | ~250 | Prompt awareness |

**Total skill tokens loaded per session:** ~2,800 (base) + ~350-500 (context-driven skill) + ~200 (skill directory listing) = ~3,350-3,500 tokens. Down from ~4,000-7,000 per session currently.

### Sprint Sequence

| Sprint | Focus | Effort | Depends On |
|--------|-------|--------|------------|
| A | Tool use foundation (`save_file` + `show_options` + agentic loop) | 3-4 days | None |
| B | Skill rewrites (4 existing skills → goal-oriented) | 2-3 days | None (parallel with A) |
| C | Context injection unification | 2-3 days | None (parallel with A) |
| D | Extended tools (`save_day_plan`, `complete_session`, `show_pulse_check`, `enter_structured_arc`, `emit_reflection_prompt`) | 2-3 days | Sprint A |
| E | New skill files (6 approach skills + base prompt skill awareness) | 2-3 days | Sprint A |
| F | Skill invocation mechanism (context-driven loading + composition testing) | 2-3 days | Sprints D + E |
| G | Legacy cleanup (remove parser, format instructions, completion-detection string matching) | 1-2 days | All stable 1+ week |

**Total estimated effort:** 16-23 days

---

## Open Questions (Remaining)

### Requires User Testing Data (Wave 1)
1. Which skill guardrails actually prevent bad conversations vs. constrain good ones?
2. Does the pre-checkin warmup add value, or should it become part of the check-in skill?
3. Do users notice the quality difference between scripted and goal-oriented skills?

### Requires Technical Investigation (Sprint A)
4. How does streaming + tool use UX feel in practice with the hybrid loop?
5. What's the right `max_tokens` with tool definitions in context? (Plan says 4096, may need tuning)
6. How does parallel tool execution affect streaming UX?

### Strategic Decisions (Deferred)
7. Should skills be visible to the user? ("Sage is using: Domain Deep Dive")
8. Should users be able to request specific skills? ("Do a pattern review")
9. When to start building agentic tools (calendar write, reminders, web search)?

---

## What We're NOT Doing

- Not restructuring the data model (markdown-native storage stays)
- Not changing the frontend card rendering architecture (already model-forward)
- Not building agentic execution tools (Ring 4 — Q2 scope)
- Not changing the two-layer conversation model (open_conversation + arcs)
- Not reducing the number of skills (expanding from 5 to 11)
- Not doing this before Wave 1 testing
