# POS Vision Strategy — Staged Validation with a Wedge Module

**Date:** 2026-02-16
**Status:** Approved
**Source:** Brainstorm session — `Docs/meos_as_personal_operating_system.md` + founder input

---

## Core Thesis

The Life Map is the kernel of a Personal Operating System. Life mapping and reflections are how the system learns about you. POS modules (journal, capture, day planner) are what give the system daily utility. The day planner is the first proof that shared Life Map context makes a module genuinely better than its standalone alternative.

But none of this matters if the life mapping conversation doesn't make people feel understood. Validate the kernel first.

---

## Strategy: Staged Validation

Three questions, answered in order:

1. **Does the conversation land?** (Wave 1 — life mapping only)
2. **Does Life Map context make daily utility genuinely better?** (Wave 2 — journal, capture, first check-in)
3. **Does the integrated system create the "this is my operating system" moment?** (Wave 3 — day planner with calendar)

### Timeline

| Week | Ship | Test | Build in background |
|------|------|------|---------------------|
| **1** (current) | UX gaps branch. Recruit 8-10 testers. | — | — |
| **2** | Bug fixes from R3 self-test. | **Wave 1:** 4-5 users do life mapping. Same-day interviews. | Google Calendar OAuth — consent screen, token management, refresh logic, read access |
| **3** | Daily Journal + Quick Capture modules. | **Wave 2:** Wave 1 returnees + new users test journal + capture + first check-in. | Calendar write access (create/update/delete events) |
| **4** | Day Planner with full calendar read/write. | **Wave 3:** Full POS experience — life mapping → daily modules → check-in. | — |
| **5-6** | Iterate based on data. Expand to 15-20 beta users. | Ongoing observation. | Begin Ring 3 work if signals are strong. |

### Decision Gates

**After Wave 1 (end of Week 2):**

| Signal | Meaning | Next move |
|--------|---------|-----------|
| "This gets me" from 4/5 testers | Kernel works | Proceed to Wave 2 as planned |
| Conversation is mediocre | Prompt/arc issue | Redirect Week 3 to prompt rewriting. Delay modules. Re-test. |
| Users bounce off onboarding | Pre-conversation problem | Fix onboarding first |

**After Wave 3 (end of Week 5-6):**

| Signal | Meaning | Next move |
|--------|---------|-----------|
| Daily opens 3+/week, day planner reused | Daily utility works. POS thesis validated. | Expand to Ring 3. Pattern detection + recovery. |
| Check-ins strong, daily modules weak | Weekly cadence is the product | Deepen check-in quality. Defer more modules. |
| Life mapping strong, everything else weak | Conversation is the product, not the app | Consider lighter distribution: Claude Project, WhatsApp bot. |
| Nothing retains | Core thesis needs rethinking | Pause building. Deep interviews. |

---

## Ring Architecture

MeOS expands in concentric rings. Each ring is a complete product. Don't build the next ring until the current one has its proof point.

### Ring 1: The Kernel (Built — Validating Now)

Life mapping, weekly check-ins, markdown file system, session state detection, onboarding, home screen, life map view.

**Proof point:** 4 out of 5 testers complete life mapping AND express "this gets me."

**What it feels like to a user:** One great conversation. A life map that feels accurate. Then silence for 7 days. You might come back, you might not.

**Gap this ring can't close:** No reason to open the app between check-ins.

---

### Ring 2: Daily Utility (Weeks 3-6)

Three modules shipped in dependency order. Each module = prompt + tools + card type, not a separate screen. Hybrid approach: conversation is primary, but some modules surface cards on the home screen.

#### Module 1: Daily Journal (Week 3)

2-minute conversational reflection. Sage asks 1-2 questions based on Life Map context. Zero new infrastructure — new session type + prompt + `JournalCard`.

- **Session type:** `daily_journal`
- **Write permissions:** `daily-logs/*`, `sage/context.md`
- **Why first:** Lowest-risk module. Extends existing conversational UX at a different cadence. Tests whether conversation-as-daily-habit works.

#### Module 2: Quick Capture (Week 3-4)

"Hey Sage, remind me..." / "Had a thought about X" — zero-friction input. Sage acknowledges and files the thought into the relevant domain file or `sage/context.md`.

- **Session type:** `capture`
- **Write permissions:** `life-map/*`, `sage/context.md`
- **No structured output card** — just confirmation. Value is that it goes somewhere and Sage remembers it later.
- **Why it matters:** Tests whether people want to push information into the system, not just pull insights out.

#### Module 3: Day Planner (Week 4)

The "holy shit" module. See full design below.

#### Module Discovery

The modules can't retain anyone if nobody knows they exist. Three discovery mechanisms, progressively introduced:

**Day 1 (post-life-mapping):** Home screen surfaces a new card after the first session completes: "Tomorrow morning, Sage can help you plan your day. We'll check in then." Sets the expectation that this app has a daily cadence, not just a one-time conversation.

**Day 2 (push notification):** Morning push: "Morning, [name]. Want to start with a quick reflection? It takes 2 minutes." Links directly to the daily journal session. This is the first daily touch — if it works, the habit starts here.

**First check-in (Day 7):** Sage introduces modules conversationally during the check-in wrap-up: "Between check-ins, you can capture thoughts or plan your day with me anytime. Some people find the morning plan especially useful." Natural, not salesy. Sage is describing capabilities, not selling features.

**Home screen progressive reveal:** The home screen CTA evolves as modules unlock:
- Post-mapping, pre-journal: "Talk to Sage" only
- After first journal prompt: "Plan my day" / "Quick reflection" / "Talk to Sage"
- After calendar connected: Day planner becomes primary morning CTA

**Key principle:** Discovery is Sage's job, not the UI's job. Sage introduces modules conversationally when they're relevant. The home screen reflects what's been discovered, not what's available. No feature list, no onboarding tour, no "you haven't tried X yet" badges.

#### Proof point for Ring 2

Users open the app 3+ days per week (not just check-in day). Day planner gets used more than twice. Journal entries contain signal that feeds back into check-ins.

**What it feels like at the end of Ring 2:** You talk to Sage most mornings. It knows your schedule and your priorities. You capture stray thoughts and they show up in your next check-in. Weekly check-ins feel richer because Sage has daily context. The Life Map updates passively — you don't maintain it, it maintains itself.

---

### Ring 3: System Intelligence (Weeks 7-10 / Early Q2)

Where MeOS goes from "useful" to "irreplaceable." The system starts seeing things the user can't.

#### Automated Pattern Detection

Post-session analysis comparing themes, obstacles, and sentiment across 3+ sessions.

- "You've mentioned boundary issues with work in 4 of your last 5 check-ins. This might be the real blocker, not time management."
- Writes to `sage/patterns.md`. Surfaced in check-ins when relevant.
- Also fed by daily logs — "You've been blocked by meetings expanding into focus time 3 days this week."

#### Progressive Trust Ladder

Per-capability trust that Sage earns through successful interactions.

- **Level 0 (default):** Sage suggests, user acts manually.
- **Level 1 (earned after 3+ accepted suggestions):** Sage proposes with one-tap approval. "Block 2-4pm for interview prep?" → [Approve].
- **Level 2 (earned after 2+ weeks of Level 1):** Sage auto-blocks focus time on MeOS-tagged calendar slots. User can override.

Trust is per-capability, not global. Calendar trust progresses independently from capture trust.

#### Recovery Flows

What happens when a user disappears.

- **Week 1 missed:** Gentle push referencing something specific from their Life Map.
- **Week 2 missed:** Warmer nudge. "No pressure — your commitment to [X] is still here when you're ready."
- **Week 3+:** Sage goes quiet. No more notifications. When user returns: "Hey — it's been a while. Want to do a quick pulse check to see where things stand?" Soft re-onboarding, no guilt.

#### Proof point for Ring 3

Users who hit the pattern detection moment retain at higher rates. Trust ladder actually progresses. Recovered users stick.

**What it feels like:** Sage is getting smarter. It notices things across weeks that you missed. It earned the right to manage your calendar blocks. When you fell off, it welcomed you back. You start feeling like losing this would be losing something.

---

### Ring 4: Agentic Execution (Q2, Weeks 11-16)

Only build once Ring 3 proves users want Sage to do more. Trust ladder signal is the gate.

#### Task Decomposition

Sage breaks "prepare for manager conversation" into concrete steps. User sees the decomposition as a proposal card. Approves, adjusts, or rejects. Strategic altitude stays on the home screen. Decomposition lives underneath.

#### Agent Execution

Approved tasks enter an execution queue. Initial capabilities:
- Draft an email (propose, user sends)
- Research a topic (web search on user's behalf)
- Schedule calendar blocks
- Create document outlines

The approval model: Sage proposes → user approves → agent executes → user reviews output.

#### Proof point

Users approve agent-proposed actions. They use the outputs. Agent use increases session frequency.

---

### Ring 5: Platform Expansion (Q3+)

Firm up based on Q2 data.

**Modules (prioritized by "is this better because of the kernel?"):**
- Smart calendar — proactive scheduling aligned with life priorities
- Knowledge capture — articles, podcasts, newsletters connected to interest graph
- Project manager — background task execution
- Financial planner — budget aligned with life priorities

**Distribution:**
- MCP server exposing Life Map to external AI systems
- OpenClaw skill (Life Map as structured identity layer)
- WhatsApp bot for zero-friction captures
- Claude Extension

**Monetization (Q2):**
- Free: Life mapping + 2 check-ins/month
- Pro ($15-20/month): Unlimited check-ins, daily modules, pattern detection, agent execution
- Paywall at frequency and depth, not the core experience

---

## Day Planner Module — Full Design

### The value proposition

A standalone planner says: "You have 3 free hours today."

MeOS says: "You have a free block from 2-4pm. Your north star is the career transition, and last week you said you wanted to prep for the manager conversation but work kept expanding into your evenings. Want me to block that time for interview prep?"

Three layers of context no standalone planner has: the strategic priority (Life Map), the specific commitment (Life Plan), and the behavioral pattern (check-in history + daily logs).

### User experience

**Entry point:** "Plan my day" CTA on the Home screen. Also accessible via "Talk to Sage."

**Morning flow (2-3 minutes):**

1. Sage opens with a proposed focus — not "what do you want to do today?" but a concrete suggestion based on Life Map priorities + calendar:

   > "Morning, Tom. You've got meetings until 1pm, then a clear afternoon. Your commitment is the career pivot — and you mentioned wanting to draft that LinkedIn post. Want me to block 2-4pm for that?"

2. Quick-reply buttons: "Sounds right" / "Different focus today" / "Just show me my day"

3. Sage produces a `DailyPlanCard` and, on approval, creates calendar events via tool use.

**End-of-day loop (60-90 seconds):**

1. Push notification at configurable time (default ~6pm), or home screen prompt:
   > "You blocked 2-4pm for the LinkedIn draft. How'd it go?"

2. Quick-reply options: **"Nailed it"** / **"Partially"** / **"Didn't happen"** / **"Day changed"**

3. If "didn't happen" or "partially" → one follow-up: "What got in the way?" (feeds behavioral patterns)

4. Sage writes a daily log entry. This feeds:
   - Tomorrow's planning prompt ("Yesterday you didn't get to the draft — want to try again?")
   - Weekly check-in rollup ("This week you focused on interview prep 4 out of 5 days")
   - Pattern detection over time

### Architecture

**Session type:** `daily_planning` — own prompt, write permissions, clean boundaries.

**Write permissions:** `daily-logs/*`, `sage/context.md`, `life-plan/current.md`

**Prompt:** New `getDailyPlanningPrompt()` injecting:
- Life Map overview (north star, priorities)
- Life Plan commitments + next steps
- Last check-in summary
- Calendar data for today
- Previous daily log (yesterday's plan adherence)
- Day of week + time of day

### Calendar Tool Set (Bidirectional)

```
check_calendar(date_range_start, date_range_end)
  Returns: events[], free_slots[]

create_calendar_event(title, start, end, description?, color?)
  Returns: event_id, calendar_link
  Approval: REQUIRED
  Tags with source: "meos" in extended properties

update_calendar_event(event_id, changes)
  Approval: REQUIRED
  Only MeOS-tagged events

delete_calendar_event(event_id)
  Approval: REQUIRED
  Only MeOS-tagged events
```

The `source: "meos"` metadata tag is the trust boundary. Sage manages its blocks; user manages everything else.

### DailyPlanCard — Three States

**Morning (post-planning):**
- Focus area with commitment connection
- Time blocks (MeOS blocks in amber, external meetings in muted gray)
- Sage's rationale line
- "Adjust plan" action

**Midday (during the day):**
- Current/next block highlighted
- Elapsed blocks dimmed
- Gentle "You're in your focus block" indicator if a MeOS block is active

**Evening (post-capture):**
- Completion status per block
- Sage's one-line reflection: "Solid day — you protected the focus block. That's 3 in a row."
- Transitions to "Plan tomorrow?" CTA the next morning

### Home Screen CTA — Three States

| Condition | Primary CTA | Secondary |
|-----------|------------|-----------|
| Morning, no plan yet | "Plan my day" | "Talk to Sage" |
| Already planned today | "How's today going?" | "Talk to Sage" |
| Evening, plan exists | "How'd today go?" | "Talk to Sage" |
| After ~2pm, no plan | "Talk to Sage" | — |

### Structured Output Blocks

```
[DAILY_PLAN]
Focus: Draft LinkedIn post about career transition
Connected to: Career pivot — "Build public presence"
Time blocks:
- 2:00 PM - 4:00 PM: LinkedIn draft (focus block)
Check-in: 6:00 PM
Rationale: You mentioned this last check-in but work kept expanding. Protecting an afternoon block.
[/DAILY_PLAN]

[DAILY_LOG]
Date: 2026-03-10
Plan adherence: partial
Focus block used: yes, but cut short at 3:15 for urgent Slack
Blocker: Work boundary — meetings expanding into protected time (3rd time this week)
User note: "Got the outline done at least"
[/DAILY_LOG]
```

### What This Does NOT Include

- No task decomposition or agent execution (Ring 4)
- No automated calendar blocking without approval (Ring 3 trust ladder)
- No habit tracking or daily streaks
- No separate planner screen (conversation + card, in the chat view)
- No evening reflection as mandatory (optional capture only)

---

## The One Rule

**Don't build the next ring until the current one has its proof point.** If daily utility doesn't retain, system intelligence won't save it. If the kernel doesn't land, nothing else matters. Each decision gate is a real gate — not a formality you blow through because the next ring is exciting.

---

## References

- POS vision: `Docs/meos_as_personal_operating_system.md`
- Vision: `Docs/vision.md`
- MVP PRD: `Docs/MVP_PRD.md`
- UX Architecture audit: `Docs/feedback/20260216_MeOS_UX_Architecture.md`
- Life Plan UI spec: `Docs/feedback/20260214_Life_plan_UI_Narrative_Home.md`
