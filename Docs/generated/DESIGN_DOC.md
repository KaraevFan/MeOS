# MeOS — Technical Design Document

> Voice-first AI life partner app. An AI guide called "Sage" helps users map their life through guided conversation and stay aligned through weekly check-ins.

**Version:** MVP (Sprint 1)
**Stack:** Next.js 15 + Tailwind CSS + Supabase + Claude API + OpenAI Whisper
**Repository:** https://github.com/KaraevFan/MeOS.git

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [File Structure](#2-file-structure)
3. [Design System](#3-design-system)
4. [Database Schema](#4-database-schema)
5. [Authentication](#5-authentication)
6. [Conversation Engine](#6-conversation-engine)
7. [Structured Output Parsing](#7-structured-output-parsing)
8. [Voice Input Pipeline](#8-voice-input-pipeline)
9. [Session Lifecycle](#9-session-lifecycle)
10. [Life Map Persistence](#10-life-map-persistence)
11. [API Routes](#11-api-routes)
12. [Frontend Components](#12-frontend-components)
13. [PWA Configuration](#13-pwa-configuration)
14. [Push Notifications](#14-push-notifications)
15. [Middleware & Security](#15-middleware--security)
16. [Testing](#16-testing)
17. [Dependencies](#17-dependencies)
18. [Environment Variables](#18-environment-variables)
19. [Known Limitations & Future Work](#19-known-limitations--future-work)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Client (PWA)                         │
│  Next.js App Router · React 19 · Tailwind · MediaRecorder│
├─────────────────────────────────────────────────────────┤
│                    API Layer                              │
│  /api/chat (SSE)  ·  /api/transcribe  ·  /api/push/*    │
├──────────┬──────────────────┬───────────────────────────┤
│  Claude  │    Supabase      │    OpenAI Whisper          │
│  API     │  Postgres + Auth │    Speech-to-Text          │
│  (Sage)  │  + RLS + Realtime│                            │
└──────────┴──────────────────┴───────────────────────────┘
```

### Data Flow

1. **User speaks or types** → message saved to Supabase `messages` table
2. **Message + context sent to Claude** via `/api/chat` → streamed back via SSE
3. **Structured blocks parsed in real-time** → domain cards and synthesis cards rendered inline
4. **Parsed data persisted** → `life_map_domains` and `life_maps` tables updated
5. **Session completes** → summary stored, onboarding marked done

### Token Management Strategy

Full transcripts are stored in DB but **never injected into Claude API calls**. Instead, context is built from:

- Current life map (structured data from `life_maps` + `life_map_domains`)
- AI-generated summaries of last 3–5 sessions (from `sessions.ai_summary`)
- Active patterns (from `patterns` table)
- Last stated commitment (from `sessions.commitments_made`)

This keeps token usage bounded while maintaining continuity across sessions.

---

## 2. File Structure

```
app/
├── layout.tsx                          Root layout, PWA metadata, service worker
├── page.tsx                            Root redirect (→ /home or /login)
├── globals.css                         Tailwind directives + Satoshi font import
├── (auth)/
│   ├── layout.tsx                      Centered auth layout
│   ├── login/page.tsx                  Google OAuth + magic link login
│   └── auth/callback/route.ts          OAuth code exchange + user creation
├── (main)/
│   ├── layout.tsx                      Auth guard + bottom tab bar
│   ├── home/
│   │   ├── page.tsx                    Greeting, check-in scheduling, priorities
│   │   └── loading.tsx                 Skeleton loader
│   ├── chat/
│   │   └── page.tsx                    Chat wrapper (session type routing)
│   ├── life-map/
│   │   ├── page.tsx                    Life map with synthesis + domain grid
│   │   └── loading.tsx                 Skeleton loader
│   └── history/
│       ├── page.tsx                    Past sessions list
│       ├── [sessionId]/page.tsx        Session detail (read-only replay)
│       └── loading.tsx                 Skeleton loader
└── api/
    ├── chat/route.ts                   Claude streaming endpoint (SSE)
    ├── transcribe/route.ts             Whisper transcription proxy
    └── push/subscribe/route.ts         Push subscription upsert

components/
├── ui/
│   └── bottom-tab-bar.tsx              Fixed bottom nav (4 tabs)
├── chat/
│   ├── chat-view.tsx                   Main orchestrator (session init, streaming, persistence)
│   ├── chat-input.tsx                  Text input + voice button (3 states)
│   ├── message-bubble.tsx              Message renderer (text + inline cards)
│   ├── domain-card.tsx                 Domain summary card
│   ├── synthesis-card.tsx              Life map synthesis card
│   ├── typing-indicator.tsx            Three-dot bounce animation
│   ├── quick-reply-buttons.tsx         Domain suggestion pills
│   ├── building-card-placeholder.tsx   Skeleton while card is streaming
│   └── error-message.tsx               Retry-capable error display
├── life-map/
│   ├── synthesis-section.tsx           Narrative, engine, priorities, tensions, anti-goals
│   ├── domain-grid.tsx                 All 8 domains (explored + unexplored)
│   └── domain-detail-card.tsx          Expandable/collapsible domain detail
├── history/
│   ├── session-list.tsx                Reverse-chronological session list
│   └── session-card.tsx                Session card (type badge, summary, themes)
└── sw-register.tsx                     Service worker registration (production only)

lib/
├── ai/
│   ├── prompts.ts                      System prompts (life mapping + weekly check-in)
│   ├── context.ts                      Context builder (injects life map + history)
│   ├── parser.ts                       Structured output parser
│   └── parser.test.ts                  10 unit tests for parser
├── supabase/
│   ├── server.ts                       Server Supabase client (cookie-based)
│   ├── client.ts                       Browser Supabase client
│   ├── middleware.ts                   Auth session refresh + route protection
│   ├── sessions.ts                     Session CRUD helpers
│   ├── life-map.ts                     Life map + domain CRUD helpers
│   └── home-data.ts                    Home screen data aggregation
├── voice/
│   └── recorder.ts                     useVoiceRecorder hook (MediaRecorder)
├── notifications/
│   └── push.ts                         Push permission + subscription helpers
├── utils.ts                            cn() helper (clsx + tailwind-merge)
└── constants.ts                        ALL_DOMAINS, SESSION_STALE_HOURS

types/
├── chat.ts                             Chat types (messages, domains, synthesis, blocks)
└── database.ts                         DB row interfaces (users, sessions, messages, etc.)

public/
├── manifest.json                       PWA manifest
├── sw.js                               Service worker
└── icons/
    ├── icon.svg                        Source SVG
    ├── icon-192.png                    Home screen icon
    └── icon-512.png                    Splash screen icon

supabase/
├── config.toml                         Supabase project config
├── migrations/
│   └── 001_initial_schema.sql          7 tables + RLS + triggers
└── functions/
    └── check-in-reminder/index.ts      Deno edge function (weekly nudge)
```

---

## 3. Design System

### Philosophy

Warm, conversational, and non-clinical. The palette avoids cold blues and sterile whites. Every interaction should feel like talking to a thoughtful friend, not using a productivity app.

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `#D4A574` | Buttons, accents, voice button, active states |
| `primary-hover` | `#C4956A` | Button hover/press |
| `bg` | `#FAF7F2` | Page background (warm cream) |
| `bg-sage` | `#F5F0E8` | Sage message bubbles |
| `bg-card` | `#FFFFFF` | Cards, inputs |
| `text` | `#3D3832` | Primary text (dark warm gray) |
| `text-secondary` | `#8A7E74` | Muted text, labels |
| `accent-sage` | `#7D8E7B` | Sage message left border |
| `accent-terra` | `#C17B5D` | Errors, negatives, "what's not working" |
| `accent-navy` | `#5B6B7A` | Informational accents |
| `border` | `rgba(61,56,50,0.08)` | Subtle card borders |

### Status Colors

| Status | Color | Token |
|--------|-------|-------|
| Thriving | `#7D8E7B` | `status-thriving` |
| Stable | `#D4A574` | `status-stable` |
| Needs attention | `#C17B5D` | `status-attention` |
| In crisis | `#B05A5A` | `status-crisis` |

### Typography

| Size | Value | Usage |
|------|-------|-------|
| `xs` | 13px | Labels, timestamps |
| `sm` | 15px | Body text, messages |
| `base` | 16px | Default |
| `lg` | 20px | Section headers |
| `xl` | 24px | Page titles |
| `2xl` | 32px | Hero text |

Font stack: `Satoshi, DM Sans, system-ui, sans-serif` (loaded from Fontshare CDN)

### Spacing Scale

`xs: 4px` · `sm: 8px` · `md: 16px` · `lg: 24px` · `xl: 32px` · `2xl: 48px`

### Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-sm` | `0 1px 3px rgba(61,56,50,0.06)` | Cards |
| `shadow-md` | `0 4px 12px rgba(61,56,50,0.08)` | Elevated cards |
| `shadow-glow` | `0 0 20px rgba(212,165,116,0.25)` | Voice button ambient glow |

### Animations

- **Pulse:** Voice button idle state — subtle 3s scale breathe (1.0 → 1.03)
- **Fade-up:** Message entrance — 200ms opacity + translateY(8px → 0)
- **Spin:** Processing states — standard CSS spin on loading indicators

---

## 4. Database Schema

7 tables with Row Level Security on all.

### users

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK, FK → auth.users) | Matches Supabase Auth user |
| email | text | From auth provider |
| created_at | timestamptz | Auto |
| onboarding_completed | boolean | Set true after first life mapping |
| sage_persona_notes | text | Future: Sage personalization |

### life_maps

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| user_id | uuid (FK → users) | |
| is_current | boolean | Only one active per user |
| narrative_summary | text | Sage's narrative synthesis |
| primary_compounding_engine | text | The one thing that unlocks the most |
| quarterly_priorities | text[] | Max 3 priorities |
| key_tensions | text[] | Contradictions to watch |
| anti_goals | text[] | Explicitly not doing now |
| failure_modes | text[] | Future use |
| identity_statements | text[] | Future use |
| created_at / updated_at | timestamptz | Auto-updated via trigger |

### life_map_domains

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| life_map_id | uuid (FK → life_maps) | |
| domain_name | text | One of 8 life domains |
| current_state | text | 1–2 sentence summary |
| whats_working | text[] | Positive elements |
| whats_not_working | text[] | Pain points |
| desires | text[] | What user wants |
| tensions | text[] | Core contradictions |
| stated_intentions | text[] | Commitments |
| status | enum | `thriving`, `stable`, `needs_attention`, `in_crisis` |
| updated_at | timestamptz | Auto-updated via trigger |

### sessions

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| user_id | uuid (FK → users) | |
| session_type | enum | `life_mapping`, `weekly_checkin`, `monthly_review`, `quarterly_review` |
| status | enum | `active`, `completed`, `abandoned` |
| ai_summary | text | Post-session AI-generated summary |
| sentiment | text | Overall emotional tone |
| key_themes | text[] | Topics discussed |
| commitments_made | text[] | What user committed to |
| energy_level | int (1–5) | Self-reported if discussed |
| domains_explored | text[] | Domains covered in session |
| created_at | timestamptz | |
| completed_at | timestamptz | Set on completion |
| updated_at | timestamptz | Auto-updated via trigger |

### messages

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| session_id | uuid (FK → sessions) | |
| role | enum | `user`, `assistant` |
| content | text | Full message text (including structured blocks) |
| has_structured_block | boolean | Whether message contains `[DOMAIN_SUMMARY]` etc. |
| created_at | timestamptz | |

### patterns

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| user_id | uuid (FK → users) | |
| pattern_type | enum | `recurring_theme`, `sentiment_trend`, `consistency`, `avoidance` |
| description | text | Pattern description |
| first_detected | timestamptz | |
| occurrence_count | int | Times observed |
| related_domain | text | Associated life domain |
| is_active | boolean | |

### push_subscriptions

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| user_id | uuid (FK → users) | |
| endpoint | text | Web Push endpoint URL |
| keys | jsonb | p256dh + auth keys |
| created_at | timestamptz | |

### RLS Policies

All tables enforce user-level isolation:
- Users can only read/write their own data
- Domain and message access verified via parent table ownership (join check)
- No service-role bypass from client — API routes use server client with cookie-based auth

---

## 5. Authentication

### Flow

```
Login Page
    ├── Google OAuth → Supabase OAuth → /auth/callback → /home
    └── Magic Link → Email sent → User clicks → /auth/callback → /home
```

### Implementation

- **`@supabase/ssr`** with PKCE flow (not deprecated `auth-helpers`)
- **Server client** (`lib/supabase/server.ts`): Cookie-based, used in server components and API routes
- **Browser client** (`lib/supabase/client.ts`): Used in client components
- **Middleware** (`middleware.ts` → `lib/supabase/middleware.ts`): Refreshes auth tokens on every request, redirects unauthenticated users from protected routes to `/login`

### Auth Callback (`/auth/callback`)

1. Exchanges auth code for session
2. Creates `users` row if first login (id matches `auth.users.id`)
3. Redirects to `/home`

### Protected Routes

All paths under `/(main)/*` require authentication. The middleware intercepts requests and checks `supabase.auth.getUser()` before allowing access.

---

## 6. Conversation Engine

### Sage Persona

Sage is warm, empathetic, and opinionated. Key traits:
- Mirrors back what it hears before offering perspective
- Names emotions the user hasn't articulated
- Follows emotional energy — goes deeper where user gets animated
- Challenges with curiosity, not judgment
- Concise: 2–4 sentences typical, longer only when synthesizing
- Never performatively positive or guilt-inducing

### Session Types

| Type | Trigger | Prompt | Output |
|------|---------|--------|--------|
| Life Mapping | First visit or "Map your life" | `getLifeMappingPrompt()` | Domain summaries + synthesis |
| Weekly Check-in | "Check in" from home | `getWeeklyCheckinPrompt(context)` | Session summary |

### System Prompt Structure

**Life Mapping:** Static prompt with persona, 8 domains, conversation structure, output formats.

**Weekly Check-in:** Dynamic prompt that injects:
- Current life map (narrative + domains)
- Summaries of last 5 completed sessions
- Active patterns
- Last commitment made

Built by `lib/ai/context.ts → buildConversationContext()`.

### Streaming

Claude API response is streamed via `anthropic.messages.stream()`. Each text delta is forwarded to the client as an SSE event:

```
data: {"text": "token"}\n\n
data: {"text": "more tokens"}\n\n
data: [DONE]\n\n
```

---

## 7. Structured Output Parsing

### Block Formats

Sage outputs structured blocks inline in conversation text:

```
[DOMAIN_SUMMARY]
Domain: Career / Work
Current state: ...
What's working: item1, item2
What's not working: item1, item2
Key tension: ...
Stated intention: ...
Status: stable
[/DOMAIN_SUMMARY]
```

```
[LIFE_MAP_SYNTHESIS]
Narrative: ...
Primary compounding engine: ...
Quarterly priorities: p1, p2, p3
Key tensions: t1, t2
Anti-goals: g1, g2
[/LIFE_MAP_SYNTHESIS]
```

```
[SESSION_SUMMARY]
Date: ...
Sentiment: ...
Energy level: ...
Key themes: t1, t2
Commitments: c1, c2
Life map updates: ...
Patterns observed: ...
[/SESSION_SUMMARY]
```

### Parser (`lib/ai/parser.ts`)

Two exports:

**`parseMessage(content: string): ParsedMessage`**
- Finds opening/closing tags via `indexOf` (no regex)
- Splits content into `textBefore`, `block`, `textAfter`
- Parses block content as `Key: value` lines
- Comma-separated values split into arrays
- Falls back to plain text on malformed output (no crash)

**`parseStreamingChunk(accumulated: string): StreamingParseResult`**
- For real-time rendering during streaming
- No opening tag → show all text, `pendingBlock: false`
- Opening tag, no closing → show text before tag, `pendingBlock: true` (triggers skeleton card)
- Both tags → show text before, `completedBlock` with parsed data

### Rendering

- `domain_summary` → `DomainCard` component (inline in chat)
- `life_map_synthesis` → `SynthesisCard` component (inline in chat)
- `session_summary` → Not rendered (backend processing only)
- Pending block → `BuildingCardPlaceholder` (pulsing skeleton)

---

## 8. Voice Input Pipeline

```
Tap mic → MediaRecorder starts → Tap stop → Blob created → POST /api/transcribe → Text returned → Auto-sent as message
```

### Voice Button States

| State | Appearance | Action |
|-------|-----------|--------|
| Idle | 64px amber circle, pulse animation, mic icon | Tap → start recording |
| Recording | 72px deeper amber, stop icon, elapsed time | Tap → stop + process |
| Processing | 64px, spinner | Waiting for transcription |

### Implementation

- **`lib/voice/recorder.ts`** — `useVoiceRecorder()` hook wrapping `MediaRecorder` API
- Supports `audio/webm` with `audio/mp4` fallback (Safari)
- Tracks recording duration via `setInterval`
- Handles permission errors gracefully

### Transcription

- **`/api/transcribe`** — receives `FormData` with audio blob, forwards to OpenAI Whisper API (`whisper-1` model)
- Returns `{ text: string }`
- Transcribed text auto-sent to Sage (no manual review step in MVP)

---

## 9. Session Lifecycle

### States

```
              ┌─────────────┐
   create →   │   active     │
              └──────┬───────┘
                     │
          ┌──────────┼──────────┐
          ▼                     ▼
   ┌─────────────┐     ┌─────────────┐
   │  completed   │     │  abandoned   │
   └─────────────┘     └─────────────┘
   (synthesis or        (24h timeout,
    summary detected)    future impl)
```

### Session Initialization (`chat-view.tsx`)

1. Check for existing `active` session of same type for user
2. If found → restore messages + domains explored
3. If not found → create new session + save Sage's opening message

### Completion Triggers

- **Life Mapping:** `[LIFE_MAP_SYNTHESIS]` block detected → persist synthesis → complete session → mark `onboarding_completed = true`
- **Weekly Check-in:** `[SESSION_SUMMARY]` block detected → persist summary/themes/commitments → complete session
- **Domain explored:** `[DOMAIN_SUMMARY]` block → upsert domain → update `domains_explored` array

### Helpers (`lib/supabase/sessions.ts`)

- `getActiveSession(supabase, userId, sessionType)` — finds active session + loads messages
- `createSession(supabase, userId, sessionType)` — creates new active session
- `saveMessage(supabase, sessionId, role, content, hasBlock)` — persists message
- `completeSession(supabase, sessionId)` — sets status=completed, completed_at=now
- `updateDomainsExplored(supabase, sessionId, domains)` — tracks which domains covered
- `updateSessionSummary(supabase, sessionId, summary, themes, commitments, sentiment, energy)` — saves AI summary

---

## 10. Life Map Persistence

### Data Flow

```
Sage outputs [DOMAIN_SUMMARY] → parser extracts DomainSummary
    → getOrCreateLifeMap() → upsertDomain() → saved to life_map_domains

Sage outputs [LIFE_MAP_SYNTHESIS] → parser extracts LifeMapSynthesis
    → getOrCreateLifeMap() → updateLifeMapSynthesis() → saved to life_maps
```

### Helpers (`lib/supabase/life-map.ts`)

- `getCurrentLifeMap(supabase, userId)` — fetches current life map with all domains (join query)
- `getOrCreateLifeMap(supabase, userId)` — returns existing or creates new `is_current=true` map
- `upsertDomain(supabase, lifeMapId, domainData)` — checks for existing domain by name, updates or inserts
- `updateLifeMapSynthesis(supabase, lifeMapId, synthesis)` — updates narrative, engine, priorities, tensions, anti-goals

### 8 Life Domains

1. Career / Work
2. Relationships
3. Health / Body
4. Finances
5. Learning / Growth
6. Creative Pursuits
7. Play / Fun / Adventure
8. Meaning / Purpose

---

## 11. API Routes

### POST `/api/chat`

**Purpose:** Stream Claude API response to client.

| Field | Detail |
|-------|--------|
| Auth | Required (cookie-based Supabase session) |
| Request | `{ sessionId, sessionType, messages: [{role, content}] }` |
| Response | SSE stream: `data: {"text":"..."}\n\n` ... `data: [DONE]\n\n` |
| Error | `data: {"error":"..."}\n\n` |
| Model | `claude-sonnet-4-5-20250929` (configurable via `ANTHROPIC_MODEL`) |
| Max tokens | 4096 |

### POST `/api/transcribe`

**Purpose:** Proxy audio to OpenAI Whisper.

| Field | Detail |
|-------|--------|
| Auth | Required |
| Request | FormData with `audio` blob |
| Response | `{ text: string }` |
| Model | `whisper-1` |

### POST `/api/push/subscribe`

**Purpose:** Save push notification subscription.

| Field | Detail |
|-------|--------|
| Auth | Required |
| Request | `{ endpoint, keys: { p256dh, auth } }` |
| Response | `{ ok: true }` |
| Storage | Upserts to `push_subscriptions` table |

---

## 12. Frontend Components

### Page Hierarchy

```
RootLayout (PWA meta, SW register)
├── AuthLayout (centered, cream bg)
│   └── LoginPage (OAuth + magic link)
└── MainLayout (auth guard, tab bar, pb-20)
    ├── HomePage (greeting, check-in card, priorities)
    ├── ChatPage (fixed positioning, full viewport)
    │   └── ChatView (session management, streaming)
    │       ├── MessageBubble (text + inline cards)
    │       │   ├── DomainCard
    │       │   └── SynthesisCard
    │       ├── TypingIndicator
    │       ├── BuildingCardPlaceholder
    │       ├── ErrorMessage
    │       ├── QuickReplyButtons
    │       └── ChatInput (textarea + voice button)
    ├── LifeMapPage (synthesis + domain grid)
    │   ├── SynthesisSection
    │   └── DomainGrid
    │       └── DomainDetailCard (expandable)
    └── HistoryPage (session list)
        ├── SessionList
        │   └── SessionCard
        └── [sessionId] (read-only replay)
```

### Key Component Details

**ChatView** — The main orchestrator. Client component managing:
- Session initialization (check active → create new → Sage opening)
- Message send (save to DB → POST to /api/chat → stream → parse → persist)
- Domain tracking (set of explored domains for quick-reply buttons)
- Error handling with retry (3 retries max)
- Push notification prompt (after first life mapping completes)

**MessageBubble** — Renders differently for user (right-aligned, cream bg) and Sage (left-aligned, sage bg, green left border). Parses content and renders inline domain/synthesis cards.

**ChatInput** — 3-state voice button (idle/recording/processing) + auto-resizing textarea + send button. Voice transcription auto-sends without manual review.

**DomainDetailCard** — Expandable/collapsible. Collapsed: domain name + status dot + current state snippet. Expanded: full detail (working, not working, desires, tensions, intentions).

---

## 13. PWA Configuration

### Manifest

```json
{
  "name": "MeOS",
  "short_name": "MeOS",
  "description": "Your AI life partner",
  "start_url": "/home",
  "display": "standalone",
  "background_color": "#FAF7F2",
  "theme_color": "#D4A574"
}
```

### Service Worker (`public/sw.js`)

- **Static asset caching:** Cache-first for JS, CSS, fonts, icons
- **API exclusion:** Network-only for `/api/*` and Supabase connections
- **Push handling:** Listens for `push` events, shows notification
- **Notification click:** Opens `/chat?type=weekly_checkin`
- **Registration:** Production-only via `components/sw-register.tsx`

### App Icons

- 192x192 PNG (home screen)
- 512x512 PNG (splash screen)
- Amber background with white "M" letterform

### Viewport

```
width: device-width
initialScale: 1
maximumScale: 1
userScalable: false
themeColor: #D4A574
```

---

## 14. Push Notifications

### Subscription Flow

```
Life mapping completes → prompt shown → user taps "Allow"
→ Notification.requestPermission() → serviceWorker.pushManager.subscribe()
→ POST /api/push/subscribe (saves to DB)
```

### Reminder System

Supabase Edge Function (`supabase/functions/check-in-reminder/index.ts`):
1. Runs on cron schedule (daily)
2. Queries users with last completed session 7+ days ago
3. For each: send web push notification (if subscribed) or email fallback
4. Message: "Hey, it's been a week. Ready for a quick check-in with Sage?"

**Note:** Actual push sending requires VAPID key configuration. The edge function currently logs intent; push delivery to be wired when VAPID keys are provisioned.

---

## 15. Middleware & Security

### Route Protection

```typescript
// middleware.ts — runs on all non-static routes
matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']
```

Logic:
1. Create Supabase server client with request cookies
2. Call `supabase.auth.getUser()` to refresh session
3. If unauthenticated + protected route → redirect to `/login`
4. Pass updated cookies in response

### Security Measures

- **RLS on all tables** — even with a compromised client, users can only access own data
- **API keys server-side only** — Claude and OpenAI keys never exposed to client
- **Cookie-based auth** — PKCE flow via `@supabase/ssr`, no client-stored tokens
- **No `any` types** — TypeScript strict mode throughout
- **Input validation** — API routes validate auth and required fields before processing

---

## 16. Testing

### Test Suite

**Framework:** Vitest 4.x

**Parser Tests** (`lib/ai/parser.test.ts`) — 10 tests:

1. Plain text message (no blocks) → returns text only
2. Domain summary block → parses all fields correctly
3. Text before and after block → splits correctly
4. Life map synthesis block → parses narrative, priorities, tensions
5. Session summary block → parses date, sentiment, themes
6. Malformed block (no closing tag) → returns as plain text
7. Malformed block (missing fields) → uses empty defaults
8. Streaming: no tag detected → full text displayed
9. Streaming: opening tag only → pending block state
10. Streaming: complete block → parsed block returned

### Running Tests

```bash
npx vitest run              # Run all tests
npx vitest run --watch      # Watch mode
npx next build              # Type-check + build verification
npm run lint                # ESLint
```

---

## 17. Dependencies

### Production

| Package | Version | Purpose |
|---------|---------|---------|
| next | ^15.1.0 | Framework (App Router, SSR, API routes) |
| react / react-dom | ^19.0.0 | UI library |
| @supabase/supabase-js | ^2.49.1 | Database client + auth |
| @supabase/ssr | ^0.5.2 | Server-side auth (PKCE, cookies) |
| @anthropic-ai/sdk | ^0.39.0 | Claude API client |
| clsx | ^2.1.1 | Conditional class names |
| tailwind-merge | ^3.0.0 | Intelligent Tailwind class merging |

### Development

| Package | Version | Purpose |
|---------|---------|---------|
| typescript | ^5.7.0 | Type system |
| tailwindcss | ^3.4.0 | CSS framework |
| vitest | ^4.0.18 | Unit testing |
| eslint + eslint-config-next | ^9.0 / ^15.1 | Linting |
| postcss + autoprefixer | ^8.4 / ^10.4 | CSS processing |

---

## 18. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `ANTHROPIC_MODEL` | No | Claude model ID (default: `claude-sonnet-4-5-20250929`) |
| `OPENAI_API_KEY` | Yes | OpenAI API key (for Whisper) |
| `OPENAI_MODEL` | No | Whisper model (default: `whisper-1`) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No | VAPID public key for web push |

---

## 19. Known Limitations & Future Work

### Current Limitations

- **No pattern detection** — `patterns` table exists but not populated automatically
- **No session abandonment** — 24h stale sessions not auto-abandoned yet
- **Push notifications scaffolded** — subscription works, actual delivery requires VAPID keys
- **Email fallback placeholder** — edge function logs intent, no email provider integrated
- **No TTS** — text-only Sage responses (no voice output)
- **No domain correction** — edit pencil icon on domain cards dispatches prefill text but no re-processing
- **Placeholder app icons** — amber "M" circles, not final design

### Sprint 2 Candidates

- Daily nudges / micro check-ins
- Pattern detection across sessions
- Data visualizations (domain status over time)
- TTS for Sage responses
- Content intake (articles, podcasts → Sage context)
- Monthly and quarterly review session types
- Habit tracking tied to commitments
- Native app wrapper (Capacitor or React Native)
