# MeOS Rearchitecture Plan: Model-Forward Evolution

## Purpose

This document is the single source of truth for rearchitecting MeOS toward a model-forward architecture. It synthesizes insights from the Boris Cherny (Head of Claude Code) interview, a comprehensive codebase audit, and strategic product thinking. Use this document as context for implementation planning and brainstorming with Claude Code.

**This is a living strategic document, not a spec.** It defines the direction, the rationale, the trade-offs, and the candidate changes. Actual implementation specs should be derived from this after reviewing the specific recommendations and confirming priorities.

---

## Part 1: Strategic Principles

### 1.1 The Core Insight: Don't Box the Model In

From Boris Cherny (Head of Claude Code at Anthropic, Feb 2026 interview with Lenny Rachitsky):

> "Almost always you get better results if you just give the model tools, you give it a goal, and you let it figure out. A year ago you actually needed a lot of the scaffolding, but nowadays you don't really need it."

> "Maybe scaffolding can improve performance maybe 10%, 20%, something like that, but often these gains just get wiped out with the next model. So, it's almost better to just wait for the next one."

> "From the very beginning, we bet on building for the model six months from now. Not for the model of today."

> "The product is the model. We want to expose it. We want to put the minimal scaffolding around it. Give it the minimal set of tools."

The implication for MeOS: we should give Sage rich tools and a rich library of goal-oriented skills, while removing the rigid scripts and choreography that constrain the model's natural conversational ability.

### 1.2 The Bitter Lesson Applied to MeOS

Rich Sutton's "Bitter Lesson": the more general approach will always outperform the more specific approach over time. Applied to MeOS:

- **Specific approaches that should go:** Rigid 5-beat scripts, 7 HARD RULES, prescribed question order, regex parsers extracting structured data from text streams
- **General approaches that should stay and grow:** A well-prompted Sage persona, a rich tool set for actions, a library of goal-oriented skills the model can draw on, rich context injection

The critical distinction: **having many skills is general; having prescriptive scripts is specific.** A library of 15 goal-oriented skills that Sage can invoke based on judgment is more model-forward than a single merged prompt. The problem was never "too many skills" — it was "skills written as scripts instead of goals."

### 1.3 The Claude Code Parallel

Claude Code itself doesn't operate with one giant undifferentiated prompt. It has:
- A base persona and capabilities
- Skills — focused instruction sets loaded based on context
- Tools it can call
- The model decides when to apply which skill

MeOS's two-layer architecture (open_conversation base + ENTER_MODE arc transitions) already mirrors this. The `open_conversation` skill is the base layer. Structured arcs are skills that get invoked. The PRD captured this instinct: *"Each session type is a skill (a text-based description of the arc, tools, permissions, and output format), not hard-coded logic."*

The rearchitecture doesn't reduce this to one prompt — it makes the skill library richer, writes each skill as a goal instead of a script, and gives the model more agency over when to invoke them.

### 1.4 Principles for the Rearchitecture

1. **Tools for actions, skills for approaches.** Tools are the *things Sage can do* (save files, show UI elements, update data). Skills are the *approaches Sage can adopt* (morning intention-setting, domain exploration, crisis support). Both libraries should grow over time.

2. **Goals over scripts.** Each skill defines what a good session achieves ("help the user set an intention for their day in ~2 minutes") and what artifacts to produce, not how to proceed step-by-step ("Beat 1: Grounding. Beat 2: Highlight...").

3. **Context over control flow.** Inject rich context (time of day, life map state, session history, calendar) and let the model decide which skill to draw on, rather than routing through a state machine to separate prompts.

4. **Composable skills.** A weekly check-in that surfaces a domain in crisis should be able to draw on the domain deep-dive skill mid-conversation. Skills are approaches Sage can blend, not silos that wall off other capabilities.

5. **More skills, less prescription.** The value isn't in having fewer skills — it's in having skills that are written as goals (300-800 tokens) rather than scripts (3,000-4,000 tokens), and a model that has the judgment to choose between them.

6. **Preserve product decisions, remove implementation scaffolding.** Time constraints ("2 minutes for morning sessions"), output requirements ("produce a domain file with these fields"), and interaction patterns (pulse check, domain cards) are product decisions that stay. Rigid beat sequences, HARD RULES, and "NEVER deviate" instructions are scaffolding that goes.

7. **Build for the model six months from now.** If a guardrail exists because the model isn't good enough yet, plan to remove it. If it exists because it's a genuine product decision, keep it — but express it as a constraint, not a script.

8. **Incremental migration with rollback.** Never break what works. Add the new path alongside the old, test, then remove the old. Keep parser code as fallback during tool migration.

9. **User testing before major restructuring.** The separate skills give independent dials to tune. Don't fundamentally restructure until user testing data tells us which guardrails matter.

### 1.5 The Long-Term Vision

The endgame architecture: **Sage has a base persona, a growing library of goal-oriented skills, and a rich tool set. Context determines which skills are relevant. Sage has agency over which to invoke.**

Instead of:
- A state machine routing to one of 6 session types
- Each session type with a 3,000-4,000 token prescriptive script
- Text-block parsing for structured output
- Skills that can't compose with each other

We'd have:
- A base Sage prompt (personality, principles, tool definitions) — always loaded
- 15+ lightweight skills (300-800 tokens each) — loaded by context or invoked by the model
- A rich tool set for actions (save files, show UI, update data)
- Skills that compose naturally (check-in draws on domain exploration, morning session draws on crisis support if needed)
- Context injection that gives Sage everything it needs to choose wisely

New capabilities are additive: drop a new skill file into the library, define any new tools it needs, and Sage can immediately use it. No state machine changes, no new prompt routing, no parser updates.

---

## Part 2: Current Architecture Assessment

### 2.1 What's Working Well (Preserve)

These are genuine architectural assets that should not be changed:

**Frontend card rendering is already model-forward.** `MessageBubble` dispatches on parsed segment type (`blockType`), never on session mode. A domain card, journal entry, or pulse check renders identically regardless of what "session type" triggered it. This means tool-call-driven cards can be added as a new segment source alongside the existing parser. No frontend surgery required.

**The two-layer conversation architecture is proto-agentic.** `open_conversation` as a base layer with `[ENTER_MODE]` transitions into structured arcs is the right abstraction. The model already decides when to enter a structured arc. This maps naturally to the skill-invocation architecture.

**Markdown-native storage is context-optimal.** Domain files, life plan, journal entries, check-in summaries as markdown with YAML frontmatter — the model reads these natively. No ORM translation, no schema mismatch. The `file_index` table provides fast queries without reading all files. This scales naturally with better models.

**The Life Map data model is the moat.** Eight domains, structured fields, longitudinal tracking, cross-cutting synthesis — this is what makes MeOS more than "talk to Claude." The model should have maximum freedom in how it populates and updates this structure, but the structure itself is sacred.

**The `open_conversation` skill demonstrates the target state.** At 1.5/5 prescriptiveness, it's the least scaffolded and the most natural-feeling conversation mode. The audit found an inverse relationship between prescriptiveness and conversational quality. This is our existence proof — and it's the natural base layer for the skill architecture.

**The skill file concept is right.** Loading contextual instruction sets from markdown files (`skills/open-day.md`, etc.) is the correct pattern. The problem is what's *inside* the skill files (rigid scripts), not the architecture of having separate loadable skills.

### 2.2 What Needs to Change

#### Problem 1: No Tool Use (Highest Priority)

Claude operates in pure text mode. All structured output relies on regex parsing of custom block tags (`[FILE_UPDATE]`, `[SUGGESTED_REPLIES]`, `[DAY_PLAN_DATA]`, etc.) embedded in the response stream. This is the single largest architectural debt.

- File: `app/api/chat/route.ts` — `anthropic.messages.stream()` has no `tools` parameter
- File: `lib/parser.ts` (691 lines) — regex-based extraction of 10+ block types
- File: `lib/file-write-handler.ts` — resolves parsed blocks to file writes
- File: `lib/completion-detection.ts` — string matching for session lifecycle events

**Impact of fixing:** Eliminates regex parsing brittleness, enables agentic capabilities, makes completion detection a callback instead of string matching, and gives Sage explicit control over UI elements. Unblocks everything else.

#### Problem 2: Skills Written as Scripts, Not Goals

11 prompt templates totaling ~15,000-17,000 tokens, ranging from 1.5/5 to 5/5 prescriptiveness:

| # | Skill | File | ~Tokens | Prescriptive | Core Problem |
|---|-------|------|---------|-------------|--------------|
| 1 | Open Day | skills/open-day.md | 3,800-4,200 | 5/5 | Rigid 5-beat script, 7 HARD RULES, "NEVER deviate" |
| 2 | Life Mapping | prompts.ts:51-281 | 3,200-3,500 | 4.5/5 | 6-step domain arc, prescribed question order and depth |
| 3 | Weekly Check-in | prompts.ts:365-460 | 1,400-1,600 | 4/5 | 6-step sequence, rigid closing |
| 4 | Close Day (prompt) | prompts.ts:283-363 | 1,100-1,300 | 3.5/5 | 7-step sequence |
| 5 | Pre-Checkin Warmup | route.ts:66-70 | 80-120 | 4/5 | 2 rigid questions |
| 6 | Close Day Skill | skills/close-day.md | 1,200-1,400 | 3/5 | Reasonable but could be lighter |
| 7 | Open Conversation | skills/open-conversation.md | 2,800-3,200 | 1.5/5 | Already good — this is the model |

**The fix isn't fewer skills — it's rewriting each skill as a goal (300-800 tokens) instead of a script (1,500-4,200 tokens).** Then expanding the library with new skills we don't have yet.

#### Problem 3: Session-Type-Coupled Context Injection

The `fetchAndInjectFileContext()` function in `context.ts` is 450 lines with 14 conditional sections branching on session type. Calendar data, daily logs, captures, and temporal context are injected differently for each session type.

**The fix:** A single pipeline that injects all available context with a snapshot header, letting the model determine relevance. Simpler code, fewer bugs, better model behavior from richer context.

#### Problem 4: Rigid Skill Invocation

Currently skills are invoked by the state machine (state → session type → prompt load) with limited model agency. The `ENTER_MODE` mechanism allows model-driven invocation, but only from `open_conversation` into arcs, not the other direction. A user in a weekly check-in who wants to go deep on a domain can't invoke that skill.

**The fix:** Extend skill invocation so the model can draw on any skill from any context, and skills can compose naturally.

### 2.3 Architecture Flow (Current State)

```
┌─────────────────────────────────────────────────────┐
│                    USER INPUT                        │
│         (voice → transcribe → text, or text)         │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                POST /api/chat                        │
│                                                      │
│  State machine → session type → skill/prompt load    │
│  Context injection (session-type-branched, 450 lines)│
│  Auth, rate limiting, ownership                      │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│           CLAUDE (text-only, no tools)                │
│                                                      │
│  System prompt = session-specific script              │
│    + FILE_UPDATE format instructions                 │
│    + SUGGESTED_REPLIES format                        │
│    + life context from markdown files                │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              SSE STREAM → CLIENT                     │
│                                                      │
│  Server: string matching for blocks + completion     │
│  Client: parseMessage() → SegmentRenderer (generic)  │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                  PERSISTENCE                         │
│  Regex-parsed blocks → file writes + DB updates      │
│  Async summary generation (separate Haiku call)      │
└─────────────────────────────────────────────────────┘
```

### 2.4 Architecture Flow (Target State)

```
┌─────────────────────────────────────────────────────┐
│                    USER INPUT                        │
│         (voice → transcribe → text, or text)         │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                POST /api/chat                        │
│                                                      │
│  CONTEXT ASSEMBLY (unified, not session-branched):   │
│  • Context header (status snapshot for orientation)  │
│  • All standing context (always)                     │
│  • All temporal context (always, with timestamps)    │
│                                                      │
│  SKILL LOADING:                                      │
│  • Base Sage prompt (always)                         │
│  • Context-driven skills (morning → open_day skill)  │
│  • Active arc skill (if in structured arc)           │
│  • Available skills list (for model-driven invoke)   │
│                                                      │
│  TOOL DEFINITIONS (always):                          │
│  • save_file, show_options, save_day_plan, etc.      │
│  • complete_session, show_pulse_check, etc.          │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│         CLAUDE (with tools, streaming)               │
│                                                      │
│  Base Sage prompt                                    │
│    + loaded skill guidance (goal-oriented, light)    │
│    + context header + full life context              │
│    + tool definitions                                │
│                                                      │
│  Sage decides:                                       │
│  • Which skill approach fits this moment             │
│  • When to invoke tools                              │
│  • When to transition, compose, or wrap up           │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              SSE STREAM → CLIENT                     │
│                                                      │
│  Stream events:                                      │
│  • { text } — conversational response (streamed)     │
│  • { toolCall: { name, input } } — action taken      │
│  • { toolResult: { ... } } — action result           │
│  • { sessionCompleted } — session lifecycle          │
│                                                      │
│  Client rendering:                                   │
│  • Text → MessageBubble (existing)                   │
│  • Tool calls → card rendering (new path)            │
│  • Both paths coexist via SegmentRenderer            │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                  PERSISTENCE                         │
│                                                      │
│  Tool execution handlers (server-side):              │
│  • save_file → Storage write + file_index update     │
│  • save_day_plan → Postgres write                    │
│  • complete_session → session status + summary gen   │
│  • detect_patterns → patterns table + markdown       │
│                                                      │
│  Data model unchanged:                               │
│  • Markdown files with YAML frontmatter              │
│  • file_index for fast queries                       │
│  • Postgres for orchestration                        │
└─────────────────────────────────────────────────────┘
```

---

## Part 3: The Skill Library

### 3.1 Skill Architecture

Each skill is a markdown file in the `skills/` directory that defines:

```markdown
# Skill Name

## Goal
What this skill achieves, in 1-2 sentences. This is what "good" looks like.

## When to Use
Context signals that suggest this skill is appropriate. Helps both the 
context-driven loader and the model's own judgment.

## Context Needed
What data is particularly relevant for this skill (the unified context 
pipeline injects everything, but this tells Sage what to prioritize).

## Tools to Use
Which tools are particularly relevant and what artifacts to produce.

## Constraints
Real product boundaries (time limits, output requirements, interaction caps).

## Guidance
Light principles for approach — the "how" expressed as values and patterns, 
not as a step-by-step script. 2-5 bullet points, not 20.
```

**Target: 300-800 tokens per skill.** Compared to current 1,500-4,200 tokens per script.

**Skill loading works two ways:**
1. **Context-driven:** The system appends relevant skills based on signals (time of day, session state, user request). Morning with no day plan → `open_day` skill loaded. Check-in due → `weekly_checkin` skill loaded.
2. **Model-driven:** Sage sees the available skills and can draw on any approach mid-conversation. A check-in that surfaces a domain crisis can draw on `domain_deep_dive`. A morning session where the user seems overwhelmed can draw on `crisis_support`.

### 3.2 Rewritten Existing Skills

#### `open_day` (currently 5/5, target 3/5)

```markdown
# Open Day — Morning Intention Session

## Goal
Help the user set a clear intention for their day. They should leave feeling 
focused and lighter, not loaded.

## When to Use
Morning sessions, or when the user asks to plan their day.

## Context Needed
- Today's calendar events
- Yesterday's day plan and journal reflection
- Active life plan priorities and weekly focus
- Any captures since last session

## Tools to Use
- save_file (type: "day-plan") — persist the morning plan
- save_day_plan — structured data for home screen
- show_options — if user needs help choosing a focus

## Constraints
- 5-6 exchanges maximum. This is a 2-minute ritual, not a therapy session.
- Don't go deep on emotions or life questions — that's for check-ins.
- Don't invent priorities. Work from their life plan and calendar.

## Guidance
- Start with something grounding — a quick emotional check-in, reference to 
  yesterday, or acknowledgment of what's ahead
- Help them identify the ONE thing that would make today feel successful
- Reference their actual calendar and priorities, not generic advice
- If they seem stressed or overwhelmed, help them choose less, not more
- End with energy and a clean send-off
- Use your judgment about the flow. Some mornings need more grounding, 
  some need more planning. Read the moment.
```

~350 tokens. Down from ~4,000 tokens. Preserves all product decisions (timing, intention focus, output requirements, tone). Removes all scripts (5-beat sequence, HARD RULES, "NEVER deviate").

#### `life_mapping` (currently 4.5/5, target 3/5)

```markdown
# Life Mapping — Domain Exploration

## Goal
Build a structured, honest map of where the user is across their life domains. 
They should feel seen and understood, and see their life map taking shape in 
real time as they talk.

## When to Use
First-time users (onboarding), or when a user wants to revisit and update 
their full life map.

## Context Needed
- Pulse check ratings (if completed — these guide where to start)
- Any existing domain files (for updates vs. first mapping)
- Session history (for returning users)

## Tools to Use
- show_pulse_check — to get initial ratings (first time) or re-ratings
- save_file (type: "domain") — save each domain as explored
- save_file (type: "overview") — save the synthesis/overview
- save_file (type: "life-plan") — if user engages with planning
- show_options — offer domain choices, continue/wrap-up decisions

## Constraints
- Aim for at least 3-4 domains in first session for a useful initial map.
- Each domain should produce a saved domain file with: current state, what's 
  working, what's not, key tension, stated intention, status rating.
- The synthesis should include: narrative summary, primary compounding engine, 
  top 3 priorities, key tensions, anti-goals.

## Guidance
- Start with the lowest-rated domains from the pulse check — that's where 
  the energy and insight live
- For each domain: understand current state, surface tensions, and land on a 
  stated intention. Don't ask all these mechanically — follow the conversation
- Go deeper on domains with more tension and energy, lighter on stable ones
- Offer a "lightweight pass" for domains rated thriving/good
- After each domain, save the domain file and offer choices for what's next
- Name emotions and tensions the user hasn't articulated yet
- When wrapping up, pull everything together into a narrative synthesis
- The first domain conversation will naturally be longest. That's fine — the 
  user is learning how this works. Later domains can be quicker.
- Challenge gently when someone lists too many priorities or says "everything's 
  fine" in a domain where the pulse check said otherwise
```

~500 tokens. Down from ~3,400 tokens. Preserves the product decisions (domain coverage, output requirements, synthesis format, conversational approach). Removes the rigid 6-step arc, prescribed depth rules ("1st domain 6-10 exchanges, 2nd 4-6"), and question-by-question script.

#### `weekly_checkin` (currently 4/5, target 2.5/5)

```markdown
# Weekly Check-In — Reflection and Recalibration

## Goal
Help the user reflect on their week, notice patterns, and set one clear 
intention for the week ahead. They should feel understood, not evaluated.

## When to Use
Weekly cadence (7 days since last check-in), or when user requests a check-in.

## Context Needed
- Life map overview and domain states
- Daily logs and day plans from the past week
- Captures since last check-in
- Previous check-in summary (what they said they'd focus on)
- Active patterns
- "Week in Numbers" data if available

## Tools to Use
- show_pulse_check — optional re-rating of domains
- save_file (type: "check-in") — save check-in summary
- save_file (type: "domain") — update any domains that shifted
- save_file (type: "weekly-plan") — save next week's focus
- save_file (type: "sage-patterns") — update pattern observations
- show_options — for direction choices during the conversation

## Constraints
- 5-10 minutes. Respect their time.
- Must produce a check-in summary with: themes, sentiment, commitments, 
  life map updates, patterns observed.
- This is NOT a performance review. Never judge.

## Guidance
- Open warm and simple. Let them talk about how the week felt.
- Reference specific things from their daily logs and captures — show you 
  were paying attention to their week, not starting cold
- Compare intention vs. reality gently: what they said they'd do vs. what 
  their logs show actually happened
- If patterns are emerging (3+ weeks of the same obstacle), name them with 
  curiosity, not judgment
- If they didn't follow through, explore with "what got in the way?" not 
  "why didn't you do it?"
- Close with one forward-looking intention for next week
- If they seem burned out, suggest doing less, not pushing harder
- Update the life map for any domains that shifted
```

~450 tokens. Down from ~1,500 tokens.

#### `close_day` (currently 3.5/5, target 2.5/5)

```markdown
# Close Day — Evening Reflection

## Goal
Help the user close out their day in 2-3 minutes. They should feel like 
they've emptied their head and can rest. The journal is a byproduct of the 
ritual, not the purpose.

## When to Use
Evening sessions, or when user asks to reflect on their day.

## Context Needed
- Today's day plan (morning intention and priorities)
- Today's captures
- Calendar events from today
- Current life map state (for domain tagging)

## Tools to Use
- save_file (type: "daily-log") — save the journal entry with metadata 
  (energy, mood_signal, domains_touched, preview_line)
- show_options — if helpful for direction

## Constraints
- 2-3 minutes, 3-5 exchanges. Quick and clean.
- Journal entry must include: energy level, mood signal, domains touched, 
  and a preview line for the history view.

## Guidance
- Reference their morning intention — did the day go as planned?
- Ask one specific question, not a generic "how was your day?"
- If they had captures today, weave those in
- Help them notice one thing worth carrying forward
- Keep it light. Evening is for closing, not opening new threads.
```

~300 tokens. Down from ~1,300 tokens.

#### `open_conversation` (currently 1.5/5, keep as-is)

This skill is already well-written and serves as the base layer. Minor adjustments:

- Add awareness of the full skill library so Sage knows what approaches are available
- Strengthen the `ENTER_MODE` / skill invocation guidance
- Otherwise preserve — this is the model for what good skills look like

### 3.3 New Skills to Build

These expand Sage's capability without requiring new engineering infrastructure — they're just new skill files that leverage existing tools.

#### `domain_deep_dive`

```markdown
# Domain Deep Dive — Focused Domain Exploration

## Goal
Go deep on a single life domain. Surface what's really going on, update the 
domain file, and help the user clarify what they want to change.

## When to Use
- User says "I need to talk about [domain]"
- A domain is flagged as needs_attention or in_crisis
- Sage notices a domain has been avoided across multiple sessions
- During a check-in where a specific domain needs more attention than the 
  check-in format allows

## Context Needed
- Current domain file (existing understanding)
- Recent mentions of this domain in daily logs and captures
- Patterns related to this domain
- Pulse check ratings (current vs. baseline)

## Tools to Use
- save_file (type: "domain") — update the domain file
- save_file (type: "sage-patterns") — if new patterns emerge

## Guidance
- Start from what you already know, not from scratch
- Go deeper than the standard mapping — explore underlying beliefs, fears, 
  and desires that drive the surface-level tensions
- Name what you see, especially things the user might be avoiding
- Land on a revised stated intention if the old one no longer fits
- This can be 5-15 minutes. Follow the energy.
```

#### `crisis_support`

```markdown
# Crisis Support — Emotional Grounding

## Goal
Be present for a user who is overwhelmed, anxious, or in distress. Help them 
feel heard and grounded. No structured output pressure.

## When to Use
- User expresses being overwhelmed, panicked, or in emotional distress
- Sage detects high emotional intensity that doesn't fit a structured session
- User explicitly says they need to vent or talk through something hard

## Tools to Use
- save_file (type: "sage-context") — quietly update Sage's model of the user
- save_file (type: "sage-patterns") — note the episode if part of a pattern
- Do NOT use save_file for journals or domain updates during crisis — don't 
  interrupt the emotional flow with "saving your thoughts" signals

## Constraints
- No time limit. Follow the user's pace.
- Do not redirect to structured sessions (check-in, planning) until the 
  user is ready.
- If the situation suggests professional support would help, mention it 
  gently and once. Don't nag.

## Guidance
- Listen first. Mirror back what you hear. Don't rush to solutions.
- Validate without being performatively positive
- Help them identify one grounding thought or small next action when they're 
  ready — not before
- After they've processed, gently offer: "Want to update anything in your 
  life map based on this, or just leave it for now?"
```

#### `decision_helper`

```markdown
# Decision Helper — Values-Based Decision Support

## Goal
Help the user think through a specific decision using their life map values 
and priorities as a framework. They should feel clearer about what they want, 
not told what to do.

## When to Use
- User presents a fork-in-the-road decision ("should I take this job?", 
  "should I move?", "should I end this?")
- User is weighing options and going in circles

## Context Needed
- Full life map (values, tensions, priorities, anti-goals)
- Life plan (current commitments and quarter theme)
- Relevant domain files

## Tools to Use
- show_options — if useful for framing alternatives
- save_file (type: "sage-context") — update understanding based on decision

## Guidance
- Don't give advice. Help them see the decision through their own stated 
  values and priorities
- Surface relevant tensions from the life map ("You said you value X, but 
  this option optimizes for Y — how do you think about that tradeoff?")
- Help them articulate what they're actually afraid of
- Reference their anti-goals — is one option pulling them toward something 
  they explicitly said they wouldn't pursue?
- If they're stuck in analysis paralysis, ask: "If you had to decide in 
  the next 60 seconds, which way do you lean?"
```

#### `pattern_review`

```markdown
# Pattern Review — Surfacing Behavioral Patterns

## Goal
Help the user see and make sense of recurring patterns across their recent 
sessions, journals, and captures.

## When to Use
- Sage has accumulated enough observations across 3+ sessions
- User asks "what patterns do you see?" or "what have you noticed?"
- During a monthly or quarterly review
- When a specific pattern feels important enough to name

## Context Needed
- sage/patterns.md (accumulated observations)
- Recent check-in summaries
- Daily logs from the past 2-4 weeks
- Domain files (for pattern-domain connections)

## Tools to Use
- save_file (type: "sage-patterns") — update pattern observations
- show_options — if the user wants to focus on specific patterns

## Guidance
- Present patterns as observations, not diagnoses: "I've noticed X 
  happening three weeks in a row" not "You have a problem with X"
- Connect patterns to domain tensions where relevant
- Ask whether the pattern is something they want to change, accept, or 
  explore further
- Some patterns are positive — name those too
```

#### `life_plan_revision`

```markdown
# Life Plan Revision — Quarterly Recalibration

## Goal
Revisit and update the quarterly life plan: theme, anchor projects, 
maintenance habits, anti-goals.

## When to Use
- Quarter transition approaching
- User's circumstances have shifted significantly
- Check-in reveals the current plan no longer fits
- User asks to revisit their plan

## Context Needed
- Current life plan
- Life map overview (priorities, tensions, compounding engine)
- Recent check-in summaries showing intention vs. reality gap

## Tools to Use
- save_file (type: "life-plan") — save updated plan
- show_options — for choosing focus areas

## Guidance
- Review what's working and what's not in the current plan
- Reference the life map's compounding engine and priorities
- Help them choose less, not more — 1-2 anchor projects max
- Define clear "done" criteria and kill criteria for each project
- Explicitly name anti-goals — what they're NOT doing this quarter
```

#### `capture_review`

```markdown
# Capture Review — Processing Accumulated Thoughts

## Goal
Help the user review and make sense of their accumulated quick captures. 
Categorize, connect to domains, surface themes, identify action items.

## When to Use
- User has 5+ unprocessed captures
- User asks "what have I been capturing?" or "review my notes"
- During a check-in if captures reveal patterns

## Context Needed
- All recent captures with timestamps and classifications
- Life map domains (for categorization)
- Active intentions (for relevance)

## Tools to Use
- show_options — for grouping/prioritization choices
- save_file (type: "domain") — if captures reveal domain updates
- save_file (type: "sage-context") — update understanding

## Guidance
- Group captures thematically, not chronologically
- Surface connections the user might not see ("Three of your captures this 
  week are about the same underlying tension with your manager")
- Help them decide: act on, save for later, or let go
- Don't turn every capture into a task — some are just observations
```

### 3.4 Skill Invocation Mechanism

**Context-driven loading (system layer):**

The API route determines which skills to append based on context signals:

| Signal | Skill Loaded |
|--------|-------------|
| New user, no life map | `life_mapping` |
| Morning, no day plan today | `open_day` |
| Evening, day plan exists, no journal | `close_day` |
| Check-in due or overdue | `weekly_checkin` |
| None of the above | Base Sage only (open_conversation equivalent) |

This replaces the state machine's prompt routing. The state machine still handles session lifecycle (scheduling, resume, status tracking) — it just doesn't determine the full prompt anymore.

**Model-driven invocation (Sage's agency):**

The base Sage prompt includes awareness of all available skills:

```
You have the following skill approaches available. Draw on them when the 
conversation calls for it:
- domain_deep_dive: Go deep on a single life domain
- crisis_support: Emotional grounding when user is overwhelmed
- decision_helper: Values-based decision support
- pattern_review: Surface and discuss behavioral patterns
- life_plan_revision: Revisit the quarterly plan
- capture_review: Process accumulated quick captures

You don't need to announce when you're using a skill. Just shift your 
approach naturally. Skills can compose — a check-in can include a domain 
deep dive, a morning session can shift to crisis support if needed.
```

**Skill composition:**

Skills are approaches, not modes. Sage can blend them:
- Weekly check-in surfaces a domain in crisis → draws on `domain_deep_dive` approach
- Morning session reveals the user is overwhelmed → shifts to `crisis_support`
- Open conversation where user asks "should I take this job?" → draws on `decision_helper`
- Pattern review surfaces a life plan misalignment → transitions to `life_plan_revision`

This is the natural evolution of the existing `ENTER_MODE` mechanism, but more fluid and less binary.

---

## Part 4: Tool Definitions

### 4.1 Sprint A Tools (Foundation)

These two tools handle ~80% of structured output and establish the pattern for all future tools.

#### `save_file`

```typescript
{
  name: "save_file",
  description: "Save or update a markdown file in the user's data store. Use this to persist domain summaries, life map overviews, life plans, check-in summaries, journal entries, day plans, sage context, and pattern observations. Each file type has specific conventions — follow the type descriptions.",
  input_schema: {
    type: "object",
    required: ["file_type", "content"],
    properties: {
      file_type: {
        type: "string",
        enum: [
          "domain",           // Life map domain file (e.g., career, health)
          "overview",         // Life map overview/synthesis
          "life-plan",        // Active life plan
          "check-in",         // Check-in summary
          "daily-log",        // Evening journal/reflection
          "day-plan",         // Morning day plan
          "weekly-plan",      // Weekly priorities and focus
          "sage-context",     // Sage's working model of the user
          "sage-patterns",    // Observed behavioral patterns
          "capture"           // Quick capture/thought
        ],
        description: "The type of file to save. Determines storage path and indexing behavior."
      },
      file_name: {
        type: "string",
        description: "Name identifier for the file. Required for domain files (e.g., 'career', 'health'). For date-based files (daily-log, day-plan, check-in), defaults to today's date if not provided."
      },
      content: {
        type: "string",
        description: "Markdown content of the file. Include YAML frontmatter where appropriate (status, updated_rating, energy, mood_signal, domains_touched, etc.)."
      },
      attributes: {
        type: "object",
        description: "Optional structured attributes for file indexing and metadata.",
        properties: {
          status: { type: "string", enum: ["thriving", "good", "okay", "needs_attention", "in_crisis"] },
          updated_rating: { type: "string" },
          energy: { type: "string" },
          mood_signal: { type: "string" },
          domains_touched: { type: "array", items: { type: "string" } },
          preview_line: { type: "string", description: "Short summary for card display" }
        }
      }
    }
  }
}
```

#### `show_options`

```typescript
{
  name: "show_options",
  description: "Display interactive option buttons to the user. Use when offering choices like which domain to explore next, whether to continue or wrap up, or any branching decision. The user taps one and their choice is sent as their next message.",
  input_schema: {
    type: "object",
    required: ["options"],
    properties: {
      options: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 8,
        description: "Option labels to display as tappable buttons. Keep concise (2-6 words)."
      },
      context: {
        type: "string",
        description: "Internal context for why these options are being offered. Not shown to user."
      }
    }
  }
}
```

### 4.2 Sprint D Tools (Extended Set)

#### `save_day_plan`

```typescript
{
  name: "save_day_plan",
  description: "Save structured day plan data for the home screen and day plan view. Call at the end of a morning session or when helping the user plan their day.",
  input_schema: {
    type: "object",
    required: ["intention", "priorities"],
    properties: {
      intention: { type: "string", description: "Primary intention for the day" },
      priorities: { 
        type: "array", items: { type: "string" }, maxItems: 5,
        description: "Top priorities, ordered by importance"
      },
      open_threads: {
        type: "array", items: { type: "string" },
        description: "Unresolved items from yesterday or recent sessions"
      },
      calendar_awareness: {
        type: "string",
        description: "How the day's schedule relates to priorities"
      },
      energy_read: {
        type: "string", enum: ["high", "moderate", "low", "unknown"]
      }
    }
  }
}
```

#### `complete_session`

```typescript
{
  name: "complete_session",
  description: "Mark the current session or structured arc as complete. Call when the conversation has reached its natural conclusion.",
  input_schema: {
    type: "object",
    required: ["type"],
    properties: {
      type: {
        type: "string",
        enum: ["session", "arc"],
        description: "'session' ends the entire conversation. 'arc' ends the current structured arc and returns to open conversation."
      },
      summary: {
        type: "string",
        description: "Brief summary of what was accomplished"
      }
    }
  }
}
```

#### `show_pulse_check`

```typescript
{
  name: "show_pulse_check",
  description: "Display an interactive pulse check where the user rates their life domains. Use during onboarding, at check-in start, or when domain-level status update would be valuable.",
  input_schema: {
    type: "object",
    properties: {
      context: {
        type: "string",
        description: "Why this pulse check is being shown"
      },
      domains: {
        type: "array", items: { type: "string" },
        description: "Optional subset of domains. Defaults to all 8."
      }
    }
  }
}
```

#### `enter_structured_arc`

```typescript
{
  name: "enter_structured_arc",
  description: "Transition into a structured session arc. Use when the conversation naturally calls for a focused activity. Only call from an open conversation context.",
  input_schema: {
    type: "object",
    required: ["mode"],
    properties: {
      mode: {
        type: "string",
        enum: ["open_day", "close_day", "weekly_checkin", "life_mapping"],
        description: "The structured arc to enter"
      },
      reason: {
        type: "string",
        description: "Why this arc is appropriate right now"
      }
    }
  }
}
```

#### `emit_reflection_prompt`

```typescript
{
  name: "emit_reflection_prompt",
  description: "Save a reflection prompt to show the user later (notification or home screen card). Use when you notice something worth reflecting on but the current moment isn't right to explore it.",
  input_schema: {
    type: "object",
    required: ["prompt"],
    properties: {
      prompt: { type: "string", description: "The reflection question" },
      related_domain: { type: "string", description: "Related life domain, if any" },
      urgency: { 
        type: "string", enum: ["whenever", "today", "this_week"]
      }
    }
  }
}
```

---

## Part 5: Context Injection Unification

### 5.1 Context Header

A structured snapshot that lets Sage orient quickly before reading the full context:

```xml
<session_context>
User: {name}
Life map: {X}/8 domains mapped, last updated {days} days ago
Last session: {days} days ago ({type}, discussed {key_themes})
Time: {day_of_week} {time_bracket} ({time})
Calendar today: {event_count} events, next at {next_event_time}
Active intention: "{current_intention}"
Weekly focus: "{weekly_theme}"
Domains flagging: {domains_needing_attention}
Check-in: {due_status} (due in {days} days / overdue by {days} days)
Captures since last session: {count} ({summary_of_types})
Days since last journal: {days}
</session_context>
```

### 5.2 Unified Context Pipeline

Replace the 450-line session-type-branched `fetchAndInjectFileContext()` with:

1. **Context header** (always, ~200 tokens)
2. **Standing context** (always):
   - Sage working model (`sage/context.md`)
   - Life map overview (`life-map/_overview.md`)
   - Life plan (`life-plan/current.md`)
   - Weekly plan (current week)
   - Active patterns (`sage/patterns.md`)
   - Pulse check baseline (from DB)
3. **Temporal context** (always, with timestamps so model can judge relevance):
   - Last 3 check-in summaries (with dates)
   - Last 7 daily logs (with dates)
   - Recent captures (with dates)
   - Today's day plan (if exists)
   - Yesterday's day plan + journal (if exist)
   - Calendar events for today (if connected)
   - Flagged domain files (needs_attention/in_crisis)

**No session-type branching.** The model receives everything and uses the context header to prioritize. A morning session naturally references calendar data because it's there and timestamped as today. An evening session naturally references captures because they're timestamped as today.

**Token impact:** ~30% more context per session. Negligible at current context window sizes. The benefit (simpler code, fewer bugs, richer model context) far outweighs the cost.

---

## Part 6: Migration Plan

### 6.1 Sprint Sequence

| Sprint | Focus | Effort | Dependencies |
|--------|-------|--------|-------------|
| A | Tool use foundation (`save_file` + `show_options`) | 3-4 days | None |
| B | Skill rewrites (open_day, close_day, weekly_checkin, life_mapping) | 2-3 days | None (can parallel A) |
| C | Context injection unification | 2-3 days | None (can parallel A) |
| D | Extended tool set (`save_day_plan`, `complete_session`, `show_pulse_check`, `enter_structured_arc`) | 2-3 days | Sprint A |
| E | New skill files (domain_deep_dive, crisis_support, decision_helper, pattern_review, life_plan_revision, capture_review) | 2-3 days | Sprint A |
| F | Skill invocation mechanism (model-driven skill awareness + composition) | 2-3 days | Sprints D + E |
| G | Remove parser fallback, clean up legacy code | 1-2 days | All above stable for 1+ week |

**Sprints A-C are pre-user-testing.** They improve the architecture without dramatically changing the user experience.

**Sprints D-F can interleave with user testing.** Each adds capability without breaking existing flows.

**Sprint G is cleanup.** Only after the new architecture is proven stable.

### 6.2 Sprint A: Tool Use Foundation

**Goal:** Replace the two highest-volume structured output mechanisms with tool calls.

**Implementation:**

1. Add `tools` parameter to `anthropic.messages.stream()` in `route.ts` with `save_file` and `show_options` definitions.
2. Increase `max_tokens` from 1024 to 4096 (tool call JSON needs token budget alongside conversational text).
3. Handle `tool_use` blocks in the SSE stream: detect `content_block_start` with `type: 'tool_use'`, execute server-side, return `tool_result` to Claude.
4. Implement tool execution handlers:
   - `save_file`: Reuse logic from `file-write-handler.ts`, receiving typed parameters instead of regex-parsed blocks.
   - `show_options`: Emit options to client via SSE event, client renders as suggestion pills.
5. Extend SSE protocol: add `{ toolCall: { name, input } }` and `{ toolResult: { success, data } }` events.
6. Update prompts: Remove `[FILE_UPDATE]` and `[SUGGESTED_REPLIES]` format instructions (~500 tokens saved per prompt). Add brief tool usage guidance.
7. Keep `parser.ts` as fallback during migration.

**Technical considerations:**
- Streaming pauses during tool execution (1-3 seconds). Consider a subtle "saving..." indicator.
- `max_tokens` bump to 4096 is important — synthesis messages with `save_file` calls need room for both text and tool JSON.
- Claude supports parallel tool calls — Sage can batch multiple file saves in one turn.
- Error handling: return clear error messages in `tool_result` so Sage can inform the user or retry.

**Testing:** Run all existing session types. Verify tool calls produce equivalent output to `[FILE_UPDATE]` blocks. Verify suggestion pills appear appropriately. Check streaming UX feel with tool-call pauses.

**Rollback:** Remove `tools` parameter, re-add format instructions, parser still functional.

### 6.3 Sprint B: Skill Rewrites

**Goal:** Rewrite the four main session skills from scripts to goals, reducing prescriptiveness while preserving product decisions.

**Changes:**
- `skills/open-day.md`: 5/5 → 3/5 (~4,000 tokens → ~350 tokens). See Section 3.2.
- `prompts.ts` life_mapping: 4.5/5 → 3/5 (~3,400 tokens → ~500 tokens). See Section 3.2.
- `prompts.ts` weekly_checkin: 4/5 → 2.5/5 (~1,500 tokens → ~450 tokens). See Section 3.2.
- `prompts.ts/skills` close_day: 3.5/5 → 2.5/5 (~1,300 tokens → ~300 tokens). See Section 3.2.
- Migrate any remaining `prompts.ts` templates to skill files for consistency.

**What's preserved in every rewrite:** Time constraints, output requirements, artifact specifications, tone guidance, tool usage instructions. These are product decisions.

**What's removed:** Step-by-step scripts, HARD RULES, "NEVER deviate" instructions, prescribed question order, rigid beat sequences. These are scaffolding.

**Testing:** Run 3-5 sessions of each type. Compare conversational quality, timing, and output completeness against current versions. Ideal: A/B test with user testing participants.

**Rollback:** Restore previous skill files (git revert). Each skill is independent.

### 6.4 Sprint C: Context Injection Unification

**Goal:** Replace session-type-branched context injection with a unified pipeline.

**Implementation:**
- Refactor `fetchAndInjectFileContext()` to remove all session-type conditionals (~200 lines removed).
- Build context header generator (new function, ~50 lines). See Section 5.1.
- Inject all available context in consistent order with clear XML section tags.
- Preserve existing `<user_data>` XML structure.

**Testing:** Run all session types. Verify context quality matches or improves. Confirm morning sessions still reference calendar, evening sessions still reference captures. Monitor token usage.

**Rollback:** Git revert on context.ts.

### 6.5 Sprint D: Extended Tool Set

**Goal:** Convert remaining structured output to tool calls and add session lifecycle tools.

**Depends on:** Sprint A.

**Implementation:**
- Add `save_day_plan`, `complete_session`, `show_pulse_check`, `enter_structured_arc`, `emit_reflection_prompt` tools. See Section 4.2 for schemas.
- Implement execution handlers for each.
- Update skill files to reference new tools.
- Remove corresponding block format instructions from prompts.
- Replace `completion-detection.ts` string matching with `complete_session` tool callback.

### 6.6 Sprint E: New Skill Files

**Goal:** Expand the skill library with new capabilities.

**Depends on:** Sprint A (tools to reference).

**Implementation:**
- Create skill files for: `domain_deep_dive`, `crisis_support`, `decision_helper`, `pattern_review`, `life_plan_revision`, `capture_review`. See Section 3.3 for full definitions.
- No infrastructure changes needed — just new markdown files.
- Update base Sage prompt with skill awareness (see Section 3.4).

### 6.7 Sprint F: Skill Invocation Mechanism

**Goal:** Enable model-driven skill invocation and composition.

**Depends on:** Sprints D + E.

**Implementation:**
- Update base Sage prompt to list available skills with one-line descriptions.
- Extend context-driven skill loading to use the context header signals.
- Test skill composition: check-in that invokes domain_deep_dive, morning session that shifts to crisis_support.
- Refine the `enter_structured_arc` tool to support the full skill library, not just the original 4 session types.

### 6.8 Sprint G: Legacy Cleanup

**Goal:** Remove scaffolding code that's no longer needed.

**Depends on:** All above stable for 1+ week.

**Implementation:**
- Remove `[FILE_UPDATE]`, `[SUGGESTED_REPLIES]`, `[DAY_PLAN_DATA]`, `[ENTER_MODE]` regex patterns from parser.
- Remove block format instruction assembly code.
- Simplify completion-detection.ts (now just a tool callback handler).
- Remove `getStatePills()` fallback function.
- Clean up deprecated session metadata fields.

---

## Part 7: Additional Strategic Ideas

### 7.1 From the Boris Cherny Interview

**Latent demand detection.** Once we have user testing data, actively watch for: What do users try to talk to Sage about that isn't a session type? When do users fight the session structure? Each friction point is a signal for a new skill.

**The "under-fund" principle.** Don't over-build tooling around Sage. A `save_file` tool that handles 10 file types is better than 10 separate tools. Give Sage fewer, more powerful tools and let it figure out combinations.

**Model-native self-review.** Run recent conversation transcripts through Claude with the prompt: "You are Sage. Review these conversations. What went well? What felt forced? What patterns do you notice?" This surfaces insights about skill quality and missing capabilities.

**The printing press marketing angle.** Boris compares AI coding to the printing press — technology locked away to specialists becoming accessible to everyone. MeOS does the same for self-organization. Marketing angle: "You don't need to know how to organize your life. You just need to talk about it."

**Build for the model six months from now.** What does Sage look like when Claude is dramatically better? Single-prompt skill-rich conversations running 30+ minutes without losing coherence. Sage proactively suggesting when to revisit a domain. Background agents monitoring calendar changes. Build the tool and skill infrastructure that enables this, even if the current model can't fully exploit it.

### 7.2 Skill Quality Metrics

After the skill rewrites, track:
- **Conversational naturalness:** Does the inverse correlation hold? (less prescriptive → more natural)
- **Output completeness:** Do journal entries still contain all required metadata fields?
- **Timing accuracy:** Do morning sessions stay under 2 minutes?
- **User sentiment:** "Talking to someone who knows me" vs. "filling out a form with my voice"
- **Skill emergence:** Does Sage naturally adopt the right approach from context, or does it need more guidance?

### 7.3 Future Skill Ideas (Post-MVP)

Skills that could be added as the product evolves:
- `relationship_navigator` — help process a specific interpersonal dynamic
- `financial_clarity` — structured thinking about a financial decision using life map values
- `energy_audit` — review energy patterns across daily logs, identify drains and sources
- `quarterly_review` — deep strategic review at quarter boundaries
- `celebration` — recognize and savor wins (counterbalance to the problem-solving bias)
- `onboarding_v2` — streamlined re-onboarding for users who want a fresh start

Each is a markdown file that references existing tools. The infrastructure stays the same.

---

## Part 8: User Testing Protocol Additions

### 8.1 Scripted vs. Unscripted Session Feel

Have users experience both a highly structured session (current `open_day` at 5/5) and the rewritten version (3/5). Ask:
- "Which felt more like talking to someone who knows you?"
- "Which felt more like filling out a form with your voice?"
- "Which would you want to do every morning?"

### 8.2 Tool-Call Latency Tolerance

Once tool use is implemented, time the pauses. Ask:
- "Did you notice any pauses?"
- "Did they feel natural (like someone pausing to write something down) or jarring?"

### 8.3 Structure Fighting Points

Track where users fight session structure:
- Check-in user wants to discuss a crisis
- Life mapping user wants to skip or go deep
- Morning user wants to discuss something emotional
- Open conversation that naturally evolves into planning

Each friction point → candidate for skill composition.

### 8.4 Skill Emergence

In open conversation (base Sage), observe:
- Does Sage naturally reference previous conversations?
- Does Sage offer to do things the user hasn't asked for?
- Does Sage surface patterns or connections unprompted?
- Does Sage naturally shift approach based on the user's emotional state?

### 8.5 Session Type Awareness

Ask users:
- "Do you think of your conversations as different 'types'?"
- "Would you prefer to choose what kind of conversation to have, or have Sage figure it out?"
- "Did Sage ever do something that felt wrong for the moment?"

---

## Part 9: Open Questions

### Requires User Testing Data

1. Which skill guardrails actually prevent bad conversations vs. constrain good ones?
2. Does the pre-checkin warmup add value, or should it become part of the check-in skill?
3. Is the 4-domain ceiling in life mapping essential, or should depth/breadth be user-driven?
4. Do users notice the quality difference between scripted and goal-oriented skills?
5. How well does Sage compose skills without explicit instruction to do so?

### Requires Technical Investigation

6. How does streaming + tool use UX feel in practice? Need to prototype.
7. Can tool calls be fire-and-forget for write operations, or does Claude need confirmation?
8. With unified context (~10,000 tokens) + skills (~500 tokens) + tools + history, does 4096 max_tokens suffice for long synthesis responses?
9. How does parallel tool execution affect streaming UX?
10. What's the right mechanism for model-driven skill loading? (Tool call? Context injection? Both?)

### Strategic Decisions (Founder Call)

11. How many skills should exist at launch vs. growing over time?
12. Should skills be visible to the user? ("Sage is using: Domain Deep Dive" — or invisible?)
13. Should users be able to request specific skills? ("Do a pattern review") — or only Sage-initiated?
14. When to start building agentic tools? (Calendar write, reminders, web search — the next tool tier)

---

## Part 10: Success Criteria

### For Sprint A (Tool Use)
- [ ] `save_file` produces equivalent output to `[FILE_UPDATE]` blocks in all session types
- [ ] `show_options` displays suggestion pills at contextually appropriate moments
- [ ] Streaming UX feels natural with tool-call pauses (< 3 seconds)
- [ ] Parser fallback catches edge cases
- [ ] No regression in conversation quality

### For Sprint B (Skill Rewrites)
- [ ] Morning sessions stay under 2 minutes / 5-6 exchanges
- [ ] All required output fields present (day plan, journal metadata, domain fields)
- [ ] Conversations feel more natural than scripted versions
- [ ] Users don't report feeling "lost" or lacking structure

### For Sprint C (Context Unification)
- [ ] All session types receive relevant context without branching
- [ ] `context.ts` shrinks by ~200 lines
- [ ] No increase in irrelevant context references

### For Sprint E (New Skills)
- [ ] Sage draws on domain_deep_dive when a domain is in crisis during a check-in
- [ ] Sage shifts to crisis_support approach when user shows distress
- [ ] Sage offers decision_helper framing when user presents a fork-in-the-road choice

### For the Overall Rearchitecture
- [ ] Skill library is growing (new skills addable without infrastructure changes)
- [ ] Tool-based architecture enables adding new agentic tools without parser changes
- [ ] Sage can have conversations that don't fit any predefined type
- [ ] Sage can pivot mid-conversation when user needs shift
- [ ] Inverse correlation confirmed: goal-oriented skills → more natural conversations