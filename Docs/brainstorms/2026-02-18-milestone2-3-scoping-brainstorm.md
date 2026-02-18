# Milestone 2 & 3 Scoping: Full Daily Rhythm Experience

**Date:** 2026-02-18
**Status:** Design complete, ready for implementation
**Context:** M1 ("Close the Day") is built and tested. This doc scopes the remaining work to deliver the full daily rhythm: morning flow, home screen redesign, calendar integration, quick capture, and mid-day interactions.
**Source docs:** `Docs/feedback/20260218_Home_page_design.md`, `Docs/feedback/20260218_MeOS_Daily_Rhythm.md`, `Docs/STEERING.md`

---

## What We're Building

The complete daily rhythm experience described in the Daily Rhythm spec — the bookend model where two ritualistic sessions (Open the Day + Close the Day) bracket the user's day, with lightweight captures in between and a time-aware home screen that surfaces the right action at the right moment.

**M1 delivered:** Evening "Close the Day" session, JournalCard, home screen evening CTA, voice orb routing, check-in enhancement from journal data.

**M2 delivers:** Morning "Open the Day" session, Google Calendar integration, full home screen card-stack redesign (all 3 time states), Life Map tab enrichment, and the beginning of agent-native skill architecture.

**M3 delivers:** Quick Capture surface, simple AI classification, mid-day nudge notification, capture-to-evening synthesis integration.

---

## Why This Approach

### Sequential layers within M2

M2 is large. Rather than building everything as one giant effort, it's split into three sub-phases (M2a, M2b, M2c) that each produce a shippable increment:

- **M2a:** Infrastructure + calendar + open_day session (the plumbing)
- **M2b:** Home screen card-stack redesign (the surface)
- **M2c:** Life Map tab enrichment (content redistribution)

This means calendar OAuth blockers don't gate the home screen redesign, and the home screen can ship before the Life Map enrichment is done. Each sub-phase works independently.

### M3 is focused

M3 is a tighter scope: Quick Capture + mid-day interactions. It completes the daily rhythm loop by adding the middle of the day.

### Wave testing runs in parallel

No waiting for Wave 1 signal before starting M2. Building continues while testers use M1.

---

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| M2 organization | Sequential layers (M2a/b/c) | Calendar OAuth might have external blockers; don't let it gate home screen work |
| Home screen scope in M2 | Full redesign (all 3 time states) | The time-aware card stack is the core differentiator; ship it all at once |
| Calendar in M2 | Yes, Google Calendar OAuth (greenfield) | P0 integration; morning briefing depends on it; calendar card is key Tier 2 content |
| Agent-native architecture | Start migrating in M2 | Create skill files for open_day and close_day; build skill loader; prompts.ts as fallback |
| Life Map enrichment | Include in M2 | Content redistribution completes the home screen story |
| Morning session arc | Briefing → Focus Question → Commit (3 beats, 3-5 min) | Tight and directive; user patience is lower in morning |
| Morning briefing pre-chat | Lightweight teaser card + bulk in Sage's opening message | Tease to draw user in, real content lives in conversation |
| Day plan artifact | Living document: Intention, Calendar, Focus Blocks, Quick Capture, Carried Forward | Accumulates through the day, gets "closed" by evening session |
| Hero contextual line tone | Personal/warm, signals system intelligence | Incentivizes continued input; creates "it knows me" feeling |
| Capture bar interaction | Inline expansion | Lowest friction; upgradeable to bottom sheet later |
| Carry forward action | Writes to today's context; Sage references in morning conversation | Not a silent operation — user sees Sage acknowledge it |
| Time state transitions | No animation; cards render based on current time on load | Simple for now; no one watches the transition happen |
| Quick capture classification | Simple AI classification | Lightweight LLM call post-capture to tag; no routing logic |
| Wave 1 testing | Runs in parallel with M2 build | No gate; M2 starts immediately |

---

## Morning "Open the Day" — Session Design

### Design Philosophy

The morning session is a **day planning exercise delivered through a conversational interface**. It is NOT a deep exploration or coaching conversation — it's tight, directive, and respects that mornings are low-patience. The MeOS advantage over traditional planners (Notion, second brain systems, bullet journals) is that Sage does the review step for you: it walks in having already read your calendar, yesterday's journal, carried-forward intentions, and unprocessed captures.

Target duration: **3-5 minutes**. Three conversational beats with structured UI affordances.

### Beat 1: The Briefing (~30 seconds)

Sage opens with a compact summary of what's on the user's plate. This is NOT a question — it's Sage demonstrating awareness. The user reads, absorbs, and feels: "oh, it actually knows what's going on."

**Example Sage opening:**

> "Morning. You've got 3 meetings today, the first at 10am. You carried forward your intention to finish the proposal draft. Last night you mentioned feeling energized about the creative project."

**UI elements in this beat:**
- Tappable mini-cards for calendar events inline (not just text — show times and titles as structured elements)
- Carried-forward intention displayed as a tappable card at the top: "Yesterday's intention: Finish proposal draft" with **Keep** / **Change** action buttons
- If there are unprocessed captures from yesterday, a compact summary: "You dropped 3 thoughts yesterday that didn't make it into your journal"

**Context Sage draws from:**
- Today's Google Calendar events
- Yesterday's day plan (intention, completed/incomplete items)
- Last night's journal (mood, themes, energy)
- Unprocessed captures
- Active priorities from life plan
- `sage/context.md` (ongoing awareness)

### Beat 2: The Focus Question (~1-2 minutes)

One targeted question to help the user commit to an intention for the day. This is the light conversational element — Sage is helping the user work through priorities, not just listing them.

**Design principle:** Never ask "what do you want to do today?" — that's blank page paralysis. Instead, Sage makes a specific observation and asks the user to react.

**Example exchanges:**

> Sage: "You've got a 2-hour gap between your 11am and 2pm meetings. The proposal is the thing you've been carrying forward. Want to use that window for it, or is something else pulling at you?"
>
> User: "Actually I need to prep for the 10am first."
>
> Sage: "Got it. So prep for the standup this morning, then proposal in the afternoon gap. That leaves creative time for after 3pm if you want it. Sound right?"

This might take 1-3 exchanges. Sage adjusts based on user input. The goal is to arrive at a clear intention + a rough plan for the day's focus blocks.

**Quick-reply buttons after Sage's focus question:**
- Suggested intention options based on context (e.g., "Focus on proposal", "Prep day", "Creative exploration")
- "Something else" → opens text/voice input for custom intention

### Beat 3: The Commit (~30 seconds)

Sage reflects back the intention and generates the day plan artifact.

> Sage: "Locked in. Your day plan is ready — I've set up your focus blocks around the meetings. Anything else you want to capture before we go?"

**Quick-reply buttons:**
- "Lock it in" → finalizes day plan, session ends
- "Add something" → opens quick capture to drop a to-do or thought into the plan
- "Change my focus" → returns to Beat 2

**Output:** Day plan artifact is written to `day-plans/YYYY-MM-DD.md` and displayed in the artifact sidebar.

---

## Day Plan Artifact — Structure & Design

The day plan is the output document from the morning session. It lives in the artifact sidebar and persists as a **living document** that accumulates throughout the day.

### Artifact Structure

```markdown
---
type: day-plan
date: 2026-02-19
intention: "Finish the proposal draft and protect creative time"
status: active
created_from: open_day
---

## Intention
"Finish the proposal draft and protect creative time"

## Calendar
- 10:00  Team standup (30m)
- 11:00  Design review with Sarah (45m)
- 14:00  Client call (30m)

## Focus Blocks
- 11:45–13:45  Proposal draft (carried forward)
- 15:00–16:30  Creative project exploration

## Quick Capture
- [ ] Email David about timeline
- [ ] Look into that API Sarah mentioned

## Carried Forward
- ~~Finish proposal draft~~ → focus block today
```

### Design Rationale

**Intention at the top, not tasks.** The first thing you see isn't a to-do list — it's a statement about what the day means. This connects back to the Life Map's identity-first principle. The intention is what the evening Close the Day session reflects against: "You set out to [intention]. How did it go?"

**Calendar is read-only context, not the plan.** It shows what's fixed and immovable — the user's committed time. The "Focus Blocks" section is where the user's chosen work goes — the gaps between meetings that Sage helped them fill. This distinction matters: calendar = what's happening to you, focus blocks = what you're choosing.

**Quick Capture as an open inbox.** Throughout the day, the user can drop thoughts, to-dos, and ideas into this section via the capture bar or voice orb. They don't have to classify anything. They just capture. The evening Close the Day session then synthesizes these captures alongside the rest of the day's data. This follows the "second brain inbox" pattern: frictionless capture, deferred organization.

**Carried Forward is explicit.** It shows what rolled over from yesterday and where it went in today's plan. This creates accountability without judgment — just a record. If something keeps carrying forward for 3+ days, Sage can gently surface that pattern in a weekly check-in: "You've been carrying this intention forward for a while now. What's getting in the way?"

### Lifecycle Through the Day

| Time | What Happens to the Day Plan |
|---|---|
| Morning (Open the Day) | Sage generates the artifact: intention, calendar, focus blocks, carried forward |
| Mid-day (captures) | Quick capture items get appended to the Quick Capture section |
| Evening (Close the Day) | Close the Day reads the full day plan — intention, schedule, captures — and weaves it into journal synthesis |
| Next morning | Yesterday's day plan becomes context for today's. Incomplete items become "carry forward" candidates |

---

## Morning Briefing Pre-Chat Card

A lightweight, glanceable card shown before the conversation begins. Its job is to **tease** the user into engaging with the full morning session — not to replace the session.

### Content

The card shows just enough to create curiosity and demonstrate system awareness:

- **Time-aware greeting:** "Good morning, Tom"
- **One-line contextual hook (LLM-generated):** "You've got 3 meetings and an intention carried from yesterday"
- **CTA button:** "Open Your Day" → initiates the open_day session

### What it does NOT show

- Full calendar
- Full intention details
- Yesterday's journal summary
- Captures

All of that belongs in Sage's opening message (Beat 1). The pre-chat card is the movie trailer, not the movie.

### Fallback (Day 1, no data)

- Greeting + "Let's plan your day together" + CTA button
- No contextual line (nothing to reference yet)

---

## Milestone 2a: Infrastructure + Open the Day

### 1. Google Calendar OAuth Integration
- Google Cloud project setup, OAuth consent screen, credentials
- OAuth callback route (`/api/auth/google-calendar/callback`)
- Token storage in Supabase (method TBD — see open questions)
- Calendar read API: `getCalendarEvents(userId, date)` — today's events (time, title, attendees)
- Token refresh/retry logic

### 2. Agent-Native Skill Architecture (Foundation)
- Create `skills/` directory for session skill definitions (markdown files)
- Skill loader: reads skill file, extracts conversational arc, tool permissions, context injection rules, output format
- Migrate `close_day` from `prompts.ts` to `skills/close-day.md` (first migration)
- Create `skills/open-day.md` — morning briefing skill definition with 3-beat arc
- Keep `prompts.ts` as fallback during migration

### 3. `open_day` Session Type
- Add `open_day` to session type enum and constants
- Morning briefing prompt implementing the 3-beat arc:
  - Beat 1 (Briefing): Sage presents calendar, carried-forward intentions, yesterday's journal highlights, unprocessed captures
  - Beat 2 (Focus Question): One targeted question to help user commit to an intention — Sage makes a specific observation and asks user to react (never open-ended "what do you want to do?")
  - Beat 3 (Commit): Confirm intention, generate day plan artifact
- Context injection: today's calendar, `life-plan/current.md`, last journal, unprocessed captures, `sage/context.md`, yesterday's day plan
- Day plan artifact: `[FILE_UPDATE type="day-plan" name="YYYY-MM-DD"]`
- Write permissions: `day-plans/*`, `sage/context.md`
- Wire `UserFileSystem.writeDayPlan()` and `readDayPlan()` methods
- Parser handling for `day-plan` file type

### 4. Carry Forward Logic
- When generating the morning briefing context, check yesterday's day plan for:
  - Intention: was it referenced in the journal? Was it marked complete?
  - Quick Capture items: any un-checked items?
- Surface carried-forward items in Sage's Beat 1 opening
- Carry forward action writes the intention into today's context so Sage references it naturally: "You're carrying forward your intention to finish the proposal. Still feel right, or want to adjust?"
- UI: Tappable card in Beat 1 with **Keep** / **Change** buttons for carried intention

### 5. Morning Briefing Pre-Chat Card
- Glanceable card rendered before first Sage message
- Content: time-aware greeting, one-line LLM-generated contextual hook, "Open Your Day" CTA
- Lightweight — teases engagement, does not replace conversation
- Day 1 fallback: greeting + "Let's plan your day together" + CTA

### 6. Quick-Reply Buttons for Morning Session
- Beat 2: Suggested intention options based on context + "Something else"
- Beat 3: "Lock it in" / "Add something" / "Change my focus"
- Calendar events rendered as tappable mini-cards inline in Beat 1

---

## Milestone 2b: Home Screen Card-Stack Redesign

### 7. Layout Skeleton
- Time-aware greeting + date
- Session Chips row (Open Day / Capture / Close Day — active by time)
- Hero Card slot (Tier 1, changes by time state)
- Capture Bar (inline, morning + evening only)
- Tier 2 card slots (conditional, ordered by time state)
- Tier 3 ambient card slot (below fold)
- Bottom safe zone (80px for tab bar orb)

### 8. Hero Card with LLM Contextual Line
- Morning: "Open Your Day" + LLM-generated contextual line (personal/warm tone, signals system intelligence)
- Mid-day: "Quick Capture" + static copy
- Evening: "Close Your Day" + LLM-generated contextual line
- API endpoint: `/api/home/contextual-line` — lightweight Claude call
- Fallback lines for Day 1 (no data): "Let's set the tone for your day" (morning), "Wind down and reflect" (evening)
- Priority cascade from Home Page Design spec drives the LLM context
- **Tone guidance:** Personal, warm, demonstrates that Sage evaluates user's own context and gets smarter over time. Not generic motivational. Examples:
  - ✅ "You mentioned wanting more creative time — today's calendar has a gap at 2pm"
  - ✅ "You've been carrying this intention forward for two days now"
  - ✅ "Last night you said you felt energized. Let's channel that"
  - ❌ "A focused morning sets up everything else" (too generic)
  - ❌ "Rise and grind!" (wrong brand entirely)

### 9. Tier 2 Content Cards
- **Calendar Card** — compact one-liner from calendar (amber border)
- **Yesterday's Intention Card** — intention + **Completed** / **Carry forward** actions (blue-gray border)
  - "Carry forward" writes intention into today's context so Sage references it in morning conversation
  - "Completed" marks the intention as done in yesterday's day plan
- **Yesterday's Synthesis Card** — morning only, last journal summary (sage green border)
- **Check-In Card** — mid-day only, references morning intention (amber border)
- **Next Event Card** — mid-day only, next event within ~2hrs (amber border)
- **Breadcrumbs Card** — evening only, today's captures as blockquotes (sage green border)
- **Captures Today Card** — mid-day only, compact capture list (sage green border)
- **Morning Intention Recall Card** — evening only, "You set out to..." (blue-gray border)
- All cards conditional — render only when data exists, no empty states

### 10. Tier 3 Ambient Card
- "Something to Sit With" — rotating reflective prompt pool
- Static pool (10-15 hardcoded prompts for MVP)
- Morning + evening states only

### 11. Home Data API Enhancement
- Expand `home-data.ts` to fetch: day plan, captures, yesterday's journal, calendar events
- `getContextualLine()` LLM call (caching strategy TBD)
- Graceful degradation: Day 1 shows hero + capture bar + ambient only

### 12. Tab Bar & Voice Orb Updates
- Contextual orb routing: morning -> open_day, mid-day -> quick_capture, evening -> close_day
- Extend existing M1 implementation

### 13. Capture Bar Component
- Slim inline strip: text cursor icon + "Drop a thought"
- Tap triggers **inline expansion**: text field grows in place, mic button appears, user types or speaks, hits send, bar collapses back
- No navigation, no context switch, no bottom sheet or full-screen takeover
- Captures append to today's day plan Quick Capture section
- Morning + evening only

---

## Milestone 2c: Life Map Tab Enrichment

### 14. Life Map Tab Redesign
- Absorb from Home: north star narrative, active commitments, boundaries, quarterly focus
- Keep: radar chart, domain cards with status
- New layout: radar chart -> narrative sections -> domain cards
- Layout approach TBD (scrollable page vs tabs/sections)

### 15. Home Screen Content Cleanup
- Remove identity content from home (north star, boundaries, commitments)
- Verify no broken references or empty states

---

## Milestone 3: Quick Capture + Mid-Day + Full Daily Rhythm

### 16. Quick Capture Input Surface
- Dedicated capture flow: tap -> record/type -> save -> done (no AI conversation)
- Voice + text input via existing pipeline
- Entry points: capture bar (inline expansion), mid-day voice orb, session chips "Capture" button
- `quick_capture` session type (write-only, no conversation)
- All captures append to today's day plan Quick Capture section

### 17. Simple AI Classification
- Lightweight LLM call post-capture: classify as thought / task / idea / tension
- Auto-tag with relevant domain tags from life map
- Store in capture frontmatter; no routing logic

### 18. Capture File System
- Wire `UserFileSystem.writeCapture()`, `listCaptures()`, `readCapture()`
- Writes to `captures/{date}-{timestamp}.md`
- Auto-generated frontmatter with classification

### 19. Capture -> Evening Synthesis Integration
- Update `close_day` context injection to read today's captures AND today's day plan
- Update close-day skill/prompt: "You dropped N thoughts today..." and "You set out to [intention]..."
- Captures listed in journal artifact
- Set `folded_into_journal: true` on capture frontmatter after synthesis

### 20. Mid-Day Nudge
- Push notification referencing morning intention
- One-tap response: Yes / Not yet / Snooze
- Trigger: system-initiated, mid-afternoon (~2-3pm)
- Requires today's day plan (user completed Open the Day)
- Delivery method TBD (push notification, home screen card, or both)

### 21. Home Screen Mid-Day Polish
- Wire mid-day cards to real data (captures, nudge responses)
- Card components built in M2b; M3 connects them to live data

---

## Open Questions

### Architecture
1. **OAuth token storage:** Supabase `user_metadata`, separate `integrations` table, or encrypted in Storage?
2. **Skill file location:** Codebase (`/skills/`) or Supabase Storage (user-editable later)?

### Design Inputs
3. **Life Map tab layout:** Single scrollable page or tabs/sections within?
4. **Card transitions between time states:** Currently decided: no animation, render on load. Revisit later if needed.
5. **Yesterday's Intention card — "Completed" action:** Does it write to yesterday's day plan frontmatter? Does it surface in the weekly check-in as a "win"?

### Integration
6. **Mid-day nudge delivery:** Push notification, home screen card, or both?
7. **Calendar card tap action:** Expand inline or deep link to Google Calendar?
8. **LLM contextual line caching:** Per page load, per hour, or per day?

---

## Card Stack Reference (from Home Page Design Spec)

### Morning (before ~11am)
| Order | Component | Tier | Conditional? |
|---|---|---|---|
| 1 | Greeting + Date | -- | No |
| 2 | Session Chips (Open Day active) | -- | No |
| 3 | Hero: "Open Your Day" | T1 | No |
| 4 | Capture Bar (inline expansion) | inline | No |
| 5 | Yesterday's Synthesis | T2 | Yes (needs last night's journal) |
| 6 | Calendar | T2 | Yes (needs calendar) |
| 7 | Yesterday's Intention | T2 | Yes (needs yesterday's day plan) |
| 8 | "Something to Sit With" | T3 | No |

### Mid-Day (~11am - 6pm)
| Order | Component | Tier | Conditional? |
|---|---|---|---|
| 1 | Greeting + Date | -- | No |
| 2 | Session Chips (Capture active) | -- | No |
| 3 | Hero: "Quick Capture" | T1 | No |
| 4 | Check-In | T2 | Yes (needs today's day plan) |
| 5 | Next Event | T2 | Yes (needs calendar, event within ~2hrs) |
| 6 | Captures Today | T2 | Yes (needs captures from today) |

### Evening (after ~6pm)
| Order | Component | Tier | Conditional? |
|---|---|---|---|
| 1 | Greeting + Date | -- | No |
| 2 | Session Chips (Close Day active) | -- | No |
| 3 | Hero: "Close Your Day" | T1 | No |
| 4 | Capture Bar (inline expansion) | inline | No |
| 5 | Breadcrumbs | T2 | Yes (needs captures from today) |
| 6 | Morning Intention Recall | T2 | Yes (needs today's day plan) |
| 7 | "Something to Sit With" | T3 | No |

---

## Data Dependencies

| Data Source | Cards That Use It | Available In |
|---|---|---|
| `day-plans/{date}.md` | Hero context, Yesterday's Intention, Check-In, Morning Intention Recall, Carry Forward | M2a |
| `daily-logs/{date}.md` | Yesterday's Synthesis, Hero context | M1 (done) |
| `captures/{date}/*.md` | Breadcrumbs, Captures Today, Hero context (count), Day Plan Quick Capture section | M3 |
| Google Calendar | Calendar card, Next Event, Hero context, Morning Beat 1 briefing | M2a |
| Reflective prompts | "Something to Sit With" | M2b (static pool) |
| Client time | Greeting, chip active state, card stack ordering, orb behavior | M1 (done) |

---

## References

- Home Page Design spec: `Docs/feedback/20260218_Home_page_design.md`
- Daily Rhythm spec: `Docs/feedback/20260218_MeOS_Daily_Rhythm.md`
- M1 Design doc: `Docs/plans/2026-02-18-milestone1-close-the-day-design.md`
- Steering: `Docs/STEERING.md`
- Magic Patterns designs: `inspiration/20260218_Homescreen_design/`