# Overview

This document captures the UX design decisions, interaction patterns, and visual direction for the MeOS MVP. It complements the Build Doc (technical spec) and Vision & Strategy doc.

---

# Design Philosophy

The core principle: **conversation IS the product.** Everything else — the life map view, history, home screen — exists to support and display the outputs of conversation. The UI should get out of the way and let the conversation breathe.

Seven non-negotiable UX principles:

**1. Conversation is the product.** Other screens support and display conversation outputs. The chat view is where the magic happens.

**2. Progressive disclosure.** Simple on day 1, richer on day 30. Don't overwhelm new users with features they don't need yet. The app should feel almost empty at first — just you and Sage.

**3. Warmth in every detail.** Soft amber, warm gray, muted earth tones. Not cold productivity blues or sterile whites. This is a life partner, not a spreadsheet. Every micro-interaction should feel human.

**4. Voice orb as contextual hero.** The most prominent, most beautiful element in the app. It adapts to what the user most likely wants to do right now — morning opens "Open your day," evening opens "Close your day," mid-day opens quick capture. Long-press always opens a free conversation. It should feel like a warm invitation to speak, and its behavior should feel natural enough that users never wonder what it will do.

**5. No lonely empty states.** Every screen should feel alive even before the user has generated data. Sage's presence fills the space.

**6. Time-aware, not time-locked.** The app knows what time of day it is and surfaces the most relevant content and action — but never removes access to anything. Morning and evening states are defaults, not gates. The user always has full access to everything; time only affects ordering and emphasis.

**7. Concierge, not dashboard.** The home screen shows what's happening now and what's next. It's a prioritized stream of contextual cards, not a wall of status panels. Identity-level content (north star, commitments, boundaries) lives on the Life Map tab where it changes slowly. The home screen is lightweight and action-oriented.

---

# Apps to Study for Inspiration

Before building, study these apps for specific patterns:

## Conversational AI

- **ChatGPT Voice Mode** — Recording state, turn-taking, animated orb. Study how they make the voice interaction feel alive.
- **Pi (Inflection AI)** — Warm personal feel, immediate onboarding, short message length. The gold standard for "AI that feels like it cares."
- **Woebot** — Guided but flexible conversation, quick-reply buttons for scaffolding choices. Good model for structured-but-natural conversation.
- **Replika** — Persistent "this AI knows me" feeling, memory surfacing. Study how they create continuity across sessions.

## Structured Output

- **Notion** — Beautiful structured data rendering. Study how they make databases feel elegant.
- **Miro / FigJam** — Visual mind-map aesthetic. Consider for life map visualization.
- **Fabulous** — Slow, intentional onboarding pacing. Study how they make setup feel like a ritual, not a chore.

## Check-In & Retention

- **Daylio** — Low-friction daily check-ins (5 seconds). Study the minimal viable check-in.
- **Headspace** — "One thing to do right now" home screen, gentle streak display. Study how they avoid guilt while encouraging consistency.
- **Rosebud** — Direct competitor. Study gaps: no life mapping, no persistent memory model, no accountability loop.
- **Finch** — Self-reflection that feels rewarding, not dutiful. Study gamification that doesn't feel cheap.

## Voice-First

- [**Otter.ai**](http://Otter.ai) — Recording interface, real-time transcripts, processing states. Study the voice-to-text UX flow.
- **Just Press Record** — Extreme simplicity (one button). Study what happens when you strip voice recording to its absolute minimum.

## Time-Aware / Contextual UI

- **Spotify** — Different home screen content at 7am vs 10pm. Morning surfaces energetic content, evening surfaces wind-down. Everything still accessible, just ordered differently. Study how content reordering communicates context without confusion.
- **Google Maps** — Transitions to dark mode as night falls. Context-aware surfacing of what matters at the moment. Study ambient visual adaptation.
- **Airbnb / Uber** — Completely different feature sets depending on user state (guest vs host, rider vs driver). Shows that contextual UX can be dramatic without being confusing.
- **Weather apps** — Visual adaptation to real-time conditions (rain animations, brightness shifts). Study how aesthetics communicate context beyond just content changes.

---

# Color & Visual Direction

## Palette (Warm, Not Clinical)

- **Primary:** Soft amber / warm gold (voice button, key CTAs)
- **Background:** Warm off-white / light cream (not pure white)
- **Text:** Dark warm gray (not pure black)
- **Accents:** Muted earth tones — terracotta, sage green, soft navy
- **Domain status colors:** Green (thriving), warm yellow (stable), soft orange (needs attention), muted red (in crisis)

## Typography

- Clean, humanist sans-serif (Inter, Satoshi, or similar)
- Generous line height for readability
- Sage's messages slightly different styling from user's (warmer background, subtle left border or avatar)

## Overall Feel

Think: a warm, well-designed journal meets a calm, thoughtful conversation. NOT a dashboard. NOT a productivity tool. NOT a clinical interface.

---

# First-Time User Journey

The entire first-time experience is designed around one principle: **get to the conversation as fast as possible.**

## Screen 1: Landing

Minimal. "Your AI life partner" + "Get Started" button. No feature tour, no carousel, no "here are 5 things MeOS does." One line, one button.

## Screen 2: Auth

Google OAuth or email magic link via Supabase. No profile creation, no username, no avatar selection. Zero friction.

## Screen 3: Conversation Begins

No tutorial screens. No tooltips. No "here's how to use the app" walkthrough. The user arrives directly in the conversation view, and Sage's opening message is already there waiting for them.

The life mapping conversation IS the onboarding. Everything the user needs to learn about the app, they learn by doing it.

## Screen 4: The Conversation (Life Mapping)

This is where the user spends 20-30 minutes on first use.

**Layout:**

- Full-screen chat interface, messages scrolling vertically
- Large prominent voice button at center-bottom (60px circle, warm amber color, subtle pulse animation when idle)
- Text input as a smaller field beside or below the voice button
- Sage's messages appear as text with warm styling

**Domain Cards (key innovation):**

When a domain exploration completes, a **domain card** appears inline in the conversation. These are visually distinct from regular chat bubbles — structured layout with labeled fields (current state, what's working, what's not, key tension, stated intention). Each card has a subtle edit affordance so the user can correct anything.

This staged output is critical: the user sees value accumulating in real time. They can see their life map building as they talk. This respects the ADHD need for visible progress and gives the user agency over session length.

**Quick-Reply Buttons:**

After each domain card, Sage offers quick-reply buttons:

- Buttons for each remaining domain ("Explore Relationships", "Explore Health", etc.)
- A "Wrap up" or "That's enough for now" option
- These reduce decision fatigue and keep the session moving

**Synthesis Card:**

At the end of the session, the synthesis appears as a special "life map summary" card — larger, more prominent, with the narrative summary, priorities, tensions, and anti-goals laid out beautifully.

## Screen 5: Life Map View

First standalone view of the complete life map. User sees all explored domains, the narrative summary, priorities, and tensions in a clean, organized layout. This is the "wow, look what we built together" moment.

## Screen 6: Home (Default Landing for Return Visits)

The home screen is a **time-aware contextual concierge** — a card stream that reorders based on time of day.

**Morning return:** Hero card says "Open your day." Below it: today's calendar summary, yesterday's intention check, and a reflection prompt. The voice orb defaults to launching the morning flow.

**Evening return:** Hero card says "Close your day." Below it: today's quick captures as breadcrumbs, morning intention recall, and a reflection prompt. The voice orb defaults to launching the evening flow.

**Mid-day return:** Hero card invites a quick capture. Calendar shows what's next. Any mid-day nudge appears if a commitment check is due.

Identity-level content (north star, commitments, boundaries) has moved to the Life Map tab, keeping the home screen lightweight. Not a dashboard. Not a wall of metrics. Just what matters right now.

---

# Navigation Structure

Bottom tab bar with 4 tabs:

`[Home]  [Chat]  [Life Map]  [History]`

- **Home:** Time-aware concierge. Card stream reorders by time of day (morning/mid-day/evening). Daily rhythm CTAs, contextual cards, quick capture FAB.
- **Chat:** The conversation interface. Primary interaction surface. Handles all session types (life mapping, daily rhythm, check-ins, ad hoc).
- **Life Map:** Structured view of the full life map + identity/direction content (north star, commitments, boundaries, priorities). Richer than before — absorbs content that previously lived on the home screen.
- **History:** Past sessions listed chronologically with AI summaries. Daily sessions grouped by date.

---

# Key Screen Specifications

## Conversation View (Chat)

The most important screen in the app.

**Voice Button:**

- 60px circle, warm amber/gold fill
- Subtle pulse animation when idle (inviting, not distracting)
- When recording: button grows slightly, color deepens, waveform or ripple animation
- When processing (transcription): button shows loading state, "Processing..." text
- When Sage is "thinking": typing indicator or subtle animation

**Message Bubbles:**

- User messages: right-aligned, muted background
- Sage messages: left-aligned, slightly warmer background, optional small Sage avatar/icon
- Domain summary cards: full-width, structured card layout, visually distinct from chat
- Synthesis cards: full-width, premium feel, clear sections
- **JournalCard** (new — Close the Day receipt): compact, warm background, rounded corners. Shows date + time, 1-2 sentence summary, energy indicator (subtle word, not a scale), domain tags as small pills, captures folded in (count). Footer: "This feeds into your next check-in." Lighter and more compact than domain cards — the feeling should be "captured," a receipt that says the system heard you.
- **DayPlanCard** (new — Open the Day receipt): compact card showing date, intention, calendar event count, key commitments. Similar warmth to JournalCard.
- **CaptureConfirmationCard** (new — quick capture): single-line confirmation, minimal: "Captured: [summary] → [classification]"

**Input Area:**

- Voice button is the hero (center, large)
- Text input field is secondary (smaller, below or to the side)
- Clear affordance for switching between voice and text

## Life Map View

The Life Map tab is now richer — it absorbs identity/direction content that previously lived on the home screen, making this the home for slow-changing, identity-level data.

**Section 1: "Where I Am" (Domain Map)**

- Domain grid: each of the 8 domains as cards, expandable
- Each domain card shows: status indicator (color dot), current state summary, stated intention
- Expanded view shows full detail: what's working, what's not, desires, tensions
- Narrative summary at the top (Sage's "coach notes")
- "Last updated" timestamp visible
- Changelog accessible ("See what changed")

**Section 2: "Who I Am & What I'm Doing" (Identity + Direction)**

- North star (primary compounding engine) — highlighted card with "because" clause
- Active commitments with progress indicators and next steps
- Quarterly priorities (top 3)
- Boundaries (anti-goals) — what the user is explicitly not pursuing
- Quarter theme (if life plan data exists)
- Radar chart from pulse check (baseline + current)

## Home Screen

A prioritized card stream that reorders based on time of day. All cards remain scrollable — nothing hidden, just weighted differently.

**Morning state (before ~11am):**
1. Hero card: "Open your day" CTA
2. Today's calendar summary (when calendar integration is available)
3. Yesterday's intention check — did you follow through?
4. Quick capture FAB (persistent)
5. Active commitments (collapsed, tappable → Life Map)
6. "Something to sit with" reflection prompt

**Mid-day state (~11am - 6pm):**
1. Hero card: Quick capture CTA ("Drop a thought")
2. Unresolved morning intentions flagged
3. Mid-day nudge card (if micro-commitment check is due)
4. Calendar: what's next
5. Quick capture FAB (persistent)

**Evening state (after ~6pm):**
1. Hero card: "Close your day" CTA
2. Today's breadcrumbs (quick captures as mini-timeline)
3. Morning intention recall — "You set out to..."
4. Quick capture FAB (persistent)
5. "Something to sit with" reflection prompt
6. Next check-in (if within 2 days)

**Voice orb behavior:** Morning → Open Day, mid-day → capture, evening → Close Day. Long-press always opens free conversation.

- No clutter, no metrics walls, no guilt-inducing streaks
- Sage dynamic line persists across all states: contextual one-liner referencing the life map

## History View

- Reverse chronological list of sessions
- Each entry: date, session type (life mapping / daily journal / day plan / weekly check-in), AI summary snippet, key themes as tags
- Daily sessions grouped by date for scannability
- Tappable to expand full summary or see transcript
- Simple, clean, scannable

---

# Interaction Patterns

## Voice Recording Flow

1. User taps voice button → recording begins, button animates
2. User speaks (no time limit, elapsed time shown)
3. User taps again to stop → audio sent for transcription
4. Brief loading state ("Processing...")
5. Transcript appears as user's message
6. Sage responds in text

## Domain Card Generation

1. Sage completes domain exploration in conversation
2. Sage's response includes structured domain summary
3. App parses the structured output and renders it as a visual card inline
4. Card has subtle "edit" affordance
5. Below the card, quick-reply buttons appear for next domain or wrap-up

## Close the Day Flow

1. User taps "Close your day" hero card on home screen (or voice orb in evening) → opens chat in `close_day` mode
2. Sage displays context loading briefly, then delivers ONE opening question drawn from today's data
3. User responds via voice or text (1-3 messages)
4. Sage may ask one follow-up if the user shared something significant. If not, close warmly.
5. Sage produces journal artifact → JournalCard rendered inline as receipt
6. Session closes. Home screen updates to reflect completion.

Total time: 2-3 minutes. The feeling should be "release" — emptying your head before bed.

## Open the Day Flow

1. User taps "Open your day" hero card (or voice orb in morning) → opens chat in `open_day` mode
2. Briefing card appears first: today's calendar, active priorities, yesterday's reflection summary
3. User scans the briefing (~30 seconds), then Sage asks ONE intention question
4. User responds via voice or text
5. Sage produces day plan artifact → DayPlanCard rendered inline
6. Session closes. Home screen updates to show intention for the day.

Total time: ~2 minutes. The feeling should be "oriented" — knowing what matters today.

## Quick Capture Flow

1. User taps quick capture FAB (always visible on home screen) or voice orb mid-day
2. Voice recording or text input — NO conversation UI, just a single input surface
3. User taps save
4. System transcribes, auto-classifies (thought / task / idea / tension), saves to `captures/`
5. CaptureConfirmationCard: "Captured." — single line, minimal
6. Done. No AI response. No follow-up.

Total time: ~10 seconds. Fastest possible input. These captures surface during Close the Day and weekly check-ins.

## Mid-Day Nudge

1. System-initiated push notification, once per day, mid-afternoon
2. References the morning intention: "You set an intention to protect your maker block. Still on track?"
3. One-tap response: yes / no / snooze
4. Not a "journal!" reminder. A micro-accountability moment tied to the user's own morning choice.

## Weekly Check-In Trigger

- Push notification at user's preferred time (default: Sunday evening)
- Notification opens directly into conversation view with check-in mode
- Home screen also shows countdown and "Start now" option
- With daily rhythm in place, the check-in references the week's journals, day plans, and captures

---

# Empty States

Every screen must feel alive, even before the user has data.

- **Home (pre-life mapping):** Sage greeting + "Ready to map your life? Let's talk." button
- **Home (post-mapping, first evening):** Evening hero card: "You mapped your life today. Ready to close the day?" — warm bridge from life mapping into the daily rhythm.
- **Home (post-mapping, first morning):** Morning hero card: "Good morning, [name]. Yesterday was big. What matters today?" — first day plan.
- **Life Map (pre-mapping):** Soft illustration + "Your life map will appear here after your first conversation with Sage."
- **History (no sessions):** "Your conversation history will show up here. Start by talking to Sage."
- **History (first daily sessions):** Daily entries appear grouped, making even one day of activity feel substantial.

No blank screens. No "nothing here yet" emptiness. Always a warm nudge toward the next natural step in the rhythm.

---

# Accessibility & Responsive Design

- Mobile-first (PWA), but usable on desktop
- Touch targets minimum 44px
- High contrast text on all backgrounds
- Voice input as primary removes typing barriers
- Screen reader compatible for all structured content
- Domain cards and life map view work at all screen sizes