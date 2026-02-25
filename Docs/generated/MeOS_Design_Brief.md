# MeOS — Design Brief for Collaborators

**Date:** 2026-02-16
**Purpose:** Give someone entirely unfamiliar with the project enough context to participate in brainstorming, design critique, or feature planning.

---

## 1. What Is MeOS?

MeOS is a **voice-first AI life partner** app. You talk to an AI guide called **Sage**, and Sage helps you:

1. **Map your life** — a 20-30 min guided conversation that builds a structured picture of where you are across 8 life domains (career, relationships, health, finances, learning, creativity, play, meaning/purpose).
2. **Stay aligned** — weekly 5-10 min check-ins where Sage remembers what you said, notices patterns, and gently holds you accountable.

It is **not** a productivity tool, journaling app, or therapy replacement. The closest analog is an executive coach — someone who holds a persistent model of your entire life and uses it to help you make better decisions. But instead of $300/hour, it's a conversation with an AI that gets smarter about you over time.

**Core insight:** People can *talk* about their lives far more easily than they can write, plan, or organize. MeOS meets them there and does the structuring for them.

---

## 2. Target User

**"The Reflective Striver"** — age 25-40, knowledge worker or creative, has tried Notion/Obsidian/journals and bounced off all of them. Probably has ADHD (diagnosed or suspected). Already comfortable talking to AI. Feels capable but scattered or misaligned. Would pay $15-20/month for something that actually works.

---

## 3. Current State of the Build

**Sprint 1 MVP is complete and has been through two rounds of playtesting.** The core conversation loop works end-to-end:

| What | Status |
|------|--------|
| Life mapping conversation (talk to Sage, get structured life map) | Built, working |
| Weekly check-in conversation (Sage references your map + history) | Built, working |
| Voice input (record → transcribe → send as message) | Built, working |
| Structured output parsing (Sage outputs domain cards inline) | Built, working |
| Life Map view (see your full map organized by domain) | Built, working |
| Onboarding flow (intent → pulse check → radar chart → conversation) | Built, being reworked |
| Home screen (greeting, priorities, next check-in, talk to Sage) | Built, being refined |
| Session history (past conversations with summaries) | Built |
| Push notifications | Scaffolded, not yet functional |
| Auth (Google OAuth + magic link) | Built, working |
| PWA (installable, offline-capable for static assets) | Built |

**Data architecture pivot (completed Feb 14):** Life map content is now stored as **markdown files in Supabase Storage** rather than relational tables. Postgres handles orchestration (sessions, auth, pulse checks); Storage holds identity/content data as `.md` files with YAML frontmatter. Sage writes markdown; the system generates frontmatter automatically.

**Active work streams (as of Feb 16):**
1. **Onboarding flow rework** — adding name collection, trust-building mini-conversation before pulse check, better intent options
2. **Retention sprint** — session closing rituals, ad-hoc "Talk to Sage" sessions, functional push notifications with pre-generated content

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Client (PWA)                         │
│  Next.js 15 · React 19 · Tailwind · MediaRecorder       │
│  Mobile-first · Installable · Offline static assets      │
├─────────────────────────────────────────────────────────┤
│                    API Layer (Next.js)                    │
│  /api/chat (SSE streaming) · /api/transcribe · /api/push │
├──────────┬──────────────────┬───────────────────────────┤
│  Claude  │    Supabase      │    OpenAI Whisper          │
│  API     │  Postgres + Auth │    Speech-to-Text          │
│  (Sage)  │  + Storage + RLS │                            │
└──────────┴──────────────────┴───────────────────────────┘
```

### How a conversation works:

1. User speaks or types → message saved to Supabase `messages` table
2. Message + context sent to Claude via `/api/chat` → streamed back via Server-Sent Events
3. Sage's response is parsed in real-time → structured `[FILE_UPDATE]` blocks detected and rendered as domain cards, synthesis cards, etc.
4. Parsed data persisted → markdown files updated in Supabase Storage
5. Session completes → life map updated, session summary stored

### How Sage remembers you (token management):

Full transcripts are stored but **never injected into the AI context** (too expensive). Instead, each conversation is seeded with:

- `sage/context.md` — Sage's evolving working model of the user
- `life-map/_overview.md` — narrative summary, north star, priorities, tensions
- `life-plan/current.md` — active commitments and next steps
- Last 3 check-in summaries (from `check-ins/*.md`)
- Domain files for any domain flagged as `needs_attention` or `in_crisis`
- Pulse check baseline ratings

This keeps context bounded while preserving continuity across sessions.

### Markdown file structure per user:

```
users/{user_id}/
  life-map/
    _overview.md          # Narrative summary, north star, priorities, tensions
    career.md             # Domain: Career / Work
    relationships.md      # Domain: Relationships
    health.md             # etc.
    ...
  life-plan/
    current.md            # Active commitments, next steps
  check-ins/
    2026-02-14-weekly.md  # Check-in summaries
  sage/
    context.md            # Sage's working model of the user
    patterns.md           # Observed patterns
```

---

## 5. Design System — The Aesthetic

### Philosophy

**Warm journal meets calm conversation.** NOT a dashboard. NOT a productivity tool. NOT a clinical interface. Every pixel should feel warm, human, and intentional — like talking to a thoughtful friend in a well-designed space.

### Palette

| Role | Color | Usage |
|------|-------|-------|
| Primary | `#D97706` (bright amber) | Voice button, key CTAs, active states |
| Background | `#FDFCF8` (warm cream) | Page backgrounds — never pure white |
| Text | `#3D3832` (dark warm gray) | Body text — never pure black |
| Sage messages | `#F5F0E8` | Sage bubble backgrounds |
| Sage accent | `#7D8E7B` (sage green) | Left border on Sage messages, domain status |
| Terra accent | `#C17B5D` (terracotta) | Warmth, "what's not working" |
| Card bg | `#FFFFFF` | Cards get true white for lift |
| Borders | `rgba(61,56,50,0.08)` | Subtle, warm-tinted |

**Domain status colors:** Thriving (sage green) · Stable (warm amber) · Needs attention (terracotta) · In crisis (muted red — never aggressive)

**Shadows are warm-tinted** (`rgba(61,56,50,...)`) — never cool gray.

### Typography

**Satoshi** (primary), DM Sans fallback. Never Inter, Roboto, or system-ui defaults.

- Headings: Satoshi Bold, tight tracking
- Body: 16px, line-height 1.6
- Small text: 13px, medium weight, wide tracking
- Size scale: 13 / 15 / 16 / 20 / 24 / 32 — restrained, not dramatic

### Anti-Patterns (never do these)

- Purple or blue gradients
- Pure white `#FFFFFF` page backgrounds
- Pure black text
- Cold gray borders or shadows
- Metric dashboards, progress bars, gamification
- Guilt-inducing streaks, scores, or red warning badges
- Dense layouts — let content breathe
- Emojis as design elements (icons only)
- Bouncy, playful animations — keep it calm

---

## 6. The Five UX Loops

### Loop 1: First-Time Onboarding → Life Mapping (the magic moment)

```
Auth (Google/magic link, zero friction)
  → Sage Intro + name collection
    → "What's going on in your world?" (intent selection — 5 situational options)
      → Mini-conversation (2-3 quick-reply exchanges to build trust)
        → Pulse Check (rate 8 life domains, gut-feel 1-5)
          → Radar chart ("Here's your life snapshot — a map, not a grade")
            → Life Mapping conversation (20-30 min, voice-first)
              → Domain cards appear inline as each area is explored
                → Synthesis card at the end (your full life map)
                  → "View your Life Map" reveal moment
```

**Design principles:**
- Get to the conversation as fast as possible (under 3 min of setup)
- No tutorials, no tooltips — the conversation IS the onboarding
- Every screen earns the right to ask the next question
- Domain cards appearing during conversation = visible progress (critical for ADHD users)
- The radar chart is "a map, not a grade"

**The magic moment:** User sees their life mapped out after a single conversation and thinks *"Wow, this thing gets me."* If this doesn't land, nothing else matters.

### Loop 2: Weekly Check-In (the retention engine)

```
Push notification / home screen nudge (Day 7)
  → "Hey, welcome back. How are you doing?"
    → Sage references last session's commitments
      → Reviews what happened vs. intentions
        → Surfaces patterns (after 3+ sessions)
          → Energy check
            → "What's the one thing you want to be true by next check-in?"
              → Life map quietly updated
```

**Key:** This is NOT a performance review. Sage explores obstacles with curiosity ("What got in the way?"), never judgment. If the user is burned out, Sage suggests scaling back, not pushing harder. 5-10 minutes max — respect their time.

### Loop 3: Between-Sessions (ad-hoc — being built)

```
User opens app between check-ins
  → Home screen shows a reflection nudge
    (pre-generated at session end: "Something to sit with: [insight]")
  → User taps "Talk to Sage"
    → Sage opens with context: "I've been thinking about [specific thing from your map]..."
      → Free-form conversation (5-10 min, lighter than check-in)
        → Sage updates internal model only (not domain files)
```

**Purpose:** Fill the 7-day void. Give users a reason to come back. Make them feel like Sage is thinking about them even between sessions.

### Loop 4: Session Closing Ritual (being built)

```
Sage senses conversation is wrapping up
  → "I feel like I have a good picture. Want me to put it all together?"
    → Sage emits synthesis / check-in summary
      → Session Complete card appears in chat
        → "View your Life Map" CTA → Life Map reveal
          → Warm close: "Your next check-in is [date]. See you then."
            → Input disabled — session is over
```

**Two-beat arc:** (1) In-chat synthesis is the emotional close of the conversation, (2) Life Map reveal is the "wow" moment. Sage always speaks last — no system messages.

### Loop 5: Re-Engagement (being built)

```
Session ends → post-session processing (fire-and-forget)
  → Claude generates:
    - 2-3 reflection prompts (for home screen)
    - Day 1 push notification copy
    - Day 3 push notification copy (conditional)
    - Check-in reminder copy
  → All stored in DB (zero additional inference cost at send time)

Day 1: Push notification → "I've been thinking about [specific thing]..."
  → Taps → lands on home → sees reflection nudge
Day 3 (if no return): "No rush. Your life map is here whenever you want it."
Day 7: Check-in reminder → "Ready to check in on [commitment]?"
```

**All re-engagement content is pre-generated at session end** while Claude has warm context. No cold-start inference for notifications. Content sounds like Sage, not a system — personal, specific, warm.

---

## 7. Sage — The AI Persona

### Personality

- Warm therapist energy — empathetic, reflective, gentle
- But **opinionated** — gives structure, challenges with curiosity, manages expectations
- Mirrors back what it hears before offering perspective
- Names emotions the user hasn't articulated
- Follows emotional energy — if user gets animated, Sage goes deeper there
- Concise: **2-4 sentences typical**, longer only when synthesizing

### What Sage is NOT

- Not a therapist (doesn't diagnose or treat)
- Not a cheerleader (doesn't blindly affirm)
- Not a task manager (doesn't nag about to-dos)
- Not a friend (maintains gentle professional warmth)

### Voice examples

> "I notice you listed seven priorities — in my experience, people who try to change everything at once usually change nothing. Want to talk about what matters most right now?"

> "You said you want to grow in your career but also that you're burned out. How do you think about that tension?"

> "That's real." / "That takes courage to say out loud."

Uses "I notice" and "I'm hearing" — never "You should" or "You need to."

---

## 8. Key Screens

### Conversation View (primary interface)

- Full-screen chat, messages scrolling vertically
- **Voice button is the hero:** 64px amber circle, centered bottom, subtle pulse animation when idle, grows to 72px when recording
- Text input is secondary (smaller, below voice button)
- Domain cards appear inline — visually distinct from chat bubbles (full-width, structured, elevated)
- Quick-reply buttons appear after domain cards (pill-shaped, domain suggestions + "Wrap up")

### Home Screen

- Warm greeting with user's name
- Reflection nudge from Sage (if available)
- Current priorities (north star + top 3)
- Next check-in date + "Start now" option
- Breathing voice orb ("Talk to Sage" CTA)
- **Not a dashboard.** Minimal, warm, action-oriented.

### Life Map View

- Top: narrative summary + cross-cutting insights (north star, priorities, tensions, boundaries)
- Grid: all 8 life domains as expandable cards
- Each card: status dot + current state + full details on expand
- Static view — edits happen through conversation

### History View

- Reverse-chronological session list
- Each: date, type, summary snippet, theme tags
- Tappable to see full transcript

---

## 9. Navigation

Bottom tab bar with 4 tabs:

```
[Home]  [Chat]  [Life Map]  [History]
```

Active tab: amber icon + label. Inactive: warm gray. Subtle top border, cream background.

---

## 10. What's Not Built Yet (Out of Scope)

- Daily nudges / micro-prompts
- Pattern detection automation (basic theme tracking only)
- Data visualizations (domain status over time)
- TTS (Sage speaks only in text)
- Content intake (articles, podcasts feeding context)
- Habit tracking
- Monthly / quarterly review session types
- Social / community features
- Native app (PWA only)
- Payments / Stripe
- Tool use / agentic capabilities (architecture audit done, not started)

---

## 11. Known Tensions & Open Questions

1. **Session endings are abrupt** — closing rituals are being designed (Loop 4 above)
2. **The 7-day void** — nothing happens between check-ins today; ad-hoc sessions + push notifications are being built to bridge it
3. **Onboarding trust gap** — pulse check asks for sensitive ratings before user knows Sage; mini-conversation being added before it
4. **No pattern detection** — `patterns` table exists but isn't populated automatically; Sage can observe patterns conversationally but has no systematic detection
5. **Token management is unmeasured** — context injection works because Claude's 200K window is large, but there's no token counting or overflow handling
6. **Client-side persistence is fragile** — messages saved after streaming, but failures are silent; needs to move server-side

---

## 12. Design Principles (Non-Negotiable)

1. **Conversation IS the product.** Everything else supports it.
2. **Messy first, structured later.** Never force premature organization.
3. **Identity before goals.** Understand who someone is before telling them what to do.
4. **AI that challenges, not just affirms.** A mirror, not a cheerleader.
5. **Artifacts that evolve, not dashboards that judge.** Living documents, not scorecards.
6. **No guilt.** Gentle consistency acknowledgment, never streaks or scores.
7. **Warmth in every detail.** If it feels cold, clinical, or generic — it's wrong.
8. **Voice button is the hero.** Most prominent, most beautiful element in the app.
9. **No empty states.** Every screen has Sage's warm presence.
10. **Progressive disclosure.** Simple on day 1, richer on day 30.
