# How MeOS Works

A guide to the architecture, data model, AI system, and user experience of MeOS — written for someone who wants to understand the full picture of what this thing is and how the pieces fit together.

---

## 1. What Is MeOS?

MeOS is an AI life partner app. You talk to an AI guide called **Sage**, and through conversation, it builds a structured picture of your life — your priorities, tensions, goals, and blind spots. Then it checks in with you weekly to help you stay aligned with what you said matters.

The core insight behind the product: **people can talk about their lives far more easily than they can write, organize, or plan.** If AI can listen to messy verbal input and progressively structure it, you unlock the entire population that bounced off every productivity tool they've ever tried.

MeOS is not a to-do app. It's not a journal. It's not a therapist. It's closer to what a great executive coach does — holds the full picture of your life, remembers what you said last week, and gently calls you out when reality doesn't match your stated intentions. Except it costs a fraction of what coaching costs and it's available any time.

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

The home screen is where returning users land. It tells their story top-to-bottom in a glanceable format.

**From top to bottom:**
1. **Greeting** — "Good morning, [name]"
2. **Sage's contextual line** — A short, specific message that changes based on where the user is. Not generic motivational fluff. Examples: *"Day 5 of the job search pivot. Found any leads worth exploring?"* or *"Check-in's tomorrow. Take a minute to notice how the week felt."*
3. **North star card** — The user's primary focus area, highlighted in a warm card. Includes a "because" clause for substance: not just "Career transition" but "Career transition — because financial independence unlocks everything else."
4. **Active commitments** — The 1-2 things the user said they'd actually do, with inline next steps
5. **Check-in prompt** — When the next check-in is due, with a button to start
6. **Boundaries** — What the user is explicitly choosing not to pursue right now (shown subtly, only when data exists)
7. **"Talk to Sage"** — A full-width button at the bottom

The home screen is *not* a dashboard. There are no metrics walls, no guilt-inducing streaks, no red badges. Just the essentials to orient and get moving.

### Life Map View

Accessible from the bottom tab bar. This is the structured view of everything Sage has learned about the user. It has two tabs:

**"Where I Am"** — The identity/reflection layer. Shows:
- The narrative summary (Sage's "coach notes" about the user's overall life situation)
- North star, quarterly priorities, tensions, and boundaries
- Domain cards for all 8 life areas, each showing status (thriving / stable / needs attention / in crisis), a summary, and stated intentions
- Domains the user hasn't explored yet show a gentle "Explore with Sage" prompt

**"What I'm Doing"** — The action layer (only shown when life plan data exists). Shows:
- Quarter theme (a phrase capturing what this season is about)
- Active commitments with progress indicators and next steps
- Things to protect (systems that are working — don't drop these)
- Boundaries

### History View

A simple reverse-chronological list of past sessions. Each entry shows the date, session type (life mapping or weekly check-in), an AI-generated summary, and key themes as tags. Tappable to see the full conversation transcript.

---

## 4. The Two Core Conversations

MeOS delivers two distinct conversation types right now. Everything else in the product exists to support these.

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

**Phase 3 — Synthesis (3-5 min):** Sage pulls everything together. The narrative summary, north star, priorities, tensions, and boundaries get written to the user's files. The session completes, and the system schedules the first weekly check-in for 7 days later.

### Weekly Check-In (the retention loop)

A 5-10 minute conversation that happens weekly. This is how MeOS stays useful over time — not by being a tool you open when you remember, but by actively checking in on your stated intentions.

**The flow:**

1. **Opening:** "Hey, welcome back. How are you doing?" — simple, warm, open. Not "did you hit your goals?"
2. **Review against intentions:** Sage references the life map and prior check-ins: "Last week you said you wanted to carve out two evenings for the side project. How did that go?" If the user didn't follow through, Sage explores with curiosity, not judgment: "What got in the way? Was it time, energy, motivation, or something else?"
3. **Pattern surfacing (after 3+ check-ins):** Sage notices recurring themes: "This is the third week in a row where work expanded to fill the evenings you'd set aside. I might be wrong, but the obstacle might not be time management — it might be a boundary-setting issue with your job. What do you think?"
4. **Energy check:** A simple pulse on how the user is feeling this week. Tracked over time.
5. **Forward-looking:** "What's the one thing you want to be true by next time we talk?" Not a task list — one thing. Sage remembers it and opens the next check-in by asking about it.
6. **Life map update:** After the check-in, the life map and life plan get quietly updated — new patterns added, intentions revised, domain assessments shifted based on new information.

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
    _overview.md         # Narrative summary, north star, priorities, tensions, boundaries
    career.md            # Career / Work domain
    relationships.md     # Relationships domain
    health.md            # Health / Body domain
    finances.md          # ... and so on for all 8 domains
  life-plan/
    current.md           # Quarter theme, active commitments, next steps
  check-ins/
    2026-02-14-weekly.md # Check-in summaries (one per session)
  sage/
    context.md           # Sage's working model of the user
    patterns.md          # Patterns Sage has observed
```

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

This state machine is what makes the app feel responsive to where you are in the journey, rather than showing the same screen every time.

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
- Reference the user's life map and previous check-ins
- Ask about progress on stated commitments
- Surface patterns when they appear (after 3+ check-ins)
- Keep it to 5-10 minutes
- Close by asking for one intention for the coming week
- Produce file updates for the check-in summary and any changed domains

An important detail: the prompts tell Sage to **never rename commitment headings**. In the life plan file, each commitment has a heading like `### Have the conversation with my manager`. These headings serve as identity keys — they're how the system tracks the same commitment across multiple check-ins. If Sage rewrote the heading, it would break continuity tracking.

### Context injection (how Sage "remembers")

Sage doesn't have persistent memory between conversations. Every time a new message is sent, the system rebuilds Sage's context from scratch by reading the user's markdown files.

This is assembled in priority order (most important first, in case the context window gets tight):

1. Pulse check baseline ratings
2. Sage's working model of the user (`sage/context.md`)
3. Life map overview (`life-map/_overview.md`)
4. Current life plan (`life-plan/current.md`)
5. Last 3 check-in summaries
6. Any domain files that are flagged as needing attention

Full conversation transcripts are stored in the database for the user to review, but they are *not* injected into Sage's context (too expensive, too noisy). Instead, the check-in summaries serve as compressed memory — the important themes, commitments, and patterns, without the verbatim back-and-forth.

### Structured output (the `[FILE_UPDATE]` protocol)

This is the mechanism that turns conversation into persistent data. When Sage needs to write to a user's file, it wraps the content in a `[FILE_UPDATE]` block with a `type` and optional `name`:

- `type="domain" name="Career / Work"` → writes to `life-map/career.md`
- `type="overview"` → writes to `life-map/_overview.md`
- `type="life-plan"` → writes to `life-plan/current.md`
- `type="check-in"` → writes to `check-ins/{date}-weekly.md`
- `type="sage-context"` → writes to `sage/context.md`
- `type="sage-patterns"` → writes to `sage/patterns.md`

The parser runs on every message from Sage, extracting these blocks and routing them to the file write handler. Importantly, Sage writes **only the markdown body** — the system auto-generates the YAML frontmatter (timestamps, version numbers, status). This prevents the AI from accidentally breaking the metadata format.

### Security guardrails

There are several layers preventing bad things from happening:

**Session-scoped write permissions:** A life mapping session can only write to `life-map/`, `life-plan/current.md`, and `sage/`. A weekly check-in can additionally write to `check-ins/`. This means even if someone tried to manipulate Sage through prompt injection (putting instructions in their message to make Sage write to unauthorized files), the system would reject the write.

**Path validation:** File paths are checked against a whitelist of allowed prefixes. Path traversal attacks (like `../../etc/passwd`) are explicitly blocked.

**File type whitelist:** Only known file types (`domain`, `overview`, `life-plan`, `check-in`, `sage-context`, `sage-patterns`) are accepted. Unknown types from AI output get rejected.

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

### What's not built yet (future sprints)

These are all part of the vision but explicitly out of scope for now:

- **Daily nudges** — Morning focus prompts, micro-nudges throughout the day, pattern alerts. This is the "ambient layer" that keeps MeOS present between weekly check-ins.
- **Agentic execution** — Sage proposes concrete tasks derived from your commitments, you approve them, agents execute (draft an email, schedule a calendar block, research a topic). The user never types a to-do — tasks are generated from conversation.
- **Monthly and quarterly reviews** — Deeper reflection conversations at longer cadences
- **Text-to-speech** — Sage speaking its responses out loud (currently text only)
- **Pattern detection** — Sophisticated tracking of recurring themes, sentiment trends, and avoidance patterns across sessions
- **Monetization** — Freemium model with free life mapping + limited check-ins, paid unlimited access
- **Native mobile app** — Currently a PWA, eventually a proper iOS/Android app

### The intended progression

The product is being built in layers, where each layer is valuable on its own but feeds the next:

1. **Layer 0 (now):** Life mapping + weekly check-ins. The core conversation loop.
2. **Layer 1 (next):** Daily nudging. Lightweight daily touches that keep the system present.
3. **Layer 2 (later):** Agentic execution. AI that doesn't just advise but acts on your behalf.
4. **Layer 3+ (long-term):** Full personal operating system — habits, learning, knowledge management, projects.

The rule is: **don't build the next layer until the current one has retention.** If people aren't coming back for weekly check-ins, daily nudges won't save it. If weekly check-ins aren't valuable, there's nothing for daily nudges to build on.

---

## Closing Note

MeOS is still early. The architecture is in place, the core conversations work, and the markdown file system gives it a solid foundation for persistent memory. The most important question isn't technical — it's whether the life mapping conversation makes people feel genuinely understood, and whether the weekly check-in is valuable enough to become a habit.

Everything else follows from that.
