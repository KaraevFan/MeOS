# MeOS Implementation Spec: Day Plan Artifact + Morning Flow Redesign

**Date:** February 20, 2026
**Version:** 2.0
**Context:** Post-Playtest 4 redesign + visual design finalization. Synthesizes all findings from playtesting, competitive research, design brainstorms, product decisions, and four rounds of Magic Patterns visual prototyping into a single implementation-ready spec for Claude Code.

**Visual Reference:** A Magic Patterns code package (/Users/tomoyukikano/Desktop/Projects/Kairn/inspiration/20260220_Day_Plan_Screen_Reference.zip) is provided alongside this spec. It contains the finalized component code, Tailwind color system, typography, and layout structure. Use it as the design source of truth for visual implementation. This spec describes the behavior, data flow, and interaction patterns; the code package shows the look and feel.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [What's Wrong: Playtest 4 Findings](#2-whats-wrong-playtest-4-findings)
3. [Architecture Decision: Replace Chat Tab with Day Tab](#3-architecture-decision-replace-chat-tab-with-day-tab)
4. [The Morning Flow: "Open the Day" Conversation Redesign](#4-the-morning-flow-open-the-day-conversation-redesign)
5. [The Day Plan Artifact: Screen Spec](#5-the-day-plan-artifact-screen-spec) *(major rewrite in v2.0)*
6. [Home Screen Changes](#6-home-screen-changes)
7. [Quick Capture Redesign](#7-quick-capture-redesign)
8. [Bug Fixes](#8-bug-fixes)
9. [System Prompt Changes](#9-system-prompt-changes)
10. [Data Model Changes](#10-data-model-changes) *(updated JSONB structures in v2.0)*
11. [Component Inventory](#11-component-inventory) *(rewritten in v2.0)*
12. [Priority Tiers](#12-priority-tiers) *(rewritten in v2.0)*
Appendix A: Competitive Research Summary
Appendix B: Design Reference — What vs. How
Appendix C: Magic Patterns Code Package Reference *(new in v2.0)*

---

## 1. Executive Summary

### The Core Problem

Playtest 4 revealed a systemic issue: **Sage is great at conversations, but the system around Sage doesn't follow through.** The conversation produces insights, intentions, and captures — then the app has no persistent layer to hold them. The home screen doesn't update meaningfully. The day plan doesn't exist. Captures disappear into a black hole. The "View Day Plan" button routes to the Life Map.

### The Solution

Three connected changes:

1. **Redesign the morning conversation** from an open-ended coaching session into a structured 2-minute launch sequence that produces concrete data.
2. **Build the Day Plan artifact** — a persistent, living document anchored by two hero elements (the user's Intention Card and Sage's Morning Snapshot briefing), with captures accumulating throughout the day and an evening reflection closing it out.
3. **Replace the Chat tab with a Day tab** in the bottom nav, giving the day plan a dedicated home and eliminating the Chat/Orb redundancy.

### The Design Principle

**"Open the Day" is a launch sequence, not a conversation.** The morning flow follows the pattern: **Sage presents → user confirms/adjusts**. This replaces the current pattern: **Sage asks → user elaborates → Sage digs deeper**. It's the difference between a briefing and an interview.

Every step in the morning flow writes to the Day Plan artifact. If a step doesn't produce data that appears on the artifact, cut it.

---

## 2. What's Wrong: Playtest 4 Findings

### Finding 1: The Broken Promise Loop (P0 — Demo Killer)

**What happened:** User completed a ~13 minute morning session. Sage produced the intention: "Build the day plan structure that makes the command center concept obvious." Sage said "You're set. Go make it happen." User tapped "Back to Home," saw "Day Plan Set" with a "View day plan" button. Tapped it. Routed to the Life Map. The day plan doesn't exist.

**Why it's critical:** This is worse than a crash — it's a broken promise. The system told the user it did something, gave them a button to see it, and the button leads nowhere. Actively erodes trust.

**Fix:** The morning session must write to a real Day Plan artifact. "View Day Plan" must route to a real page showing it.

### Finding 2: Quick Capture Black Hole (P0)

**What happened:** User typed a thought into "Drop a thought," hit enter. No visible confirmation. No way to see it again. After investigation with Claude Code: captures save as markdown files in Supabase Storage, get classified in the background, show up briefly as "Today's Breadcrumbs" (only during midday/evening states, max 5), feed into Close the Day, and then essentially disappear. No history, no browsing, no editing, no search.

**Why it's critical:** The system asks users to give it something and provides no evidence it received it. Trust-destroying.

**Fix:** Immediate visual confirmation on capture submit. Captures appear on the Day Plan artifact in real time as a "Captured Thoughts" section.

### Finding 3: Morning Session Too Deep (P1)

**What happened:** Session went 13-20 minutes. Sage asked open questions that invited coaching depth. By minute 8, Sage was asking "What does 'core loops working' mean to you?" — a great coaching question for a weekly check-in, but wrong for a morning ritual at 8:15am.

**Why it's critical:** The header says "~3 min" but the session runs 13-20 minutes. This is a lie. Sets wrong expectations and makes the product feel like a time sink instead of a quick launch.

**Fix:** Redesign the morning flow as a 5-step structured sequence targeting 2 minutes (fast path) to 5 minutes (deep path). See Section 4.

### Finding 4: Quick Reply Button Overuse (P1)

**What happened:** Every single Sage response has quick replies attached. Pattern becomes: Sage asks → user picks pill → Sage asks → user picks pill. Feels like a multiple-choice quiz, not a conversation.

**Why it's critical:** Defeats the purpose of a conversational product. Users should feel like they're talking, not filling out forms.

**Fix:** Quick replies should only appear for bounded choices (which domain to explore, whether to wrap up). Never after open-ended questions. Rule: if Sage's question starts with "what" or "how," skip the pills.

### Finding 5: Visual Density / Message Crowding (P2)

**What happened:** A single voice transcription fills almost the entire viewport. Then Sage's multi-paragraph response fills the next viewport. Only one conversational turn visible at a time on mobile.

**Why it's critical:** Feels claustrophobic. Can't see the conversational arc.

**Fix:** Sage's morning responses must be ≤3 sentences. Consider collapsed transcription display for long voice inputs. Tighten bubble padding.

### Finding 6: Voice Transcription Bugs (P1)

**What happened:** Two issues observed: (1) Timer counts up faster than real time, (2) Transcription terminated before user pressed stop button. Happened twice — confirmed not user error.

**Fix:** Debug voice recording timer. Check for auto-silence-detection causing premature termination.

### Finding 7: Text Input Doesn't Scale (P2)

**What happened:** Text input field doesn't grow with content. No scrolling. Text gets clipped after one line.

**Fix:** Auto-expanding textarea with max-height and scroll.

### Finding 8: Session Timer Static (P2)

**What happened:** Header shows "Open the Day ~3 min" throughout the entire session, even 20 minutes in.

**Fix:** Either show actual elapsed time or remove the label. With the new structured flow, the ~3 min estimate should be accurate.

---

## 3. Architecture Decision: Replace Chat Tab with Day Tab

### Current Tab Structure

```
[Home]  [Chat]  [Life Map]  [History]
```

### New Tab Structure

```
[Home]  [Day]  [Life Map]  [History]
```

### Rationale

- **Chat tab competes with the breathing orb.** Both say "talk to Sage." Having both is redundant and confusing.
- **The Day Plan needs a dedicated home.** It's the primary artifact users interact with daily.
- **Creates "day as atomic unit" mental model.** Each day is a document: morning intention → day shape → captured thoughts → evening reflection.
- **Conversations still happen everywhere.** The breathing orb on the Home screen is the universal "talk to Sage" affordance. Tapping it opens a conversation overlay/modal regardless of which tab you're on. The Chat tab as a standalone destination isn't needed.

### Implementation

- Rename the Chat tab to "Day" in the bottom nav.
- The Day tab renders the Day Plan artifact for today.
- Past days are accessible via History tab (and eventually via swipe-left on Day view).
- Breathing orb remains on Home screen as primary conversation entry point. All session types (morning, check-in, freeform, evening) launch from the orb or from contextual CTAs.

---

## 4. The Morning Flow: "Open the Day" Conversation Redesign

### Design Goals

- **Target: 2 minutes fast path, 5 minutes deep path.** Never 13-20 minutes.
- **Every step writes to the Day Plan artifact.** No step exists purely for conversation warmth.
- **Sage presents, user confirms.** Not: Sage asks, user elaborates, Sage digs deeper.
- **Depth is user-initiated, never Sage-initiated.** If something meaty comes up, Sage captures it and offers to explore later. Does NOT follow the thread in the morning.

### The 5-Step Flow

#### Step 1: Energy Check (~15 seconds)

**Sage says:** "Morning, [name]. How are you feeling heading into today?"

**Input type:** Quick-reply pills (single tap, no typing):

```
🔥 Fired up    ⚡ Focused    😐 Neutral    😴 Low energy    😤 Stressed
```

**Artifact output:** → `MorningSnapshotCard.energy` field

**Why pills here:** This is a closed question with bounded answers. Forcing someone to articulate their mood in words at 7am is asking too much. A single tap captures the signal.

**Important:** This is one of the FEW places quick-reply pills should appear in the morning flow. Not every step gets pills.

#### Step 2: Surface What's Known (~30 seconds)

**Sage says:** A brief, Sage-generated summary of what's already on the plate. Sage reads from: calendar (if connected), Life Map priorities, yesterday's open threads, recent captures. Presents a compact briefing:

> "Here's what I'm seeing for today: You've got [calendar events]. Your current focus area is [Life Map priority]. Yesterday you captured a thought about [X]. And [open thread from last session] is still on the table."

**Input type:** Confirmation pills only:

```
✅ Sounds right    ✏️ Something's different
```

- If "Sounds right" → skip to Step 3.
- If "Something's different" → Sage asks "What's shifted?" with voice/text input. This is the optional depth expansion point.

**Artifact output:** → `DayShapeTimeline` (populated with known events) + `MorningSnapshotCard.open_threads`

**Key design point:** The user shouldn't have to TELL Sage what's on their plate. Sage should already know and present it. The user just confirms or corrects. This is the "executive assistant briefing" pattern.

#### Step 3: Intention Setting (~30-60 seconds)

**Sage says:** "Given all that — what's the one thing that would make today feel like a win?"

**Input type:** Voice or text. This is the ONE question that deserves freeform input. It's the soul of the morning ritual — the user articulating what matters today in their own words.

**Shortcut pill** for momentum days:

```
🎯 Same as yesterday    🎤 [voice button]    ⌨️ [text field]
```

"Same as yesterday" is crucial for momentum days. Most days aren't fresh starts — they're continuations. One tap, done.

**After response, Sage reflects back crisply:**

> "Got it. Today's intention: **[user's words, cleaned up].** Let me set up your day plan."

**Artifact output:** → `IntentionCard` — the headline of the entire Day Plan

#### Step 4: Quick Triage (~0-30 seconds, optional)

**Sage says:** "Anything else on your mind you want to capture before you get going?"

**Input type:** Voice/text OR skip pill:

```
💭 [voice/text to capture]    👋 I'm good, let's go
```

If user captures something, Sage tags it and offers one more round: "Anything else?"
If "I'm good" → straight to Step 5.

**Artifact output:** → `CapturesList` / open threads on the Day Plan

#### Step 5: Close & Launch (~10 seconds)

**Sage says:** "You're set. Day plan's ready — go make it happen."

**Display:** Auto-transition to the Day tab showing the freshly populated artifact. Or "View Day Plan" button that routes correctly.

No coaching. No "let me leave you with a thought." Clean exit. The user sees their day plan populated and feels the system did something concrete.

### Flow Timing Summary

```
Step 1: Energy     →  [pill tap]           →  15 sec
Step 2: Briefing   →  [confirm/correct]    →  30 sec
Step 3: Intention  →  [voice/text/reuse]   →  30-60 sec
Step 4: Capture    →  [optional dump]      →  0-30 sec
Step 5: Launch     →  [auto-transition]    →  10 sec
                                              ─────────
                              Fast path:      ~1:30
                              Normal path:    ~2:30
                              Deep path:      ~5:00
```

The fast path is four taps and one voice note. The deep path is when someone taps "Something's different" in Step 2, gives a longer freeform intention in Step 3, and dumps three thoughts in Step 4. Both paths produce the same artifact structure — the deep path fills it with richer data.

### Conversation Design Rules

**Rule 1: Every Sage message is ≤3 sentences.** The current morning session has Sage writing paragraphs. In this flow, Sage is crisp and efficient. Morning is where Sage delivers, not where Sage coaches.

**Rule 2: Pills for closed questions, voice/text for open ones.** Energy = closed (pills). Briefing confirmation = closed (pills). Intention = open (voice/text). Capture = open (voice/text). Never offer pills for open-ended self-authoring moments.

**Rule 3: Every step writes to the artifact.** No step exists purely for conversation warmth. If it doesn't produce Day Plan data, cut it.

**Rule 4: Depth is user-initiated, never Sage-initiated.** If user says "I'm stressed about the investor meeting," Sage responds: "Captured that — want to work through it later today?" It does NOT say "Tell me more about what's causing the stress." Morning mode is capture-forward, not coaching-forward.

**Rule 5: No reflective prompts in the morning flow.** "Something to sit with" belongs on the Day Plan artifact (discovered later), not inside a 2-minute launch sequence.

---

## 5. The Day Plan Artifact: Screen Spec

### What It Is

The Day Plan is a **living document** that serves as the single view of today. It grows throughout the day as sessions and captures write to it. It lives on the Day tab and represents the "day as atomic unit" concept.

The Day Plan is NOT a task manager. It's an AI-generated briefing + running capture log + bookended reflections. Think: an executive assistant's daily brief rendered as a persistent, scrollable document.

### Visual Design System

The finalized design uses a warm journal aesthetic. Reference the Magic Patterns code package for exact implementation, but here are the key design tokens:

**Colors (Tailwind extended):**
```
cream: '#FBF8F3'        — page background
cream-dark: '#F3EDE4'   — card backgrounds, subtle fills
warm-gray: '#2D2A26'    — primary text
warm-gray-light: '#A39E97' — secondary text, muted elements
amber: '#D4A853'        — primary accent (CTAs, active states, intention flourish)
sage: '#8B9E7E'         — ideas, "something to sit with" accent
terracotta: '#C17B5E'   — tensions accent
```

**Typography:**
- Body/display: Inter (weights 300-900)
- Serif accents: Lora (italic, for "Something to Sit With" and contemplative elements)
- Section headers: 10px uppercase, tracking 0.15em, warm-gray-light
- Intention text: ~27px, font-weight 900, letter-spacing -0.02em

**Texture:** Subtle paper-grain SVG noise overlay at 3% opacity across the full page. Creates warmth without being distracting. See `.paper-texture` class in the code package.

**Cards:** Rounded corners (2xl / 16px), cream-dark/60 backgrounds. Capture cards use colored left borders (3px) to indicate type. No harsh borders — separation comes from background contrast and spacing.

### Competitive Inspiration

- **Sunsama:** Ritual → artifact model. Morning conversation IS the ritual, producing a persistent plan.
- **Structured:** Visual timeline making time visible. ADHD users love seeing the shape of their day.
- **Obsidian Daily Notes:** Morning intentions → interstitial journal → evening reflections, all in one growing document.
- **Google CC Agent / ChatGPT Pulse:** AI-generated morning briefing that synthesizes calendar + context.

### Screen Structure: Two-Part Contract at the Top

The top of the Day Plan establishes a **contract between user and AI:**

1. **Intention Card** = what the USER declared matters today (their own words)
2. **Morning Snapshot** = what SAGE prepared for them (the AI's briefing)

Together, these form the "agreement" for the day. Everything below (timeline, captures, reflection) is execution against that contract.

### Section Layout (Mobile Scroll Order)

#### Section 1: Page Header

**Display:**
- "YOUR DAY" label, top-left, small muted text
- Date: "THURSDAY, FEBRUARY 19" — uppercase, tracking, warm-gray-light
- "Day Plan" as page title: 24px bold, warm-gray

**No progress ring.** An earlier design included a circular percentage indicator but there's no honest way to calculate "day completeness." Removed.

#### Section 2: The Headline — Intention Card (Hero Element)

**Data source:** Step 3 of morning flow

The most prominent, most emotionally resonant element on the screen. User's own words, reflected back as a personal declaration.

**Display (see `IntentionCard.tsx` in code package):**
- Card background: `cream-dark/60`, generous padding (py-10 px-6)
- **Streak badge** top-left: "Day 12 · Streak" in small amber pill with check icon. Subtle — should not compete with intention text for attention.
- **Intention text:** ~27px, font-weight 900, letter-spacing -0.02em, line-height 1.25. `warm-gray` color. This is the user's own words cleaned up by Sage, NOT a meditation mantra. Example: "Get the day plan working end-to-end so I can demo it Friday."
- **Amber flourish** below intention: a short horizontal line (max-w 80px, amber/50) + small amber dot. Decorative divider signaling completion.
- **"Day in motion" pill** below the flourish: small muted indicator showing the day is active and the plan is live.

**Empty state (pre-morning session):**
- Same card structure, but intention area shows: "Your intention will appear here after your morning session"
- "Open the Day" CTA button (amber, prominent)

**Key design principle:** The intention must feel like the user's own voice — specific, personal, actionable. Sage may clean up grammar but should never poeticize. "Ship the MVP" not "Move through the day with purposeful presence."

#### Section 3: The Briefing — Morning Snapshot Card (Hero Element)

**Data source:** Steps 1-2 of morning flow + Life Map priorities + previous sessions

This is Sage's gift to the user each morning — everything the AI prepared, bundled into one substantial card. It contains three subsections within a single card container, separated by subtle dividers.

**Card treatment:** Slightly warmer/more substantial than other cards. This is the AI's briefing — it should feel like Sage put thought into it. Use `cream-dark/70` or a subtle warm border to give it weight.

**Subsection A: Status Line**
```
☀️ Morning session complete · 8:15am
⚡ Focused · Slept well
```
- Session completion timestamp
- Energy indicator from Step 1 + optional context note
- Compact, one line each. Not a data field — a quick mood read.

**Subsection B: Priorities (Numbered + Checkboxes)**
```
PRIORITIES
☑️  1. Finish the day plan implementation    ← checked, struck through, muted
☐   2. Prep Friday demo walkthrough
☐   3. Review design feedback from Maya
```
- **Numbered list** (1, 2, 3) communicating rank — pulled from Life Map priorities + morning conversation
- **Checkboxes** on each item — tappable. Checked items show struck-through text in warm-gray-light. This is the ONLY place with checkboxes besides task captures.
- Maximum 3 priorities. This is not a todo list — it's "the things that matter today."
- Checkbox state persists to `day_plans.priorities` JSONB field (each priority object has a `completed` boolean).

**Subsection C: Open Threads (with Provenance)**
```
OPEN THREADS
• Feeling uncertain about the reorg              explore →
  From Tuesday's check-in · 3 days ago

• That idea from yesterday's walk                explore →
  From yesterday's reflection

• Reply to Mika about the timeline               explore →
  Unresolved · 5 days
```
- Each thread shows **provenance line** in muted text below: where it came from and how old it is. This makes threads feel like "Sage remembered this for you" not "here's another task."
- **"explore →"** link on the right (amber/sage colored) — tapping opens a focused Sage conversation about this thread with full history context.
- **"✓ Resolved"** affordance — secondary action to dismiss the thread. Implementation: swipe-to-reveal on mobile, or a subtle icon that appears on hover/long-press. When resolved, thread animates out and `open_threads` JSONB is updated.
- Threads are visually distinct from captures: no colored left border, use amber dot indicators (small, 1.5px circles) instead. They are Sage's items surfaced for the user, not user-created captures.

#### Section 4: The Day Shape — Timeline

**Data source:** Calendar API (when connected) + morning/evening session bookends

Vertical timeline with time labels on the left, event names on the right. Lightweight — gives shape to the day at a glance.

**Display (see `DayShapeTimeline.tsx` in code package):**

```
7:00   ● Morning ritual ✓               ← completed: amber filled dot, muted text
9:00   ● Deep work: Day plan build ✓    ← completed: amber filled dot, muted text
11:30  ● Design review with team [NOW]  ← current: bold text, amber NOW badge
14:00  ○ Lunch & walk                   ← upcoming: hollow dot, normal text
15:30  ○ Demo prep block
18:00  ○ Wind down
```

- Continuous vertical line connecting all events (amber gradient for completed portion, warm-gray-light for upcoming)
- Completed events: filled amber dot, subtle card background (cream-dark/80)
- Current event: **NOW badge** in amber/gold pill. Bold text. This is the standout feature — gives the timeline liveness. **Important: NOW badge must be amber, not red-orange.** Red signals urgency/error; amber signals "currently happening" which is informational.
- Upcoming events: hollow dot, lighter card background (cream-dark/40)
- Event cards: just event name + time. No detail subtitles. Keep it minimal.

**MVP (no calendar):** Show morning session ✓ → placeholder middle → evening bookend
**With calendar:** Populate from Google Calendar events

**Sample data should reflect target user:** Team standup, 1:1 meetings, deep work blocks — not "Morning Pages" or "Creative Block" which read as a writer's day.

#### Section 5: Captured Thoughts (Accumulates Through Day)

**Data source:** Quick capture submissions + morning Step 4 brain dump

This section starts empty in the morning and grows throughout the day. Three key innovations vs. v1: capture entry point, type grouping, and type-specific affordances.

**5A: Capture Entry Point (Top of Section)**

```
CAPTURED THOUGHTS
┌─────────────────────────────────────┐
│ ✨ Capture a thought...             │
└─────────────────────────────────────┘
```

- Inline text input with muted placeholder. Warm cream background.
- Tapping expands into a text/voice input field.
- On submit: toast confirmation ("✓ Captured"), save to `captures` table, card appears below immediately.
- This is critical — previous version had NO way to add captures from the Day Plan screen.

**5B: Grouped by Type**

Captures are grouped by classification type, NOT displayed in flat chronological order. Each group has a subtle header:

```
TASKS · 2
[task cards]

THOUGHTS & IDEAS · 3
[thought/idea cards]

TENSIONS · 1
[tension cards]
```

Group headers: same 10px uppercase tracking style as other section labels, warm-gray-light.

**5C: Type-Specific Card Treatments**

All capture cards share: colored left border (3px), type label above content as small colored tag, content text, timestamp. But affordances differ by type.

**Task Cards** — the only capture type with a "done" state:
```
┌─ warm-gray left border ─────────────────────┐
│ TASK (small warm-gray tag)                   │
│ ☐ Send the updated deck to Sarah by Thursday │
│ 2:15 PM                                     │
└──────────────────────────────────────────────┘
```
- Checkbox on the left of the task text. Tappable.
- When checked: text strikes through, entire card mutes (lighter text, reduced opacity). Card remains visible — the day plan is a record of the full day including what was accomplished.
- Show at least one completed task in sample data to demonstrate the lifecycle.
- Update `captures` table: add `completed` boolean field for task captures.

**Thought & Idea Cards** — reflective, explore-forward:
```
┌─ amber left border (thoughts) ──────────────┐
│ THOUGHT (small amber tag)                    │
│ What if the proposal framed it as an         │
│ experiment rather than a commitment?         │
│ 9:42 AM                  Explore with Sage → │
└──────────────────────────────────────────────┘

┌─ sage left border (ideas) ──────────────────┐
│ IDEA (small sage tag)                        │
│ The onboarding could feel more like an       │
│ invitation than a form                       │
│ 10:15 AM                 Explore with Sage → │
└──────────────────────────────────────────────┘
```
- "Explore with Sage →" as primary action (right-aligned, amber/sage colored link)
- No checkbox. No done state. These are reflective items.
- Tapping "Explore" opens a focused Sage conversation seeded with the capture content.

**Tension Cards** — deserve space, not analysis:
```
┌─ terracotta left border ────────────────────┐
│ TENSION (small terracotta tag)               │
│ I keep avoiding the conversation with Jordan │
│ about timelines                              │
│ 11:03 AM                   Sit with this →   │
└──────────────────────────────────────────────┘
```
- **"Sit with this →"** as primary action — NOT "Explore with Sage." Tensions represent active internal conflicts. The appropriate response is space, not immediate analysis.
- Tapping "Sit with this" could: add the tension to the "Something to Sit With" section, or open a gentler conversational mode where Sage holds space rather than probing.
- Slightly more padding than other cards — tensions deserve breathing room.

**Color mapping for left borders:**
| Type | Left Border Color | Tag Color |
|------|------------------|-----------|
| Task | warm-gray-light | warm-gray-light |
| Thought | amber | amber |
| Idea | sage | sage |
| Tension | terracotta | terracotta |

**Empty state:** "Thoughts you capture during the day will appear here. Use the field above or the ✨ button on the Home screen to drop a thought anytime."

#### Section 6: Something to Sit With

**NOT part of the morning flow.** This appears on the Day Plan after the flow completes — a quiet element the user discovers on their own when they check their day plan later.

**Display (see `SitWithPrompt.tsx` in code package):**
- Sage-green (sage/40) left accent line, 3px wide
- Section header: "SOMETHING TO SIT WITH" — same 10px uppercase style
- Prompt text in **Lora serif, italic**, ~18px, warm-gray/75. This is the one place serif type appears — it signals "this is different, slow down."
- Example: *"What would it look like to trust the pace you're already moving at?"*
- Optionally interactive: tap to jot a quick thought → becomes a capture in Section 5
- Muted, contemplative styling. A moment of pause between the action-oriented sections above and the evening close below.

#### Section 7: Evening Reflection (Appears After "Close the Day")

**Data source:** "Close the Day" session output

After the evening session, this section appends to the bottom of the Day Plan. Now the artifact is complete: intention → snapshot → timeline → captures → sit with → evening reflection.

**Display (see `EveningReflection.tsx` in code package):**
- **Dark card:** warm-gray background with cream text. Beautiful contrast that signals "different mode" — this is the day winding down.
- Moon icon (🌙) centered at top
- "EVENING REFLECTION" header
- **"Available after 6pm"** — time-gate text shown before 6pm. The evening reflection shouldn't sit there all day tempting users to skip ahead. Before 6pm, the button is muted/disabled. After 6pm, it becomes active.
- Body text: "When you're ready, take a few minutes to look back on the day. No judgment — just noticing."
- "Begin Reflection" button: amber text, amber/40 border, rounded-full. Opens the evening close conversation.

**Post-completion display:**
- Evening mood/energy (similar to morning snapshot)
- Key reflections from the close-of-day conversation
- "What went well" / "What to carry forward"
- Sage's end-of-day synthesis (1-2 sentences connecting morning intention to what actually happened)

**The complete Day Plan is a full day in one scrollable view.** This becomes a rich record that History can reference and that future morning sessions can pull from.

**Bottom padding:** Ensure generous spacing (pb-28 or more) between Evening Reflection and the bottom nav to prevent the card from feeling cramped against the tab bar.

---

## 6. Home Screen Changes

### Design Principle

If the Day Plan is the living document, the Home Screen becomes a **dashboard pointing to it** — not the document itself.

### Layout (Post-Morning Session)

```
┌──────────────────────────────────┐
│  Good morning, Tom               │
│  Thursday, February 20           │
│                                  │
│  ┌────────────────────────────┐  │
│  │ 🎯 Today's Intention       │  │
│  │ Build the day plan          │  │
│  │ structure that makes the    │  │
│  │ command center obvious      │  │
│  │              View Day Plan →│  │
│  └────────────────────────────┘  │
│                                  │
│  ☀️ Morning ✓   💭 2 captures    │
│                                  │
│  ┌──────┐  ┌──────┐  ┌──────┐  │
│  │      │  │ 💭   │  │ 🌙   │  │
│  │ Done │  │Captur│  │Close │  │
│  │      │  │  e   │  │ Day  │  │
│  └──────┘  └──────┘  └──────┘  │
│                                  │
│         [ Breathing Orb ]        │
│         Talk to Sage             │
│                                  │
└──────────────────────────────────┘
```

### Key State Transitions

**Pre-morning session:**
- Greeting + Date
- "Start your day" CTA → launches Open the Day session
- Breathing orb prominent
- No intention shown

**Post-morning session:**
- Greeting + Date
- Today's Intention card (pulled from Day Plan) with "View Day Plan →" link
- Status bar: "☀️ Morning ✓ · 💭 3 captures"
- Action buttons: Open Day (muted/done) / Capture / Close Day
- Breathing orb

**After evening close:**
- "Day complete" state
- Summary card linking to finished Day Plan
- "See you tomorrow" from Sage

### Critical Behavior

**"View Day Plan" must route to the Day tab showing the real artifact.** This is the P0 fix. Never route to Life Map. Never route to nothing.

---

## 7. Quick Capture Redesign

### Current State (Broken)

Captures save to Supabase Storage as markdown files → background classification → briefly appear as "Today's Breadcrumbs" (midday/evening only, max 5) → feed into Close the Day prompt → disappear forever. No history, no browsing, no editing, no feedback on submit.

### New Behavior

**On capture submit:**
1. Toast/confirmation appears immediately: "✓ Captured" (auto-dismisses after 2 seconds)
2. Capture is saved to database (not just file storage — needs to be queryable)
3. Capture appears immediately in the Day Plan's "Captured Thoughts" section (Section 4)
4. Background classification still runs (thought/task/idea/tension + auto-tags)
5. Once classified, the tag chip updates on the capture card

**Captures are first-class objects, not disposable inputs.** They persist on the Day Plan, are visible in History, and Sage references them in evening and future sessions.

### Capture Entry Points

1. **Home screen "Capture" button** — opens a text/voice input overlay
2. **Day Plan "+" button** — adds directly to the Captured Thoughts section
3. **During any conversation** — Sage can tag items as "captured" and they appear on the Day Plan
4. **"Explore with Sage" on a capture** — tapping a capture opens a focused conversation about it

---

## 8. Bug Fixes

### P0 — Demo Killers

| Bug | Description | Location |
|-----|-------------|----------|
| Day Plan routing | "View Day Plan" button routes to Life Map instead of Day Plan | Home screen CTA |
| Capture feedback | No visual confirmation after submitting a quick capture | Capture input component |

### P1 — Significant UX Issues

| Bug | Description | Location |
|-----|-------------|----------|
| Voice timer speed | Timer counts up faster than real time during recording | Voice recording component |
| Voice premature stop | Transcription terminates before user presses stop (happened 2x) | Voice recording component |
| Text input clipping | Text input field doesn't scale. No scrolling. Content clipped after 1 line | Chat input component |

### P2 — Polish

| Bug | Description | Location |
|-----|-------------|----------|
| Static session timer | Header shows "~3 min" throughout entire session, even at 20 min | Session header |
| Quick reply overuse | Pills appear on every Sage response, even open-ended questions | Conversation renderer |

---

## 9. System Prompt Changes

### Morning Session Prompt (Complete Rewrite)

The current morning system prompt allows Sage to ask open-ended coaching questions and follow threads deeply. This must be replaced with a constrained 5-step flow.

**Key prompt directives for morning mode:**

```
MORNING SESSION RULES:
- You are running a structured 5-step morning briefing, NOT an open conversation.
- Every message you send must be ≤3 sentences.
- You NEVER ask follow-up questions that deepen a topic. Morning mode is capture-forward.
- If the user raises something complex, acknowledge it, capture it as an open thread, and move to the next step.
- You do NOT offer coaching, reframing, or analysis in morning mode. Save that for check-ins.
- Your job is to: collect energy level, present what you know, extract an intention, capture loose thoughts, and launch the user into their day.

STEP SEQUENCE:
1. ENERGY CHECK: Greet user by name. Ask how they're feeling. Expect a quick-reply pill response.
2. BRIEFING: Present what you know about their day (calendar, Life Map priorities, yesterday's threads, recent captures). Ask for confirmation only.
3. INTENTION: Ask "What's the one thing that would make today feel like a win?" Accept freeform voice/text. Reflect it back crisply.
4. TRIAGE: Ask if anything else is on their mind to capture. Accept 0-3 items. Tag each.
5. CLOSE: Confirm the day plan is set. End the session.

NEVER deviate from this sequence. NEVER add steps. NEVER probe deeper on any topic raised.
```

### Quick Reply Behavior Rule

Add to the general conversation system prompt:

```
QUICK REPLY RULES:
- Only offer quick-reply pills when the user has a BOUNDED choice to make.
- Good pill contexts: energy/mood selection, "explore domain X or Y?", "continue or wrap up?", "sounds right / something's different"
- NEVER offer pills after open-ended questions (what, how, why, tell me about).
- NEVER offer pills that pre-digest the user's thoughts (e.g., suggesting what they might be thinking about).
- When in doubt, don't show pills. Let the user speak.
```

---

## 10. Data Model Changes

### New: `day_plans` Table

```sql
CREATE TABLE day_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  date DATE NOT NULL,
  intention TEXT,                              -- from Step 3
  energy_level TEXT,                           -- from Step 1 (fired_up, focused, neutral, low, stressed)
  morning_session_id UUID,                     -- reference to the conversation session
  morning_completed_at TIMESTAMPTZ,
  evening_session_id UUID,                     -- reference to evening session
  evening_completed_at TIMESTAMPTZ,
  evening_reflection JSONB,                    -- structured evening output
  open_threads JSONB DEFAULT '[]',             -- array of {text, source, status}
  priorities JSONB DEFAULT '[]',               -- top 1-3 from Life Map / conversation
  briefing_data JSONB,                         -- what Sage presented in Step 2
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);
```

### Modified: `captures` → Promote to Real Table

Currently captures are markdown files in Supabase Storage. They need to become queryable database rows.

```sql
CREATE TABLE captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  day_plan_id UUID REFERENCES day_plans(id),   -- links to the day
  content TEXT NOT NULL,
  classification TEXT,                          -- thought | task | idea | tension
  auto_tags TEXT[] DEFAULT '{}',
  source TEXT DEFAULT 'manual',                 -- manual | morning_session | conversation
  explored BOOLEAN DEFAULT false,               -- user tapped "Explore with Sage"
  completed BOOLEAN DEFAULT false,              -- only used for task captures (checkbox state)
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Updated: `day_plans.priorities` JSONB Structure

The priorities field stores an array of priority objects with completion state for the checkbox interaction:

```json
[
  { "rank": 1, "text": "Finish the day plan implementation", "completed": true },
  { "rank": 2, "text": "Prep Friday demo walkthrough", "completed": false },
  { "rank": 3, "text": "Review design feedback from Maya", "completed": false }
]
```

### Updated: `day_plans.open_threads` JSONB Structure

Open threads now include provenance data for display:

```json
[
  {
    "text": "Feeling uncertain about the reorg",
    "source_session_type": "weekly_checkin",
    "source_date": "2026-02-17",
    "provenance_label": "From Tuesday's check-in · 3 days ago",
    "status": "open",
    "resolved_at": null
  }
]
```

### Migration Path

Existing markdown captures in Supabase Storage should be migrated to the new table. Write a one-time migration script that reads frontmatter from each `.md` file and inserts into the `captures` table.

---

## 11. Component Inventory

### Design Reference Components (from Magic Patterns code package)

The code package includes these reference implementations. Use them as visual/structural guides, but adapt to the existing MeOS codebase architecture:

| Package Component | Purpose | Notes |
|-------------------|---------|-------|
| `IntentionCard.tsx` | Hero intention with streak badge, large type, amber flourish | Update sample text to real user words |
| `MorningSnapshot.tsx` | Energy chips + open threads | Needs rework — see updated spec for numbered priorities + checkboxes + provenance |
| `DayShapeTimeline.tsx` | Vertical timeline with nodes | Update NOW badge color to amber, simplify event cards |
| `CapturedThoughts.tsx` | Capture cards with type indicators | Needs rework — add type grouping, type-specific affordances |
| `SitWithPrompt.tsx` | Serif italic reflection prompt | Good as-is, minor polish |
| `EveningReflection.tsx` | Dark card evening close | Add "Available after 6pm" time gate |
| `BottomNav.tsx` | Four-tab navigation | Update labels to Home / Day / Life Map / History |
| `AnimatedSection.tsx` | Framer Motion scroll reveal wrapper | Optional — nice for polish but not P0 |

### New Components to Build

| Component | Purpose | Data Source | Priority |
|-----------|---------|-------------|----------|
| `DayPlanView` | Container for the Day tab, renders all sections in scroll order | `day_plans` table | P0 |
| `IntentionCard` | Hero element: large bold intention text, streak badge, amber flourish, "Day in motion" pill | `day_plans.intention` | P0 |
| `MorningSnapshotCard` | Bundled briefing card: energy status line + numbered priorities with checkboxes + open threads with provenance and explore/resolve affordances | `day_plans.energy_level`, `.priorities`, `.open_threads` | P0 |
| `PriorityItem` | Single priority row: rank number + checkbox + text. Checked → struck-through + muted. | `day_plans.priorities[n]` | P0 |
| `OpenThreadItem` | Single thread row: text + provenance line + "explore →" link + "✓ resolved" affordance | `day_plans.open_threads[n]` | P0 |
| `CaptureInput` | Inline "Capture a thought..." field at top of captures section. Expands on tap, submits to `captures` table | Component state → `captures` table | P0 |
| `CapturesList` | Groups captures by type with section headers ("Tasks · 2", "Thoughts & Ideas · 3", "Tensions · 1") | `captures` table, grouped by `classification` | P0 |
| `TaskCaptureCard` | Task capture: colored left border + TASK tag + checkbox + content + timestamp. Checked → struck-through | `captures` row where classification='task' | P0 |
| `ThoughtCaptureCard` | Thought/idea capture: colored left border + type tag + content + timestamp + "Explore with Sage →" | `captures` row where classification='thought' or 'idea' | P0 |
| `TensionCaptureCard` | Tension capture: terracotta left border + TENSION tag + content + timestamp + "Sit with this →" | `captures` row where classification='tension' | P1 |
| `DayShapeTimeline` | Vertical timeline: time labels, event names, completion dots, NOW badge (amber), connecting line | Calendar API + `day_plans` | P2 |
| `ReflectionPrompt` | "Something to sit with" — Lora serif italic, sage-green accent line, optional tap-to-capture | Sage-generated from Life Map | P2 |
| `EveningReflectionCard` | Dark warm-gray card, "Available after 6pm" time gate, "Begin Reflection" button | `day_plans.evening_reflection` | P2 |
| `EnergyPills` | Quick-reply pill selector for Step 1 energy check (5 options) | Component-level state → `day_plans.energy_level` | P0 |
| `ConfirmationPills` | "Sounds right" / "Something's different" for Step 2 | Component-level state | P1 |

### Modified Components

| Component | Change | Priority |
|-----------|--------|----------|
| Bottom nav | Rename "Chat" → "Day", route to `DayPlanView`. Labels: Home / Day / Life Map / History. Day tab uses SunIcon, highlighted in amber when active. | P0 |
| Home screen | Add intention card (post-session), update CTAs, add capture count status bar ("☀️ Morning ✓ · 💭 3 captures") | P0 |
| "View Day Plan" button | Route to Day tab, not Life Map. This is the P0 broken promise fix. | P0 |
| Capture input (Home) | Add toast confirmation ("✓ Captured") on submit, write to `captures` table, update Day Plan in real time | P0 |
| Morning session prompt | Replace with structured 5-step flow (see Section 9) | P0 |
| Quick reply renderer | Only show pills when explicitly flagged by conversation step type | P1 |
| Voice recording | Fix timer speed, fix premature termination | P1 |
| Text input | Auto-expanding textarea with max-height | P2 |

---

## 12. Priority Tiers

### P0 — Must Ship for Friday Demos

These fix the broken promise loop and create the core demo story: "I talked to Sage this morning. Here's the intention it captured, the priorities it surfaced, the threads it's holding for me. And as thoughts come up during the day, they land here — sorted by type, each with the right next action."

1. **Create `day_plans` and `captures` tables** in Supabase (including `completed` fields and JSONB structures for priorities/threads)
2. **Morning session writes to `day_plans`** — intention, energy level, priorities, open threads all persist at session close
3. **Build `DayPlanView` container** — scrollable page rendering all sections in order
4. **Build `IntentionCard`** — hero element with large bold text, streak badge, amber flourish, "Day in motion" pill. Reference `IntentionCard.tsx` from code package but use real user words as sample data.
5. **Build `MorningSnapshotCard`** — bundled card with energy status line, numbered priorities with checkboxes (checked → struck-through), and open threads with provenance lines and "explore →" / "✓ resolved" affordances
6. **Build `CaptureInput` + `CapturesList`** — inline "Capture a thought..." field + type-grouped display (Tasks with checkboxes, Thoughts/Ideas with "Explore with Sage →", Tensions with "Sit with this →")
7. **Replace Chat tab with Day tab** in bottom nav. Labels: Home | Day | Life Map | History
8. **Fix "View Day Plan" routing** on Home screen — must go to Day tab, never Life Map
9. **Capture submit → toast + database + appear on Day Plan immediately** — closes the black hole
10. **Rewrite morning system prompt** for structured 5-step flow (see Section 9)

### P1 — Should Ship This Week

These make the experience polished and reliable.

11. `TensionCaptureCard` with "Sit with this →" affordance (distinct from explore)
12. Step 2 briefing: Sage reads from Life Map + yesterday's data and presents it
13. Voice recording bug fixes (timer speed, premature termination)
14. Quick reply contextual logic (only show pills where appropriate)
15. Home screen state transitions (pre/post morning session, with capture count status bar)
16. `ConfirmationPills` for Step 2 ("Sounds right" / "Something's different")

### P2 — Week 2

These add depth and polish but aren't needed for initial demos.

17. `DayShapeTimeline` — vertical timeline with NOW badge (amber), simplified events. Reference `DayShapeTimeline.tsx` from code package.
18. `ReflectionPrompt` — "Something to sit with" on Day Plan. Lora serif italic, sage-green accent. Reference `SitWithPrompt.tsx`.
19. `EveningReflectionCard` — dark card with "Available after 6pm" time gate and "Begin Reflection" button. Reference `EveningReflection.tsx`.
20. Google Calendar OAuth integration for timeline population
21. Text input auto-expanding fix
22. Capture migration from markdown files to new `captures` table
23. "Explore with Sage" on individual captures (opens focused conversation with capture context)
24. Session timer showing actual elapsed time
25. Paper texture background layer (SVG noise overlay — see `.paper-texture` in code package CSS)
26. Framer Motion scroll reveal animations (see `AnimatedSection.tsx` — nice polish, not essential)

---

## Appendix A: Competitive Research Summary

| Product | Key Pattern to Adopt | Key Pattern to Avoid |
|---------|---------------------|---------------------|
| **Sunsama** | Ritual → artifact model. Planning ritual produces persistent plan. | Desktop-first, heavy integrations. Too much manual task management. |
| **Structured** | Visual timeline making time visible. ADHD users love seeing day shape. | Full minute-by-minute scheduling is too heavy for MeOS. |
| **Tiimo** | Brain dump → structured plan via AI. ADHD-optimized. | Over-gamification. |
| **Obsidian Daily Notes** | Morning intentions → interstitial journal → evening reflections in one document. Day as growing document. | Requires manual maintenance. No AI. |
| **Google CC Agent** | AI synthesizes calendar + email + context into morning briefing. Two-way interaction. | Email-based delivery (not in-app). |
| **ChatGPT Pulse** | Morning briefing cards, proactive notifications. | No persistent artifact. Notification-based, not document-based. |
| **Headspace** | "One thing to do right now" — clarity of single focus. Gentle streak display. | Over-simplification for power users. |
| **Daylio** | 5-second check-in. Minimum viable daily touch. | No depth. No AI synthesis. |

## Appendix B: Design Reference — What vs. How

For the implementer: this spec tells you WHAT to build, not HOW to build it in your specific codebase. When you encounter questions like "where exactly in the Next.js routing does the Day tab live?" or "how does the morning session prompt get injected?" — use your knowledge of the existing codebase architecture.

The key constraint is: **the morning conversation must produce a database record (`day_plans` row) that the Day Plan view reads from.** How that data flows between the conversation engine and the database is an implementation detail. But the data must flow — that's the non-negotiable.

---

*End of spec. Last updated: February 20, 2026 (v2.0).*

---

## Appendix C: Magic Patterns Code Package Reference

A finalized visual prototype code package is provided alongside this spec. It contains React/TypeScript components, Tailwind configuration, and CSS that represent the target visual design.

### How to Use the Code Package

**Use as visual reference, not as production code.** The package was generated by Magic Patterns as a design prototype. It uses Framer Motion, Lucide icons, and a custom Tailwind config. Adapt the visual patterns to the existing MeOS Next.js + Supabase codebase rather than importing components directly.

### Key Files

| File | What to Reference |
|------|-------------------|
| `tailwind.config.js` | Color palette (cream, cream-dark, warm-gray, warm-gray-light, amber, sage, terracotta), font families (Inter, Lora) |
| `src/index.css` | Paper texture SVG overlay (`.paper-texture`), torn-edge clip-path (`.torn-edge`), timeline line gradient (`.timeline-line`), CSS variables |
| `src/components/IntentionCard.tsx` | Typography scale, streak badge, amber flourish treatment |
| `src/components/MorningSnapshot.tsx` | Energy chip, open thread bullet styling. **Note: needs rework** — current version uses chips instead of numbered priorities with checkboxes, and threads lack provenance lines. Use as starting point only. |
| `src/components/DayShapeTimeline.tsx` | Vertical timeline node/line pattern, event card treatment, completion states |
| `src/components/CapturedThoughts.tsx` | Card structure, left border color coding, type labels. **Note: needs rework** — current version doesn't group by type or differentiate affordances. |
| `src/components/SitWithPrompt.tsx` | Sage-green accent line, Lora serif italic styling |
| `src/components/EveningReflection.tsx` | Dark card treatment (warm-gray bg, cream text), button styling |
| `src/components/BottomNav.tsx` | Nav structure and styling. **Note: update labels** to Home / Day / Life Map / History. |
| `src/pages/DayPlanScreen.tsx` | Overall page layout, section spacing, scroll order |

### Design Tokens Summary

```
// Colors
cream: '#FBF8F3'         // page background
cream-dark: '#F3EDE4'    // card fills
warm-gray: '#2D2A26'     // primary text
warm-gray-light: '#A39E97' // secondary text
amber: '#D4A853'         // primary accent, CTAs, intention, NOW badge
sage: '#8B9E7E'          // ideas, "sit with" accent
terracotta: '#C17B5E'    // tensions accent

// Typography
font-body: 'Inter', sans-serif     // all UI text
font-serif: 'Lora', Georgia, serif // "Something to sit with" only
intention-size: 27px, weight 900, tracking -0.02em
section-header: 10px uppercase, tracking 0.15em, warm-gray-light

// Spacing
card-radius: 16px (rounded-2xl)
card-padding: px-6 py-8 (standard), py-10 px-6 (intention card)
section-gap: mt-10 between sections
page-bottom: pb-28 (clear of bottom nav)

// Capture card left borders
task: warm-gray-light, 3px
thought: amber, 3px
idea: sage, 3px
tension: terracotta, 3px
```