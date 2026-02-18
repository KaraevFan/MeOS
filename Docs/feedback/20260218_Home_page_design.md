# MeOS Home Screen — Implementation Spec

> Handoff document for Claude Code. Pair with Magic Patterns design files for visual reference.

---

Design files for reference /Users/tomoyukikano/Desktop/Projects/Kairn/inspiration/20260218_Homescreen_design

## Overview

The home screen is a **time-aware, contextual card stack** that adapts based on time of day. It acts as a concierge — surfacing the right action at the right moment — not a static dashboard.

Three time states: **Morning** (before ~11am), **Mid-Day** (~11am–6pm), **Evening** (after ~6pm). Same layout skeleton, different card content and priority ordering.

The system is **opinionated about defaults but permissive about access.** Time of day determines what's highlighted, but nothing is ever gated.

---

## Layout Structure (top to bottom)

```
┌─────────────────────────────┐
│  Status Bar                 │
│                             │
│  Greeting + Date            │
│  Session Chips              │
│                             │
│  ┌───────────────────────┐  │
│  │  Hero Card (Tier 1)   │  │
│  └───────────────────────┘  │
│                             │
│  [ Capture Bar (inline) ]   │  ← morning/evening only
│                             │
│  ┌───────────────────────┐  │
│  │  Content Card (Tier 2)│  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │  Content Card (Tier 2)│  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │  Ambient Card (Tier 3)│  │  ← optional, below fold is fine
│  └───────────────────────┘  │
│                             │
│  (safe zone ~80px)          │  ← content must clear the orb
├─────────────────────────────┤
│  [Home] [Chat] [🎙] [Map] [History] │
└─────────────────────────────┘
```

**Target device:** iPhone 15 Pro (393 × 852 viewport)

**Bottom safe zone:** The last card needs ~80px bottom padding so content doesn't get clipped by the tab bar orb. This is a known issue in the mockups — fix in implementation.

---

## Component: Greeting + Date

- **Text:** "Good morning/afternoon/evening, Tom"
- **Subtext:** Day of week + date (e.g., "Tuesday, February 17")
- Time-of-day greeting switches at the same thresholds as the card stack (~11am, ~6pm)
- Font: Large heading weight, warm dark gray

---

## Component: Session Chips

A horizontal row of three pill-shaped buttons directly below the date line.

```
[ ☀️ Open Day ]  [ 🎙 Capture ]  [ 🌅 Close Day ]
```

**Behavior:**
- The chip matching the current time state is **active** (filled amber background, white text)
- Inactive chips are **muted** (outline or light gray fill, warm gray text)
- Tapping any chip opens that session directly — regardless of time of day
- Icons: sun for Open Day, mic for Capture, sunset/moon for Close Day

**Sizing:** ~32–36px tall, horizontal padding, centered row. Feels like iOS filter pills, not a toolbar.

**Spacing:** ~8px below date, ~12px above hero card.

**Data dependency:** None. These are static navigation elements. Active state is determined purely by client-side time.

---

## Component: Hero Card (Tier 1)

The primary CTA card. One per screen state. Warm cream/light-amber tinted background. Largest card with most breathing room. No left-border accent.

### Hero Card Content by State

**Morning — "Open Your Day"**
- Icon: ☀️ sun
- Title: "Open Your Day"
- Contextual line (1–2 sentences, Sage's voice — see data logic below)
- CTA button: "Begin morning session" (amber/gold, white text, full-width)

**Mid-Day — "Quick Capture"**
- Icon: 🎙 mic
- Title: "Quick Capture"
- Line: "Got a thought worth holding onto? Drop it here — it'll be waiting tonight."
- CTA button: "Capture a thought"

**Evening — "Close Your Day"**
- Icon: 🌅 sunset
- Title: "Close Your Day"
- Contextual line (1–2 sentences, Sage's voice — see data logic below)
- CTA button: "Close your day"

### Contextual Line Logic

The hero card's contextual line is what makes MeOS feel personal. It references the user's actual data. Generate with a lightweight LLM call or template logic, with fallbacks.

**Morning contextual line — priority cascade:**
1. If yesterday's intention exists AND yesterday's evening journal exists: Reference both. *"Yesterday you set out to ship the prototype. Your reflection flagged some blockers worth revisiting."*
2. If yesterday's intention exists (no journal): Reference intention. *"Yesterday you set out to ship the prototype. Let's see what today holds."*
3. If calendar has events today: Reference calendar. *"You've got a clear morning before your 1:1 at 2pm. Good day to protect a maker block."*
4. Fallback: *"A fresh start. What matters most to you today?"*

**Evening contextual line — priority cascade:**
1. If quick captures exist today: Reference count. *"You dropped 3 thoughts today. Let's make sense of them before you rest."*
2. If morning intention exists (no captures): Reference intention. *"This morning you set out to focus on the MVP build. How did it land?"*
3. Fallback: *"Take a moment to notice what today held. Even two minutes counts."*

**Mid-day:** Static copy, no contextual logic needed.

---

## Component: Capture Bar (Inline)

A slim, tappable strip for quick text capture. Appears on morning and evening states only (mid-day doesn't need it — capture is the hero).

- Height: 44–48px (minimum tap target)
- Background: Slightly warmer than page background, or transparent with subtle border
- Content: Text cursor icon (not mic — the orb owns voice) + "Drop a thought" in muted warm gray
- Tap action: Opens quick capture flow (text input, with option to switch to voice)
- No left-border accent, no shadow. Visually lighter than Tier 2 cards.

**Position:** Directly below the hero card, above the first Tier 2 content card.

---

## Component: Content Cards (Tier 2)

Standard information/interaction cards. White/cream background, subtle shadow or border. Left-border accent (3–4px, rounded) colored by card type.

### Card Types

**Calendar Card**
- Left border: amber/warm gold
- Icon: 📅 calendar
- Content: Compact one-liner. "3 meetings today · First at 10am · Afternoon clear"
- Data: Google Calendar read (P0 integration)
- Tap action: Expand to show event list, or link to calendar

**Yesterday's Intention Card**
- Left border: blue-gray
- Header: "YESTERDAY'S INTENTION" + date (e.g., "Feb 16")
- Content: Yesterday's intention in italics
- Actions: Two buttons — "Completed" / "Carry forward"
- Data: Read from `day-plans/` directory (yesterday's day plan frontmatter)
- Conditional: Only appears if yesterday's day plan exists

**Yesterday's Synthesis Card (Morning only)**
- Left border: sage green
- Header: "FROM LAST NIGHT"
- Content: 1–2 line summary from last night's journal synthesis
- Optional: Checklist of action items surfaced from the reflection (tappable checkboxes)
- Data: Read from `journals/` directory (last evening journal frontmatter or computed synthesis)
- Conditional: Only appears if user completed "Close the Day" yesterday. No empty state — card simply absent.

**Check-In Card (Mid-Day only)**
- Left border: amber
- Header: "CHECK-IN" with amber dot indicator
- Content: References morning intention. "You set an intention to focus on the MVP build. Still on track?"
- Actions: Three buttons — "Yes" (filled) / "Not yet" (outline) / "Snooze" (text only)
- Data: Read from today's day plan
- Conditional: Only appears if user completed "Open the Day" today

**Next Event Card (Mid-Day only)**
- Left border: amber
- Icon: Time badge (e.g., "PM 1:30" in a small circle)
- Content: Event name + "Starts in X min" (amber text for urgency)
- Chevron: Right arrow suggesting tappable
- Data: Google Calendar — next upcoming event
- Conditional: Only appears if there's an event in the next ~2 hours

**Breadcrumbs Card (Evening only)**
- Left border: sage green
- Header: "TODAY'S BREADCRUMBS"
- Content: List of today's quick captures, displayed as blockquote-style items with inner left-border treatment
- Data: Read from `captures/` directory, filtered to today
- Conditional: Only appears if captures exist today

**Captures Today Card (Mid-Day only)**
- Left border: sage green
- Header: "CAPTURES TODAY"
- Content: Compact list of today's captures with amber dot bullets
- Data: Same as breadcrumbs — `captures/` directory, today's date
- Conditional: Only appears if captures exist

**Morning Intention Recall Card (Evening only)**
- Left border: blue-gray
- Icon: ☀️ small sun
- Header: "MORNING INTENTION"
- Content: "You set out to: *[intention in italics]*"
- Data: Read from today's day plan
- Conditional: Only appears if user completed "Open the Day" today

---

## Component: Ambient Card (Tier 3)

Optional reflective content. Below the fold is fine. No left-border accent.

**"Something to Sit With"**
- Header: "SOMETHING TO SIT WITH" in muted uppercase
- Content: A reflective question in italic. E.g., "What feels most true about where you are right now?" or "What surprised you about today?"
- No actions, no data dependency
- Source: Rotating pool of reflective prompts (can be static for MVP, LLM-generated later)
- Appears on morning and evening states only

---

## Component: Tab Bar with Voice Orb

Five-item tab bar with the voice orb as a raised center element.

```
[Home]  [Chat]  [ 🎙 Orb ]  [Life Map]  [History]
```

- Orb size: 48–56px diameter, protruding ~20px above tab bar edge
- Orb color: Amber/gold gradient with subtle idle pulse animation
- Orb has NO text label (other tabs do)
- Other tab icons: ~24px, warm gray when inactive, amber when active

**Orb tap behavior (contextual):**
- Morning → Opens "Open the Day" voice session
- Mid-Day → Opens Quick Capture in voice mode
- Evening → Opens "Close the Day" voice session
- Default/fallback → Opens general chat with Sage

**Tab bar background:** Curves gently around the orb or the orb sits naturally on top. Should feel native, not hacked.

---

## Card Stack by State

### Morning (before ~11am)

| Order | Component | Tier | Border | Conditional? |
|-------|-----------|------|--------|-------------|
| 1 | Greeting + Date | — | — | No |
| 2 | Session Chips (Open Day active) | — | — | No |
| 3 | Hero: "Open Your Day" | T1 | none | No |
| 4 | Capture Bar | inline | none | No |
| 5 | Yesterday's Synthesis | T2 | sage green | Yes — needs last night's journal |
| 6 | Calendar | T2 | amber | Yes — needs calendar integration |
| 7 | Yesterday's Intention | T2 | blue-gray | Yes — needs yesterday's day plan |
| 8 | "Something to Sit With" | T3 | none | No |

### Mid-Day (~11am – 6pm)

| Order | Component | Tier | Border | Conditional? |
|-------|-----------|------|--------|-------------|
| 1 | Greeting + Date | — | — | No |
| 2 | Session Chips (Capture active) | — | — | No |
| 3 | Hero: "Quick Capture" | T1 | none | No |
| 4 | Check-In | T2 | amber | Yes — needs today's day plan |
| 5 | Next Event | T2 | amber | Yes — needs calendar, event within ~2hrs |
| 6 | Captures Today | T2 | sage green | Yes — needs captures from today |

### Evening (after ~6pm)

| Order | Component | Tier | Border | Conditional? |
|-------|-----------|------|--------|-------------|
| 1 | Greeting + Date | — | — | No |
| 2 | Session Chips (Close Day active) | — | — | No |
| 3 | Hero: "Close Your Day" | T1 | none | No |
| 4 | Capture Bar | inline | none | No |
| 5 | Breadcrumbs | T2 | sage green | Yes — needs captures from today |
| 6 | Morning Intention Recall | T2 | blue-gray | Yes — needs today's day plan |
| 7 | "Something to Sit With" | T3 | none | No |

---

## Data Dependencies Summary

| Data Source | Cards That Use It | Integration |
|---|---|---|
| `day-plans/{date}.md` | Hero contextual line, Yesterday's Intention, Check-In, Morning Intention Recall | Local filesystem |
| `journals/{date}.md` | Yesterday's Synthesis, Hero contextual line | Local filesystem |
| `captures/{date}/*.md` | Breadcrumbs, Captures Today, Hero contextual line (count) | Local filesystem |
| Google Calendar | Calendar card, Next Event card, Hero contextual line | P0 external integration |
| Reflective prompts | "Something to Sit With" | Static pool (hardcoded for MVP) |
| Client time | Greeting, session chip active state, card stack selection, orb behavior | Device clock |

---

## Graceful Degradation

The home screen must work on **Day 1** when there's no user data at all — no journals, no day plans, no captures, no calendar connected.

**Day 1 morning screen:**
1. Greeting + Date
2. Session Chips (Open Day active)
3. Hero: "Open Your Day" with fallback line: *"A fresh start. What matters most to you today?"*
4. Capture Bar
5. "Something to Sit With"

That's it. Three items plus the capture bar. Clean, not empty. The conditional cards simply don't render. No "connect your calendar!" nag cards, no empty states with illustrations. Just less content.

As the user engages (sets intentions, drops captures, connects calendar), cards progressively appear over the following days. The screen gets richer with use.

---

## Design Tokens (from mockups)

| Token | Value |
|---|---|
| Background | Off-white / warm cream (#FAF8F5 approx) |
| Card background | White to light cream |
| Hero card background | Warm cream / light amber tint |
| Primary accent | Amber/gold (#E8960C approx) |
| CTA button | Amber/gold fill, white text |
| Left border — amber | Warm gold, 3–4px, rounded |
| Left border — sage green | Muted sage, 3–4px, rounded |
| Left border — blue-gray | Soft blue-gray, 3–4px, rounded |
| Body text | Dark warm gray |
| Labels/headers | Muted gray uppercase or amber uppercase |
| Contextual lines | Medium-weight warm gray |
| Card padding | 16–20px internal |
| Card gap | 16–20px vertical between cards |
| Tab bar | Standard iOS height + orb protrusion |

Refer to Magic Patterns design files for exact values.

---

## Known Issues from Mockups

1. **Orb clips last card content** — Need ~80px bottom safe zone padding on scroll container
2. **Capture bar vs orb redundancy** — Capture bar should use text cursor icon (not mic) to differentiate: bar = type, orb = talk
3. **Morning screen density** — If all conditional cards render, morning is the densest state. "Something to Sit With" can safely scroll below the fold.

---

## Implementation Priority

For MVP (milestone 1: "Close the Day" end-to-end):

**Build first:**
- Layout skeleton (greeting, chips, hero, card stack, tab bar with orb)
- Evening state with hero card (static contextual line OK for MVP)
- Breadcrumbs card (reads from captures directory)
- Morning Intention Recall card (reads from day plans directory)
- Tab bar with centered orb (evening tap → opens Close the Day session)
- Bottom safe zone padding

**Build second:**
- Morning state with hero card
- Calendar card (requires Google Calendar integration)
- Yesterday's Intention card with Completed/Carry forward actions
- Yesterday's Synthesis card
- Capture bar

**Build third:**
- Mid-day state
- Check-In card
- Next Event card
- Contextual hero line logic (LLM call or template cascade)
- Orb contextual behavior (session routing by time)
- Reflective prompt rotation