# Life Plan UI & Narrative Home — Design Spec

**Date:** 2026-02-14
**Status:** Approved direction, ready for implementation
**Context:** Feedback and design decisions for the home screen narrative rewrite, life plan surfacing, and execution architecture. This spec covers vocabulary, layout, multi-surface design, and the altitude model connecting strategic life planning to agentic task execution.

---

## 1. Vocabulary Layer (Confirmed)

All user-facing labels use coaching vocabulary. The underlying data model field names are unchanged.

| Data Model Field            | User-Facing Label           | Subtitle (always visible for MVP)                                  |
|-----------------------------|-----------------------------|--------------------------------------------------------------------|
| `compoundingEngine`         | **Your north star**         | *The area where focused effort moves everything else forward.*     |
| `antiGoals`                 | **Boundaries**              | *What you're choosing not to pursue right now.*                    |
| `anchorProjects`            | **Active commitments**      | *The 1-2 things you're actually doing about it this quarter.*      |
| `milestones`                | **Next steps**              | *What's coming up for each commitment.*                            |
| `quarterlyPriorities`       | **This quarter's focus**    | *Your top priorities for the next few months.*                     |
| `keyTensions`               | **Tensions to watch**       | *Where competing priorities pull against each other.*              |
| `quarterTheme`              | **Quarter theme**           | *A phrase that captures what this season is about.*                |
| `maintenanceHabits`         | **Things to protect**       | *Systems that are working — don't drop these.*                     |

Sage introduces concepts conversationally during synthesis (e.g., "here's what I see as your biggest lever") and then varies language naturally in subsequent conversations. UI labels stay consistent; Sage stays fluid.

---

## 2. Home Screen Layout (Narrative Home)

The home screen tells the user's story top-to-bottom. It should be scannable in 3 seconds — glance and know what you're focused on and what's next.

### Layout (top to bottom):

1. **Greeting** — "Good morning, [name]"
2. **Sage's contextual line** — template-based one-liner with variable interpolation from life plan data. Should reference specific commitment names, not generic prompts. Example: "Day 5 of the job search pivot. Found any leads worth exploring?" is better than "Day 5. How's momentum?"
3. **North star card** — highlighted warm card with coaching subtitle. Must include a "because" clause for substance: not just "Career transition" but "Career transition — because financial independence unlocks everything else." The causal chain is what makes it feel like Sage understood something. If the synthesis produces a vague north star, Sage should probe deeper before finalizing.
4. **Active commitments** — 1-2 items with inline next steps. Falls back to "This quarter's focus" (priorities list) if no life plan commitments exist yet. Next steps are directional, not granular (see altitude model below).
5. **Check-in prompt** — next check-in date + action button. Placed right after commitments because that's the natural action moment.
6. **Boundaries** — subtle, muted section. Only shown when data exists — no empty placeholder. This is the first thing to cut if the life mapping session runs long.
7. **Talk to Sage** — full-width CTA at bottom.

### Sage contextual line templates (expanded):

```typescript
const sageLines = {
  day1: "You mapped your life yesterday. Today's the first day of doing something about it.",
  day2_7_withCommitment: `Day ${daysSinceMapping} of "${topCommitment.shortLabel}." ${commitmentSpecificPrompt}`,
  day2_7_generic: `Day ${daysSinceMapping} since we mapped things out. What's landing?`,
  week2: "Two weeks in. Are things tracking, or has reality intervened?",
  withFocus: `Your north star: ${northStar.shortLabel}. One thing today?`,
  checkinSoon: "Check-in's tomorrow. Take a minute to notice how the week felt.",
  postCheckin: "Good check-in. Here's what's carrying forward.",
  dailyFocus: `Today's focus: ${dailyFocus}. ${topAgentAction ? "I've got a suggestion when you're ready." : ""}`,
}
```

---

## 3. Life Plan — Three UI Surfaces

The life plan appears on three distinct surfaces, each at a different altitude.

### Surface 1: Home Screen (what's active now)
Covered above. Shows current state of the life plan — north star, active commitments with next steps, boundaries. Nothing requires a tap to be useful.

### Surface 2: Life Map Tab (the full picture)

The Life Map tab gets a segmented control at the top:

**"Where I Am"** | **"What I'm Doing"**

- **"Where I Am"** = domain cards (identity/reflection layer). Updates when life situation changes (quarterly cadence).
- **"What I'm Doing"** = life plan (action layer). Updates when commitments progress or shift (weekly cadence).

#### "What I'm Doing" layout:
1. **Quarter theme** — banner/header phrase at top
2. **Active commitments** — expandable cards, each showing:
   - Description (one sentence)
   - Why it matters (connects back to north star or domain)
   - Next steps (directional checklist, not granular tasks)
   - Progress indicator (qualitative, not percentage — e.g., "getting started," "making progress," "nearly there")
3. **Things to protect** — lighter-weight list of maintenance habits/systems
4. **Boundaries** — muted, at bottom

### Surface 3: Conversation Context (the living view)

When Sage runs a weekly or daily check-in, show a **pinned compact card** at the top of the conversation displaying current commitments and next steps. Both user and Sage are looking at the same thing — like a coaching session with notes on the table.

This card:
- Appears above the chat messages, pinned/sticky
- Shows commitment names + current next step for each
- Is collapsible (tap to minimize)
- Updates live if Sage modifies commitments during the conversation

At the end of each check-in, Sage produces an **"updated plan" card** inline in the conversation (similar to domain cards) showing what changed.

---

## 4. Altitude Model: Strategic ↔ Tactical ↔ Agentic

The life plan operates at three altitudes. The user primarily interacts at the strategic level. Agents operate at the tactical level. The daily workflow bridges them.

### Strategic Layer (user-facing, coaching altitude)
- **Commitments:** "Have the conversation with my manager about the role change"
- **Next steps:** "Prepare talking points" / "Schedule the meeting"
- This is what appears on the home screen and life map tab
- User never manually creates tasks — they talk about what matters

### Tactical Layer (agent-facing, execution altitude)
- **Task decomposition:** Sage breaks next steps into concrete executable actions
- Example: "Prepare talking points" → ["Draft 3 key points about why this role fits", "Review last performance review for evidence", "Write opening line for the conversation"]
- These live in an **execution queue** that agents can act on
- User approves/rejects proposed decompositions — they don't author them

### Agentic Layer (autonomous execution)
- Approved tasks enter an agent queue
- Agents execute with appropriate tool access (draft an email, schedule a calendar block, research a topic)
- Results surface back to the user for review via the daily workflow
- Approval model: Sage proposes → user approves → agent executes → user reviews output

**Key UX principle: Tasks are generated, not authored.** The user never types a to-do. They talk about what matters, Sage proposes actions, agents execute approved ones. The life plan stays clean and strategic; the execution machinery lives underneath.

### Data model extension for execution layer:

```typescript
interface Commitment {
  id: string;
  label: string;                    // "Have the conversation with my manager"
  whyItMatters: string;             // Connection to north star / domain
  nextSteps: NextStep[];            // Strategic altitude
  status: 'not_started' | 'in_progress' | 'complete';
}

interface NextStep {
  id: string;
  label: string;                    // "Prepare talking points"
  status: 'upcoming' | 'active' | 'done';
  tasks?: Task[];                   // Tactical altitude — generated by Sage, not user
}

interface Task {
  id: string;
  description: string;              // "Draft 3 key points about why this role fits"
  agentExecutable: boolean;         // Can an agent do this?
  approvalStatus: 'proposed' | 'approved' | 'rejected' | 'completed';
  agentOutput?: string;             // Result of agent execution
  completedAt?: Date;
}
```

---

## 5. Cadence Model: Quarterly → Weekly → Daily

### Quarterly (reset & plan)
- Sage initiates a "quarterly reset" conversation
- Reviews what worked, what didn't, what changed
- Builds next quarter's commitments collaboratively
- Old plan archived in History (never deleted — pattern tracking is a moat feature)
- Produces: new quarter theme, new commitments, updated boundaries

### Weekly (review & adjust)
- 5-10 minute check-in conversation
- Reviews progress against commitments
- Updates next steps based on what actually happened
- Surfaces patterns ("You've mentioned feeling stuck on X three weeks in a row")
- Ends with visible "updated plan" card in conversation
- Produces: updated next steps, pattern observations, adjusted priorities

### Daily (focus & execute)
- Lightweight pulse: "What's your focus today?"
- Sage proposes 1-3 actions from the execution queue for today
- User approves/adjusts the daily focus
- This is the approval surface for agent actions
- End of day (optional): quick capture of what actually happened (did vs. planned)
- Feeds back into weekly review data
- Produces: daily focus, approved agent actions, completion data

### How daily workflows connect to the life plan:
- Daily focus is derived from active commitment next steps
- Sage picks the most relevant actions based on: commitment priority, recency, user energy/context
- Daily completion data rolls up into weekly check-in: "This week you focused on X 4 out of 5 days"
- The daily layer is where the life plan meets reality — the weekly layer is where reality updates the plan

---

## 6. Life Plan Lifecycle

### Creation
- End of first life mapping session, or follow-up session if user chose "pick this up next time"
- Sage frames collaboratively: "Based on what we talked about, here's what I'd suggest as your focus. Does this feel right?"
- User can accept, modify, or defer
- Minimum viable life plan: quarter theme + 1 active commitment with 1 next step

### Updates
- Weekly check-ins update next steps and commitment status
- Daily workflows update task completion
- Ad-hoc conversations can modify commitments ("I want to drop this and focus on something else")
- Every update produces a visible diff: "Here's what changed"

### Replacement
- Quarterly reset replaces the active plan
- Old plan archived with full history
- Sage references past plans in future conversations: "Last quarter you committed to X — want to continue or shift?"

---

## 7. Implementation Priority

For the current sprint, implement in this order:

1. **Vocabulary rename** — update all user-facing labels to coaching vocabulary. Data model fields unchanged.
2. **Home screen layout** — implement the narrative layout (greeting → sage line → north star → commitments → check-in → boundaries → CTA)
3. **North star "because" clause** — update synthesis prompt to generate causal chain, not just a label
4. **Sage line interpolation** — expand template bank to reference specific commitment names
5. **Life Map tab segmented control** — add "Where I Am" / "What I'm Doing" tabs
6. **Life Plan "What I'm Doing" view** — quarter theme, commitments, things to protect, boundaries
7. **Pinned context card in check-in conversations** — show current commitments at top of chat
8. **Daily workflow MVP** — morning focus prompt + end-of-day capture
9. **Execution layer data model** — add Task interface beneath NextStep
10. **Agent decomposition flow** — Sage proposes task breakdown, user approves

Items 1-7 are current sprint scope. Items 8-10 are next sprint, dependent on daily workflow design decisions.

---

## 8. Anti-Patterns to Avoid

- **Don't show empty framework sections.** If boundaries data doesn't exist, don't show the boundaries section. No empty placeholders.
- **Don't let next steps become a to-do list.** Keep altitude directional ("prepare talking points"), not granular ("open Google Docs, create new document, write bullet 1...").
- **Don't show the execution queue by default.** Task decomposition is agent infrastructure. The user sees commitments and next steps unless they explicitly drill down.
- **Don't generate the life plan without user buy-in.** Sage proposes, user confirms. The plan should feel co-created, not imposed.
- **Don't use framework jargon in the UI.** "Compounding engine," "anchor projects," "cut criteria" — these stay in the data model and internal docs only.
- **Don't make the daily check-in feel mandatory.** It's an invitation, not a guilt trip. "Want to set a focus for today?" not "You haven't checked in today."