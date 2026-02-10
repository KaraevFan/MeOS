# Overview

This document captures the UX design decisions, interaction patterns, and visual direction for the MeOS MVP. It complements the Build Doc (technical spec) and Vision & Strategy doc.

---

# Design Philosophy

The core principle: **conversation IS the product.** Everything else — the life map view, history, home screen — exists to support and display the outputs of conversation. The UI should get out of the way and let the conversation breathe.

Five non-negotiable UX principles:

**1. Conversation is the product.** Other screens support and display conversation outputs. The chat view is where the magic happens.

**2. Progressive disclosure.** Simple on day 1, richer on day 30. Don't overwhelm new users with features they don't need yet. The app should feel almost empty at first — just you and Sage.

**3. Warmth in every detail.** Soft amber, warm gray, muted earth tones. Not cold productivity blues or sterile whites. This is a life partner, not a spreadsheet. Every micro-interaction should feel human.

**4. Voice button as hero element.** The most prominent, most beautiful element in the app. It should feel like a warm invitation to speak, not a utilitarian record button.

**5. No lonely empty states.** Every screen should feel alive even before the user has generated data. Sage's presence fills the space.

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

Minimal home screen showing:

- Days until next check-in (with a "Start early" button)
- Current top 3 priorities
- "Talk to Sage" quick-start button
- "View Life Map" button

Not a dashboard. Not a wall of metrics. Just the essentials to orient and get moving.

---

# Navigation Structure

Bottom tab bar with 4 tabs:

`[Home]  [Chat]  [Life Map]  [History]`

- **Home:** Default landing, next check-in, priorities, quick actions
- **Chat:** The conversation interface. Primary interaction surface.
- **Life Map:** Structured view of the full life map, organized by domain
- **History:** Past sessions listed chronologically with AI summaries

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

**Input Area:**

- Voice button is the hero (center, large)
- Text input field is secondary (smaller, below or to the side)
- Clear affordance for switching between voice and text

## Life Map View

- Top section: narrative summary + cross-cutting insights (compounding engine, priorities, tensions, anti-goals)
- Domain grid: each of the 8 domains as cards, expandable
- Each domain card shows: status indicator (color dot), current state summary, stated intention
- Expanded view shows full detail: what's working, what's not, desires, tensions
- "Last updated" timestamp visible
- Changelog accessible ("See what changed")

## Home Screen

- Greeting: "Hey [name]" or time-based ("Good morning")
- Next check-in: date + "Start now" button
- Current priorities: top 3, displayed simply
- Quick-start: "Talk to Sage" button
- No clutter, no metrics walls, no guilt-inducing streaks
- Streak/consistency shown gently if at all ("3 weeks in a row" as warm acknowledgment, not a score)

## History View

- Reverse chronological list of sessions
- Each entry: date, session type (life mapping / weekly check-in), AI summary snippet, key themes as tags
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

## Weekly Check-In Trigger

- Push notification at user's preferred time (default: Sunday evening)
- Notification opens directly into conversation view with check-in mode
- Home screen also shows countdown and "Start now" option

---

# Empty States

Every screen must feel alive, even before the user has data.

- **Home (pre-life mapping):** Sage greeting + "Ready to map your life? Let's talk." button
- **Life Map (pre-mapping):** Soft illustration + "Your life map will appear here after your first conversation with Sage."
- **History (no sessions):** "Your conversation history will show up here. Start by talking to Sage."

No blank screens. No "nothing here yet" emptiness. Always a warm nudge toward the conversation.

---

# Accessibility & Responsive Design

- Mobile-first (PWA), but usable on desktop
- Touch targets minimum 44px
- High contrast text on all backgrounds
- Voice input as primary removes typing barriers
- Screen reader compatible for all structured content
- Domain cards and life map view work at all screen sizes