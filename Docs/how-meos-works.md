# How MeOS Works

A guide to the architecture, data model, AI system, and user experience of MeOS — written for someone who wants to understand the full picture of what this thing is and how the pieces fit together.

---

## 1. What Is MeOS?

MeOS is an AI life partner app. You talk to an AI guide called **Sage**, and through conversation, it builds a structured picture of your life — your priorities, tensions, goals, and blind spots. Then it keeps you aligned through a daily rhythm of lightweight rituals (a 2-minute morning intention and a 2-3 minute evening reflection) and deeper weekly check-ins that synthesize your daily data into patterns and insight.

The core insight behind the product: **people can talk about their lives far more easily than they can write, organize, or plan.** If AI can listen to messy verbal input and progressively structure it, you unlock the entire population that bounced off every productivity tool they've ever tried.

A second insight shapes the daily experience: **users don't want to "journal." They want to close their day and wake up with clarity.** The journaling happens as a side effect of rituals they already want to do. The product is designed around the *flow*, not the *feature* — the daily rhythm produces structured data as its output, and that data compounds into richer weekly reflections.

MeOS is not a to-do app. It's not a journal. It's not a therapist. It's closer to what a great executive coach does — holds the full picture of your life, remembers what you said yesterday and last week, and gently calls you out when reality doesn't match your stated intentions. Except it costs a fraction of what coaching costs and it's available any time.

### What makes it different

| Tool | What it does well | What it's missing |
|------|------------------|-------------------|
| **ChatGPT / Claude** | Brilliant conversation | Forgets you between sessions |
| **Notion / Obsidian** | Remembers everything | Requires you to already be organized |
| **Therapy** | Deep understanding | Expensive, not action-oriented |
| **Executive coaching** | Persistent + challenging | $200-500/hr, doesn't scale |
| **Habit apps** | Low friction | No understanding of *you* |
| **MeOS** | Persistent understanding + conversation + zero setup | Early stage, still being built |

The bet is that accumulated understanding — built through structured conversation over weeks and months — becomes a moat that's hard to replicate by switching to another app.

---

## 2. The Big Picture: How It All Fits Together

At the highest level, MeOS has three layers working together:

### The Frontend (what you see)

A mobile-first web app (technically a PWA — a website that behaves like a native app). Built with **Next.js** and **Tailwind CSS**. Four main screens: Home, Chat, Life Map, and History. The design is warm — soft amber, cream backgrounds, earth tones. It's deliberately not a dashboard or a spreadsheet. It should feel like a calm, thoughtful journal.

### The Backend (what stores your data)

**Supabase** handles two things:
- A **Postgres database** for structured data: user accounts, sessions, messages, pulse check ratings. Think of this as the plumbing — it tracks *what happened* and *when*.
- **File storage** for your actual life content: your life map, life plan, check-in summaries, and Sage's notes about you. These are stored as **markdown files** (more on why below).

### The AI (what thinks)

**Claude** (Anthropic's AI) powers Sage. Every time you send a message, the system loads up Sage's personality instructions, your life map, your recent check-in history, and your current conversation — then asks Claude to respond as Sage. Claude doesn't just chat back. It also produces structured output that the system parses and saves to your files.

### The flow in one sentence

> You talk (voice or text) → Sage responds with insight and structured output → the system saves that output as markdown files → those files become Sage's memory for next time → your Life Map and Home screen update to reflect what changed.

This loop is the entire product. Everything else exists to support it.

---

## 3. The User Experience: Screen by Screen

### First-time experience: Onboarding

The onboarding is designed around one principle: **get to the conversation as fast as possible.** No tutorials, no feature tours, no "here are 5 things MeOS does." The life mapping conversation *is* the onboarding.

After signing in, new users go through a 4-screen sequence:

**Screen 1 — Sage says hello**

A centered, minimal screen. Sage introduces itself: *"Hey — I'm Sage. I'm going to help you build a map of where you are in life right now."* The user enters their first name (so Sage can address them personally going forward), then taps a single "Let's go" button.

This screen sets the tone. It's warm, it's simple, and it signals that this isn't a form to fill out — it's a conversation to have.

**Screen 2 — "What brought you here?"**

A single question, full screen. Four options like "Feeling scattered — need more focus" or "Going through a transition." The user taps one and it auto-advances. This selection gets stored and Sage references it in the opening conversation — so right from the first message, Sage feels like it's paying attention.

**Screen 3 — Trust-building mini-conversation**

A short scripted exchange (not AI-generated) where Sage asks a couple of follow-up questions based on what the user selected. This serves two purposes: it builds the conversational rhythm before the real AI conversation starts, and it collects a bit more context for Sage to work with.

**Screen 4 — Pulse check (rating your life domains)**

The user rates 8 life domains on a simple 1-5 scale: Career, Relationships, Health, Finances, Learning, Creative Pursuits, Play, and Meaning/Purpose. Each domain gets its own full screen — one at a time, not a grid of sliders. A horizontal row of 5 circles, labeled "Rough" on the left and "Thriving" on the right. Tap, it fills with amber, auto-advances to the next domain.

At the end, a radar chart draws outward from the center, showing the shape of the user's life at a glance. Below it, Sage says: *"I can see some patterns already. Ready to explore?"*

This is the bridge into the real conversation. The user taps "Start Conversation" and lands in the chat view, where Sage's first message reflects on the pulse check ratings and suggests which domain to explore first (usually the lowest-rated one).

### The Conversation View (Chat)

This is the most important screen in the app. It's where the actual work happens — where users talk to Sage and see their life map being built in real time.

**Layout:**
- Full-screen chat interface, messages scrolling vertically
- A large amber voice button at the center-bottom (60px circle, the most prominent element on screen)
- A smaller text input field below it
- Sage's messages appear on the left with warm styling; the user's messages appear on the right

**Voice flow:**
1. Tap the voice button — it starts recording, animates to show it's listening
2. Speak as long as you want (elapsed time is shown)
3. Tap again to stop — the audio gets sent to a transcription service (OpenAI's Whisper)
4. The transcript appears as your message in the chat
5. Sage responds in text

Voice is the *default* input. The text field is there as a fallback, but the product is designed around talking. The voice button is deliberately oversized and warm-colored — it should feel like an invitation to speak, not a utilitarian record button.

**Domain cards (the key innovation):**

When Sage finishes exploring a life domain during a life mapping session, it produces a structured summary. The system parses this and renders it as a **domain card** — a visually distinct card that appears inline in the conversation. It shows the current state, what's working, what's not working, the key tension, and the stated intention for that domain.

This is critical UX: **the user sees value accumulating in real time.** They can watch their life map building as they talk. This is the dopamine hit — visible progress, built through conversation, not through filling out forms.

After each domain card, quick-reply buttons appear: "Explore Relationships", "Explore Health", etc., plus a "Wrap up" option. This keeps the session moving without decision fatigue.

**Synthesis card:**

When the user wraps up the session, Sage pulls everything together into a synthesis — a narrative summary, the user's "north star" (the one thing that, if pursued, unlocks the most), top priorities, key tensions, and boundaries (things the user is explicitly *not* focusing on right now). This appears as a special full-width card at the end of the conversation.

### Home Screen

The home screen is a **time-aware contextual concierge** — it knows what time of day it is and surfaces the most relevant action. Think of a concierge who knows your schedule, not a wall of status panels.

The design principle is: **what's happening now and what's next.** Identity-level content (north star, commitments, boundaries) lives on the Life Map tab, not here. The home screen is lightweight and action-oriented.

It's built as a **card stream** that reorders based on time of day:

**Morning (before ~11am):**
1. Hero card: "Open your day" CTA
2. Today's calendar summary
3. Yesterday's intention check
4. "Something to sit with" reflection prompt

**Mid-day (~11am - 6pm):**
1. Hero card: Quick capture CTA ("Drop a thought")
2. Mid-day nudge card (if commitment check is due)
3. Calendar: what's next
4. Context-aware card (e.g., "Your 1:1 just ended. Anything worth capturing?")

**Evening (after ~6pm):**
1. Hero card: "Close your day" CTA
2. Today's breadcrumbs (quick captures as a mini-timeline)
3. Morning intention recall — "You set out to..."
4. Next check-in (if within 2 days)

All features remain accessible at all times — the time-based behavior only affects the *default action* and *card ordering*, never removes functionality. A quick capture button is always visible regardless of time.

The large voice button at the bottom is also contextual: in the morning it defaults to "Open your day," in the evening to "Close your day," and mid-day to quick capture. A long-press always opens a free conversation with Sage.

The home screen is *not* a dashboard. There are no metrics walls, no guilt-inducing streaks, no red badges.

### Life Map View

Accessible from the bottom tab bar. This is the structured view of everything Sage has learned about the user. It has two tabs:

**"Where I Am"** — The identity/reflection layer. Shows:
- The narrative summary (Sage's "coach notes" about the user's overall life situation)
- Domain cards for all 8 life areas, each showing status (thriving / stable / needs attention / in crisis), a summary, and stated intentions
- Domains the user hasn't explored yet show a gentle "Explore with Sage" prompt

**"Who I Am & What I'm Doing"** — Identity and direction content that used to live on the home screen now lives here, making this tab richer and freeing the home screen to be a lightweight concierge. Shows:
- North star (primary compounding engine) — highlighted card with "because" clause
- Active commitments with progress indicators and next steps
- Quarterly priorities, tensions, and boundaries
- Quarter theme (a phrase capturing what this season is about)
- Radar chart from pulse check (baseline + current)

### History View

A reverse-chronological list of past sessions. Each entry shows the date, session type (life mapping, daily journal, day plan, weekly check-in), an AI-generated summary, and key themes as tags. Daily sessions are grouped by date for scannability. Tappable to see the full conversation transcript.

---

## 4. The Core Conversations

MeOS delivers several distinct conversation types, each with a different cadence, depth, and purpose. They form a layered system: life mapping builds the foundation, the daily rhythm maintains daily engagement, and weekly check-ins deepen understanding over time.

### Life Mapping (the magic moment)

A 20-30 minute guided conversation where Sage walks the user through their life domains and builds a structured life map. This is the first experience and the most important one. If this conversation makes someone feel *understood*, they'll come back. If it doesn't, nothing else matters.

**The arc:**

**Phase 1 — Opening (2-3 min):** Sage references the pulse check data and the user's stated intent from onboarding. It suggests which domain to start with based on the ratings. The user can accept or pick a different one.

**Phase 2 — Domain exploration (15-25 min):** For each domain, Sage follows a mini-arc:
1. "Tell me about where things stand with [domain] right now."
2. "What's going well here?"
3. "What's frustrating or stuck?"
4. "If things were going really well here in a year, what would that look like?"
5. Names tensions: "You said you want to grow in your career but also that you're burned out. How do you think about that tension?"
6. Confirms intentions: "So if I'm hearing you right, the thing you most want to move on here is [X]. Is that fair?"

Sage doesn't ask all 6 questions mechanically — if the user's initial response is rich enough, it skips ahead. It follows emotional energy — if the user gets animated about something, Sage goes deeper there.

After each domain, a domain card appears inline. The user picks the next domain or wraps up. Minimum 2-3 domains for a useful map; all 8 if the user wants.

**Phase 3 — Synthesis (3-5 min):** Sage pulls everything together. The narrative summary, north star, priorities, tensions, and boundaries get written to the user's files. The session completes, and the daily rhythm begins the next day.

### The Daily Rhythm (the primary retention loop)

This is what gives MeOS daily utility. Two short ritualistic sessions bracket the user's day, with lightweight capture in between. Total active time: under 5 minutes per day.

```
Morning:   "Open the Day"    — intention, calendar-aware       (2 min)
Mid-day:   Quick Captures     — voice memos, thoughts           (10 sec each)
Evening:   "Close the Day"   — reflect, synthesize, release    (2-3 min)
```

**"Close the Day" (evening):** Sage loads today's day plan, calendar, and any quick captures, then asks ONE specific question drawn from the day's context — maybe referencing a capture from the afternoon, or checking how a morning intention went. The user responds (voice or text, 1-3 messages). Sage doesn't push for depth — this is a 2-minute wind-down, not a therapy session. It closes with warmth ("Thanks for checking in. Sleep well."), then produces a **journal artifact** — a structured markdown file with rich metadata (energy level, mood signal, domains touched, intention fulfillment). A compact **JournalCard** appears inline as a "receipt" confirming what was captured.

Key behavioral rules for Close the Day:
- Never push for more depth than offered
- Never make it feel like a performance review
- Do NOT suggest action items (that's morning territory)
- Capture energy/mood only if naturally expressed — don't ask for a rating

**"Open the Day" (morning):** Before any conversation, the user sees a briefing card with today's calendar, active priorities, and yesterday's reflection summary. Then Sage asks one contextual question drawn from the calendar and priorities — something like *"You've got a packed afternoon — what's the one thing that would make today feel like a win?"* The user responds. One follow-up at most. Done. Sage produces a **day plan artifact** with the user's stated intention for the day.

**Quick Capture (mid-day):** Not a conversation at all. One button, one action: talk or type, hit save, done. No AI response. The system transcribes, auto-classifies the thought (task, idea, reflection, tension), and saves it. These captures surface during the evening session — Sage references them when asking the closing question. They also feed into weekly check-ins.

**Mid-day Nudge:** A single system-initiated notification tied to the morning intention: *"You set an intention to protect your maker block. Still on track?"* One tap: yes / no / snooze. This is micro-accountability, not a guilt trigger.

**Why this matters for the product:** The daily rhythm solves the biggest gap in the original design — the 7-day void between weekly check-ins. After life mapping, the next event used to be a week away. Now it's tomorrow morning. By the time the first weekly check-in arrives, the user has already built a daily relationship with Sage and generated a week of structured data. The check-in isn't a cold re-engagement — it's a natural deepening.

### Weekly Check-In (the deepening loop)

A 5-10 minute conversation that happens weekly. With the daily rhythm in place, check-ins are dramatically richer — Sage synthesizes 7 days of structured daily data instead of asking "how was your week?" cold.

**The flow:**

1. **Opening:** "Hey, welcome back. How are you doing?" — simple, warm, but grounded in data. Sage has the week's journals, day plans, and captures already loaded.
2. **Review against intentions:** Sage references daily data concretely: "Looking at your week — you set intentions to focus on the side project Monday and Wednesday, but your journals suggest you got pulled into work fires both times. What happened there?" This is dramatically more specific than asking "how did it go?" from memory.
3. **Pattern surfacing:** Daily data makes patterns visible faster. Sage can compare day plan intentions against journal reflections across the whole week: "Your energy dipped every afternoon this week. Your journals mention grinding through meetings each time. Is this a scheduling issue or something deeper?"
4. **Energy check:** Sage may already have energy signals from daily journals — it references them rather than asking cold: "Your energy seemed to drop mid-week. What was going on?"
5. **Forward-looking:** "What's the one thing you want to be true by next time we talk?" Not a task list — one thing. Sage remembers it and opens the next check-in by asking about it.
6. **Life map update:** After the check-in, the life map and life plan get quietly updated — new patterns added, intentions revised, domain assessments shifted based on the week's accumulated data.

### What Sage is (and isn't)

Sage has a specific personality that matters for the product:

- **Warm therapist energy** — empathetic, reflective, gentle
- But **opinionated** — gives structure, advises on prioritization, and manages expectations
- **Challenges with curiosity, not judgment** — "I notice you listed seven priorities — in my experience, trying to change everything at once usually means nothing changes. Want to talk about what matters most right now?"
- **Mirrors before advising** — reflects back what it heard before offering perspective
- **Names the unspoken** — identifies emotions and tensions the user hasn't articulated yet
- **Concise** — 2-3 sentences typical, longer only when synthesizing. Ends each turn with one clear question.

Sage is *not* a therapist (doesn't diagnose or treat), not a cheerleader (doesn't blindly affirm), not a task manager (doesn't nag about to-dos), and not a friend (maintains gentle professional warmth without pretending to be a buddy).

---

## 5. How Data Flows Through the System

This section traces what happens from the moment a user speaks to the moment their life map updates. It's the most technical section, but it's worth understanding because the data flow *is* the product.

### Step 1: User input

The user either speaks (voice → transcription → text) or types directly. Either way, the input becomes a text message that gets saved to the `messages` table in the database.

### Step 2: Building context for Sage

Before sending the message to Claude, the system assembles Sage's "memory" by reading the user's markdown files:

1. **Sage's working model** (`sage/context.md`) — Sage's notes on who this person is, how to talk to them
2. **Life map overview** (`life-map/_overview.md`) — The narrative summary, north star, priorities
3. **Current life plan** (`life-plan/current.md`) — Active commitments and next steps
4. **Recent check-ins** (last 3 files in `check-ins/`) — What's been discussed recently
5. **Flagged domains** — Any domain files with `needs_attention` or `in_crisis` status
6. **Pulse check baseline** — The initial ratings from onboarding

All of this gets injected into the system prompt alongside Sage's personality instructions and the current conversation history. This is how Sage "remembers" — not by having a persistent memory, but by re-reading the user's files every time.

### Step 3: Claude generates a response

The system sends everything to Claude's API. Claude responds as Sage — conversational text plus structured `[FILE_UPDATE]` blocks when it's time to write to the user's files.

A `[FILE_UPDATE]` block looks like this in the raw output:

```
[FILE_UPDATE type="domain" name="Career / Work"]
# Career / Work
## Current State
Senior PM at a mid-stage startup, 2 years in. Competent but not excited.
## What's Working
- Good at the craft
- Team respects you
- Financially stable
## Key Tension
Security vs. entrepreneurial ambition
## Stated Intentions
- Explore starting something on the side within the next 3 months
[/FILE_UPDATE]
```

The user never sees this raw format. The system parses it and renders it as a polished domain card in the conversation.

### Step 4: Parsing and file writing

A parser extracts the `[FILE_UPDATE]` blocks from Sage's response. For each block:

1. **Resolve the path** — The `type` and `name` fields map to a specific file. For example, `type="domain" name="Career / Work"` resolves to `life-map/career.md`.
2. **Check permissions** — Each session type has a whitelist of paths it's allowed to write to. A life mapping session can write to `life-map/` files but not to `check-ins/`. This prevents the AI from accidentally (or through prompt injection) writing where it shouldn't.
3. **Generate frontmatter** — The system automatically adds YAML metadata to the top of the file: timestamps, version numbers, status. Sage only writes the markdown content; the system handles the bookkeeping.
4. **Write the file** — The markdown file gets saved to Supabase Storage under the user's directory.

### Step 5: UI updates

The conversation view shows the parsed response immediately — structured blocks render as domain cards or synthesis cards inline. The next time the user visits their Home or Life Map screen, it reads from the updated files and displays the latest state.

### The markdown file system (why files, not database rows)

This is a deliberate architectural choice. Instead of storing life map content as rows in a Postgres table, MeOS stores it as **markdown files** in Supabase's file storage.

Each user has a file tree like this:

```
users/{user_id}/
  life-map/
    _overview.md            # Narrative summary, north star, priorities, tensions, boundaries
    career.md               # Career / Work domain
    relationships.md        # Relationships domain
    health.md               # Health / Body domain
    finances.md             # ... and so on for all 8 domains
  life-plan/
    current.md              # Quarter theme, active commitments, next steps
  daily-logs/
    2026-02-18-journal.md   # Evening journal entries (one per day)
  day-plans/
    2026-02-18-plan.md      # Morning day plans (one per day)
  captures/
    2026-02-18-1414.md      # Quick captures (multiple per day, timestamped)
  check-ins/
    2026-02-14-weekly.md    # Weekly check-in summaries
  sage/
    context.md              # Sage's working model of the user
    patterns.md             # Patterns Sage has observed
```

The daily files (`daily-logs/`, `day-plans/`, `captures/`) are the **leaf nodes** — the smallest, most frequent units of capture. Everything else (weekly check-ins, life map updates) is a computed layer that synthesizes those leaf nodes upward. This "capture down, synthesize up" architecture means weekly check-ins get dramatically richer over time without any extra effort from the user.

**Why markdown?** A few reasons:
- It's **human-readable** — you can open any file and understand what's in it without a database client
- It's **natural for AI** — Claude is great at reading and writing markdown, much better than generating SQL or JSON schemas
- It's **portable** — if the product dies or the user wants their data, it's just files
- It's **version-friendly** — each file has a version number in its frontmatter, making it easy to track changes over time

Each file has YAML frontmatter (auto-generated by the system) at the top with metadata, followed by the markdown content (written by Sage). For example, a domain file might look like:

```yaml
---
domain: Career / Work
status: needs_attention
score: 2
last_updated: 2026-02-15T10:30:00Z
updated_by: sage
version: 3
schema_version: 1
---
```

Followed by the actual content about the user's career situation.

### The session state machine

The system needs to know what to do when a user opens the app. A function called `detectSessionState` checks the database and returns one of these states:

| State | What it means | What happens |
|-------|--------------|--------------|
| `new_user` | Haven't completed onboarding | Redirect to onboarding flow |
| `mapping_in_progress` | Started life mapping but didn't finish | Resume where they left off |
| `mapping_complete` | Finished mapping, no check-in due | Show the home screen normally |
| `checkin_due` | Check-in is within 24 hours | Show check-in prompt prominently |
| `checkin_overdue` | Check-in is more than 24 hours overdue | Gentle nudge to check in |
| `mid_conversation` | Has an active session with messages | Resume the conversation |

On top of this, the system tracks **daily rhythm state**: whether the user has opened/closed their day today, how many captures they've made, and when they last completed an evening session. This drives the home screen's time-aware card ordering — the hero card changes from "Open your day" (morning) to "Drop a thought" (mid-day) to "Close your day" (evening) based on both time of day and what the user has already done today.

This combined state awareness is what makes the app feel responsive to where you are in the journey and the rhythm of your day, rather than showing the same screen every time.

---

## 6. How Sage (the AI) Works

### System prompts

Every conversation with Sage starts with a **system prompt** — a set of instructions that tells Claude who Sage is, how to behave, and what to produce. There are different prompts for different session types:

**Life mapping prompt** instructs Sage to:
- Guide the user through life domains one at a time
- Follow the opening → domain exploration → synthesis arc
- Produce `[FILE_UPDATE]` blocks with specific formatting
- Keep responses to 2-3 sentences, ending with one question
- Follow emotional energy rather than rigidly following a script
- Never be performatively positive or rewrite hard truths

**Weekly check-in prompt** instructs Sage to:
- Reference the user's life map, daily journals, day plans, and captures from the past week
- Ask about progress on stated commitments using concrete daily data
- Surface patterns when they appear (comparing day plan intentions against journal reflections)
- Keep it to 5-10 minutes
- Close by asking for one intention for the coming week
- Produce file updates for the check-in summary and any changed domains

**Close the Day prompt** instructs Sage to:
- Load today's day plan, calendar, quick captures, and yesterday's journal
- Open with ONE specific question drawn from the day's context
- Accept whatever depth the user offers — never push for more
- Never suggest action items (that's morning territory)
- Close with warmth ("Thanks for checking in. Sleep well.")
- Produce a journal artifact in `daily-logs/` with structured frontmatter
- Render a compact JournalCard as a receipt

**Open the Day prompt** instructs Sage to:
- Load today's calendar, life plan priorities, yesterday's journal, and unprocessed captures
- Open with ONE contextual question about the day's intention
- Allow at most one follow-up, then close
- Produce a day plan artifact in `day-plans/` with intention and key commitments

An important detail: the prompts tell Sage to **never rename commitment headings**. In the life plan file, each commitment has a heading like `### Have the conversation with my manager`. These headings serve as identity keys — they're how the system tracks the same commitment across multiple check-ins. If Sage rewrote the heading, it would break continuity tracking.

**The agent-native insight:** Each session type is essentially a *skill* — a text-based description of the conversational arc, available tools, read/write permissions, and output format. Iterating on the experience means editing skill files, not rewriting code. The tools themselves are atomic and simple (read file, write file, list files, read calendar), and Sage combines them to produce the desired outcome.

### Context injection (how Sage "remembers")

Sage doesn't have persistent memory between conversations. Every time a new message is sent, the system rebuilds Sage's context from scratch by reading the user's markdown files.

Crucially, **different session types read different context** to stay focused and manage token costs:

- **Close the Day** reads: today's day plan, today's calendar, today's captures, life map overview, yesterday's journal, Sage's working model
- **Open the Day** reads: today's calendar, life plan priorities, yesterday's journal, unprocessed captures from yesterday, Sage's working model
- **Weekly check-in** reads: all daily journals since last check-in, all day plans since last check-in, all captures since last check-in, full life map, life plan, last check-in summary, Sage's working model
- **Life mapping** reads: pulse check ratings, any existing life map files, life plan, Sage's working model
- **Ad hoc** reads: Sage's working model, life map overview, life plan, last 3 check-in summaries

This is the "capture down, synthesize up" principle in action. Daily sessions produce atomic data. Weekly check-ins consume that data for deeper synthesis. Each layer reads from the layers below it.

Full conversation transcripts are stored in the database for the user to review, but they are *not* injected into Sage's context (too expensive, too noisy). Instead, the structured artifacts (journals, day plans, check-in summaries) serve as compressed memory — the important themes, commitments, and patterns, without the verbatim back-and-forth.

### Structured output (the `[FILE_UPDATE]` protocol)

This is the mechanism that turns conversation into persistent data. When Sage needs to write to a user's file, it wraps the content in a `[FILE_UPDATE]` block with a `type` and optional `name`:

- `type="domain" name="Career / Work"` → writes to `life-map/career.md`
- `type="overview"` → writes to `life-map/_overview.md`
- `type="life-plan"` → writes to `life-plan/current.md`
- `type="check-in"` → writes to `check-ins/{date}-weekly.md`
- `type="daily-journal"` → writes to `daily-logs/{date}-journal.md`
- `type="day-plan"` → writes to `day-plans/{date}-plan.md`
- `type="sage-context"` → writes to `sage/context.md`
- `type="sage-patterns"` → writes to `sage/patterns.md`

The parser runs on every message from Sage, extracting these blocks and routing them to the file write handler. Importantly, Sage writes **only the markdown body** — the system auto-generates the YAML frontmatter (timestamps, version numbers, status). This prevents the AI from accidentally breaking the metadata format.

### Security guardrails

There are several layers preventing bad things from happening:

**Session-scoped write permissions:** Each session type has a strict whitelist of paths it can write to. A life mapping session can only write to `life-map/`, `life-plan/current.md`, and `sage/`. A Close the Day session can only write to `daily-logs/` and `sage/context.md` — it literally cannot touch the life map. A quick capture can only write to `captures/`. This boundary is critical: daily sessions produce data but don't mutate the life map. Only weekly check-ins have permission to update life map files, ensuring that identity-level changes happen through deliberate reflection, not a quick evening note. Even if someone tried to manipulate Sage through prompt injection, the system would reject unauthorized writes.

**Path validation:** File paths are checked against a whitelist of allowed prefixes. Path traversal attacks (like `../../etc/passwd`) are explicitly blocked.

**File type whitelist:** Only known file types (`domain`, `overview`, `life-plan`, `check-in`, `daily-journal`, `day-plan`, `sage-context`, `sage-patterns`) are accepted. Unknown types from AI output get rejected.

**Rate limiting:** Maximum 20 API requests per minute per user, and maximum 10 file updates per AI message.

---

## 7. The Design Language

MeOS has an opinionated visual identity that's integral to the product experience. It's not decoration — the warmth of the interface is what makes people feel comfortable enough to talk about their lives.

### Warm, not clinical

The color palette is built around soft amber and earth tones:
- **Primary:** Soft amber / warm gold (`#D4A574`) — used for the voice button, CTAs, selected states
- **Background:** Warm off-white / light cream (`#FAF7F2`) — not pure white
- **Text:** Dark warm gray — not pure black
- **Accents:** Muted earth tones — terracotta, sage green, soft navy
- **Domain status:** Green (thriving), warm yellow (stable), soft orange (needs attention), muted red (in crisis)

The overall feel should be: a warm, well-designed journal meets a calm, thoughtful conversation. Not a dashboard. Not a productivity tool. Not a clinical interface.

### Voice button as hero element

The voice button is the single most important UI element. It's a 60px amber circle, center-bottom of the screen, with a subtle pulse animation when idle. When recording, it grows slightly and shows a waveform. When processing, it shows a loading state.

It's designed to feel like a warm invitation to speak — not a utilitarian record button. The size and prominence signal: "the primary way you interact with this app is by talking."

The voice button is also **contextual by time of day**: in the morning it defaults to opening the "Open your day" flow, in the evening to "Close your day," and mid-day to quick capture. A long-press always opens a free conversation with Sage regardless of time. This means the single most prominent UI element adapts to what the user most likely wants to do right now.

### Typography

Clean, humanist sans-serif (Satoshi). Generous line height for readability. Sage's messages have slightly different styling from the user's — warmer background, subtle visual distinction.

### Design principles in practice

**No guilt-inducing UI:** No streaks, no scores, no red badges for missed check-ins. If the user hasn't checked in, the nudge is warm: "Check-in's tomorrow. Take a minute to notice how the week felt." Not: "You missed your check-in! Your streak is broken!"

**No empty states:** Every screen feels alive even before the user has data. Pre-life-mapping, the home screen shows a Sage greeting and a "Ready to map your life?" button. The life map shows a soft nudge toward starting a conversation. Nothing is blank.

**Progressive disclosure:** Simple on day 1, richer on day 30. The app feels almost empty at first — just you and Sage. Features reveal themselves as you generate data.

**Conversation is the product:** Other screens (Home, Life Map, History) exist to support and display conversation outputs. The chat view is where the magic happens. Everything else is a reflection of what emerged from talking to Sage.

---

## 8. What's Built vs. What's Planned

### What works today (Sprint 1)

- **Authentication:** Sign in via Google OAuth or email magic link
- **Onboarding flow:** 4-screen sequence (Sage intro with name collection, intent selection, trust-building mini-conversation, pulse check with radar chart)
- **Life mapping conversation:** Full guided session with Sage, domain-by-domain exploration, structured output that writes to markdown files
- **Weekly check-in conversation:** Sage references life map and prior sessions, surfaces patterns, produces file updates
- **Home screen:** Narrative layout with greeting, Sage's contextual line, north star card, active commitments, check-in prompt
- **Life Map view:** Two-tab layout ("Where I Am" with domain cards, "What I'm Doing" with life plan)
- **History view:** Past sessions with summaries and full transcript access
- **Voice input:** Record → transcribe → display as message (using OpenAI Whisper)
- **Markdown file system:** Full read/write pipeline with auto-generated frontmatter, session-scoped permissions, file indexing
- **Session state detection:** System knows whether you're a new user, mid-conversation, or due for a check-in

### Known issues from playtesting

Some things surfaced during early testing that are being worked on:

- Voice transcription has reliability issues (sometimes recording doesn't produce output)
- Domain cards don't always render inline in the conversation (users have to go to the Life Map tab to see them)
- Sage's responses can be too long (4-5 paragraphs when 2-3 would be better for conversational rhythm)
- Domain transitions between topics can feel abrupt — needs a brief emotional acknowledgment before pivoting
- Some markdown rendering artifacts in stated intentions sections

### What's being built next (daily rhythm)

The immediate next milestone is the **daily rhythm** — starting with "Close the Day" (the evening reflection session), followed by "Open the Day" (morning intention with calendar integration), then quick capture and mid-day nudge. This is the primary retention mechanism and the biggest architectural addition since the initial MVP.

### What's not built yet (future milestones)

These are all part of the vision but come after the daily rhythm is validated:

- **Pattern detection** — Automated cross-session analysis of recurring themes, sentiment trends, and intention-vs-reality drift. Daily data makes this dramatically more powerful.
- **Agentic execution** — Sage proposes concrete tasks derived from your commitments, you approve them, agents execute (draft an email, schedule a calendar block, research a topic). The user never types a to-do — tasks are generated from conversation.
- **Monthly and quarterly reviews** — Deeper reflection conversations at longer cadences
- **Text-to-speech** — Sage speaking its responses out loud (currently text only)
- **Monetization** — Freemium model with free life mapping + limited check-ins + daily rhythm, paid unlimited access
- **Native mobile app** — Currently a PWA, eventually a proper iOS/Android app

### The intended progression

The product is being built in milestones, where each milestone validates a hypothesis before the next begins:

1. **Milestone 1 (current):** "Close the Day" — evening reflection session end-to-end. Validates whether the daily habit sticks.
2. **Milestone 2:** "Open the Day" + calendar integration + home screen redesign. Validates the full bookend model.
3. **Milestone 3:** Quick capture + mid-day nudge. Completes the full daily rhythm.
4. **Milestone 4:** Weekly check-in enhancement — reads from daily data, pattern detection. Validates the "capture down, synthesize up" architecture.
5. **Future:** Agentic execution, trust ladder, platform expansion.

The rule is: **don't build the next milestone until the current one has signal.** If people don't come back for the evening ritual, the morning session won't save it. If the daily rhythm doesn't stick, agentic execution is premature.

---

## Closing Note

MeOS is still early. The architecture is in place, the core conversations work, and the markdown file system gives it a solid foundation for persistent memory. The next big question is whether the daily rhythm — closing your day in 2 minutes with Sage, opening it the next morning — becomes a habit that people actually look forward to. If the evening ritual sticks, the morning follows, the quick captures flow naturally, and by the time the weekly check-in arrives, it's synthesizing a week of structured data instead of starting cold.

The most important question is still: does talking to Sage make people feel genuinely understood? The daily rhythm just gives them a reason to find out every single day.
