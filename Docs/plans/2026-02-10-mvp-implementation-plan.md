# MeOS MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the MeOS MVP — a voice-first AI life partner app with life mapping and weekly check-in conversations powered by Sage (Claude API).

**Architecture:** Next.js 14+ App Router with Supabase backend. Chat API route streams Claude responses via SSE. Frontend parses structured output blocks (`[DOMAIN_SUMMARY]`, `[LIFE_MAP_SYNTHESIS]`, `[SESSION_SUMMARY]`) from the stream and renders them as styled cards. Voice input via MediaRecorder API + Whisper transcription. Session state persists to a `messages` table with auto-save.

**Tech Stack:** Next.js 14+ (App Router), Tailwind CSS, TypeScript (strict), Supabase (Postgres + Auth + Realtime), Claude API (Anthropic SDK), Whisper API (OpenAI), Vercel

**Reference docs (read before implementing):**
- `CLAUDE.md` — conventions, guardrails, project structure
- `Docs/MVP_PRD.md` — product spec, data model, system prompts
- `Docs/UX_design.md` — design philosophy, screen specs
- `.claude/skills/meos-design/SKILL.md` — design tokens, component patterns
- `docs/plans/2026-02-10-mvp-gap-analysis-design.md` — architecture decisions

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`, `postcss.config.js`
- Create: `app/layout.tsx`, `app/globals.css`
- Create: `lib/utils.ts` (cn helper)
- Create: `.env.local.example`

**Step 1: Initialize Next.js project**

```bash
cd /Users/tomoyukikano/Desktop/Projects/Kairn
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm
```

If prompted about existing files, accept overwrite — only docs exist.

**Step 2: Install core dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk clsx tailwind-merge
npm install -D @types/node
```

**Step 3: Configure Tailwind with MeOS design tokens**

Update `tailwind.config.ts` to extend the theme with the MeOS color palette, spacing, radius, shadows, and typography from `.claude/skills/meos-design/SKILL.md`. Key values:

```typescript
// Colors
primary: '#D4A574',
'primary-hover': '#C4956A',
bg: '#FAF7F2',
'bg-sage': '#F5F0E8',
'bg-card': '#FFFFFF',
text: '#3D3832',
'text-secondary': '#8A7E74',
'accent-sage': '#7D8E7B',
'accent-terra': '#C17B5D',
'accent-navy': '#5B6B7A',
'status-thriving': '#7D8E7B',
'status-stable': '#D4A574',
'status-attention': '#C17B5D',
'status-crisis': '#B05A5A',
```

**Step 4: Create cn() utility**

Create `lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Step 5: Set up globals.css**

Configure `app/globals.css` with Tailwind directives. Import Satoshi font from Fontshare CDN. Set `body` background to `--color-bg` (#FAF7F2), text to `--color-text` (#3D3832).

**Step 6: Create .env.local.example**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

**Step 7: Update root layout**

`app/layout.tsx` — set metadata (title: "MeOS", description), apply Satoshi font, set viewport for mobile PWA.

**Step 8: Verify it runs**

```bash
npm run dev
```

Expected: Dev server starts at localhost:3000, shows the default page with warm cream background and Satoshi font.

**Step 9: Commit**

```bash
git init && git add -A && git commit -m "feat: initialize Next.js project with MeOS design tokens"
```

---

## Task 2: Supabase Setup + Database Schema

**Files:**
- Create: `lib/supabase/client.ts` (browser client)
- Create: `lib/supabase/server.ts` (server client)
- Create: `lib/supabase/middleware.ts` (auth middleware)
- Create: `middleware.ts` (Next.js middleware)
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `types/database.ts`

**Step 1: Initialize Supabase locally**

```bash
npx supabase init
```

**Step 2: Write the migration**

Create `supabase/migrations/001_initial_schema.sql` with all tables from the data model. Tables:

- `users` — `id uuid references auth.users(id)`, `email text`, `created_at timestamptz`, `onboarding_completed boolean default false`, `sage_persona_notes text`
- `life_maps` — `id uuid PK`, `user_id uuid FK→users`, `is_current boolean default true`, `narrative_summary text`, `primary_compounding_engine text`, `quarterly_priorities text[]`, `key_tensions text[]`, `anti_goals text[]`, `failure_modes text[]`, `identity_statements text[]`, `created_at timestamptz`, `updated_at timestamptz`
- `life_map_domains` — `id uuid PK`, `life_map_id uuid FK→life_maps`, `domain_name text NOT NULL`, `current_state text`, `whats_working text[]`, `whats_not_working text[]`, `desires text[]`, `tensions text[]`, `stated_intentions text[]`, `status text CHECK (status IN ('thriving','stable','needs_attention','in_crisis'))`, `updated_at timestamptz`
- `sessions` — `id uuid PK`, `user_id uuid FK→users`, `session_type text CHECK (session_type IN ('life_mapping','weekly_checkin','monthly_review','quarterly_review'))`, `status text CHECK (status IN ('active','completed','abandoned')) default 'active'`, `ai_summary text`, `sentiment text`, `key_themes text[]`, `commitments_made text[]`, `energy_level integer CHECK (energy_level BETWEEN 1 AND 5)`, `domains_explored text[]`, `created_at timestamptz`, `completed_at timestamptz`, `updated_at timestamptz`
- `messages` — `id uuid PK`, `session_id uuid FK→sessions`, `role text CHECK (role IN ('user','assistant'))`, `content text NOT NULL`, `has_structured_block boolean default false`, `created_at timestamptz default now()`
- `patterns` — `id uuid PK`, `user_id uuid FK→users`, `pattern_type text CHECK (pattern_type IN ('recurring_theme','sentiment_trend','consistency','avoidance'))`, `description text`, `first_detected timestamptz`, `occurrence_count integer default 1`, `related_domain text`, `is_active boolean default true`
- `push_subscriptions` — `id uuid PK`, `user_id uuid FK→users`, `endpoint text NOT NULL`, `keys jsonb NOT NULL`, `created_at timestamptz default now()`

Add RLS policies: each user can only read/write their own rows. Enable RLS on all tables.

Add `updated_at` trigger function that auto-updates timestamps.

**Step 3: Create Supabase browser client**

`lib/supabase/client.ts` — uses `createBrowserClient` from `@supabase/ssr`. Reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

**Step 4: Create Supabase server client**

`lib/supabase/server.ts` — uses `createServerClient` from `@supabase/ssr` with cookie handling for Next.js App Router (uses `cookies()` from `next/headers`).

**Step 5: Create auth middleware**

`lib/supabase/middleware.ts` — refreshes auth tokens on each request using `createServerClient` with request/response cookie handling.

`middleware.ts` — calls the Supabase middleware helper. Protects `/(main)/*` routes — redirects to `/login` if not authenticated. Allows `/(auth)/*` and `/api/*` through.

**Step 6: Create TypeScript types**

`types/database.ts` — manually define TypeScript interfaces matching the schema. These will later be replaced by `npx supabase gen types` but start with manual types for development before Supabase is connected.

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: add Supabase config, database schema, and auth middleware"
```

---

## Task 3: Authentication

**Files:**
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/auth/callback/route.ts`
- Create: `app/(auth)/layout.tsx`

**Step 1: Build login page**

`app/(auth)/login/page.tsx` — minimal landing page per UX spec. "Your AI life partner" headline + "Get Started" button. Warm cream background. Two auth options:

- "Continue with Google" button → calls `supabase.auth.signInWithOAuth({ provider: 'google' })` with redirect to `/auth/callback`
- "Continue with Email" → email input + magic link via `supabase.auth.signInWithOtp({ email })`

Style per design tokens: warm amber CTA button, Satoshi font, centered layout. Mobile-first.

**Step 2: Build auth callback route**

`app/(auth)/auth/callback/route.ts` — exchanges the auth code for a session using `supabase.auth.exchangeCodeForSession(code)`. Redirects to `/home` on success, `/login?error=true` on failure.

**Step 3: Build auth layout**

`app/(auth)/layout.tsx` — simple centered layout wrapper, cream background, no navigation.

**Step 4: Test login flow manually**

Configure Google OAuth in Supabase dashboard (or test with magic link only initially).

```bash
npm run dev
```

Navigate to `/login`, click magic link, verify redirect to `/home` (will be 404 for now — that's expected).

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add authentication with Google OAuth and magic link"
```

---

## Task 4: App Shell + Navigation

**Files:**
- Create: `app/(main)/layout.tsx`
- Create: `app/(main)/home/page.tsx` (placeholder)
- Create: `app/(main)/chat/page.tsx` (placeholder)
- Create: `app/(main)/life-map/page.tsx` (placeholder)
- Create: `app/(main)/history/page.tsx` (placeholder)
- Create: `components/ui/bottom-tab-bar.tsx`

**Step 1: Build bottom tab bar component**

`components/ui/bottom-tab-bar.tsx` — client component. 4 tabs: Home, Chat, Life Map, History. Uses `usePathname()` for active state. Active tab: `--color-primary` icon + label. Inactive: `--color-text-secondary`. Subtle top border, cream background. Icons can be simple SVG or use Lucide React.

Style per design skill: pill-shaped active indicator, 44px minimum touch targets.

**Step 2: Build main layout**

`app/(main)/layout.tsx` — server component. Fetches current user via Supabase server client. If no user, redirect to `/login`. Renders children + `<BottomTabBar />` fixed to bottom. Content area has `pb-20` to avoid tab bar overlap.

**Step 3: Build placeholder pages**

Each page shows a warm, non-empty state per UX spec:
- `/home` — "Hey there" + "Ready to map your life? Let's talk." button linking to `/chat`
- `/chat` — "Start a conversation with Sage" placeholder
- `/life-map` — "Your life map will appear here after your first conversation with Sage."
- `/history` — "Your conversation history will show up here."

All use cream background, Satoshi font, warm styling.

**Step 4: Verify navigation**

```bash
npm run dev
```

Log in, verify all 4 tabs render with correct active state. Verify protected route redirect.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add app shell with bottom tab navigation"
```

---

## Task 5: TypeScript Types + Shared Constants

**Files:**
- Create: `types/chat.ts`
- Create: `lib/constants.ts`

**Step 1: Define chat types**

`types/chat.ts`:

```typescript
export type MessageRole = 'user' | 'assistant'

export type SessionType = 'life_mapping' | 'weekly_checkin'

export type SessionStatus = 'active' | 'completed' | 'abandoned'

export type DomainStatus = 'thriving' | 'stable' | 'needs_attention' | 'in_crisis'

export type DomainName =
  | 'Career / Work'
  | 'Relationships'
  | 'Health / Body'
  | 'Finances'
  | 'Learning / Growth'
  | 'Creative Pursuits'
  | 'Play / Fun / Adventure'
  | 'Meaning / Purpose'

export interface ChatMessage {
  id: string
  sessionId: string
  role: MessageRole
  content: string
  hasStructuredBlock: boolean
  createdAt: string
}

export interface DomainSummary {
  domain: DomainName
  currentState: string
  whatsWorking: string[]
  whatsNotWorking: string[]
  keyTension: string
  statedIntention: string
  status: DomainStatus
}

export interface LifeMapSynthesis {
  narrative: string
  primaryCompoundingEngine: string
  quarterlyPriorities: string[]
  keyTensions: string[]
  antiGoals: string[]
}

export interface SessionSummary {
  date: string
  sentiment: string
  energyLevel: number | null
  keyThemes: string[]
  commitments: string[]
  lifeMapUpdates: string
  patternsObserved: string
}

export type StructuredBlock =
  | { type: 'domain_summary'; data: DomainSummary }
  | { type: 'life_map_synthesis'; data: LifeMapSynthesis }
  | { type: 'session_summary'; data: SessionSummary }

export interface ParsedMessage {
  textBefore: string
  block: StructuredBlock | null
  textAfter: string
}
```

**Step 2: Define constants**

`lib/constants.ts`:

```typescript
export const ALL_DOMAINS: DomainName[] = [
  'Career / Work',
  'Relationships',
  'Health / Body',
  'Finances',
  'Learning / Growth',
  'Creative Pursuits',
  'Play / Fun / Adventure',
  'Meaning / Purpose',
]

export const SESSION_STALE_HOURS = 24
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add TypeScript types and shared constants"
```

---

## Task 6: Structured Output Parser

**Files:**
- Create: `lib/ai/parser.ts`
- Create: `lib/ai/parser.test.ts`

**Step 1: Write failing tests for the parser**

`lib/ai/parser.test.ts` — install vitest first: `npm install -D vitest`. Test cases:

1. Plain text message with no structured blocks → returns text only, block is null
2. Message with `[DOMAIN_SUMMARY]...[/DOMAIN_SUMMARY]` → parses domain fields correctly
3. Message with text before and after a domain summary block → splits correctly
4. Message with `[LIFE_MAP_SYNTHESIS]...[/LIFE_MAP_SYNTHESIS]` → parses synthesis fields
5. Message with `[SESSION_SUMMARY]...[/SESSION_SUMMARY]` → parses session summary fields
6. Malformed block (no closing tag) → returns full text as plain text, no crash
7. Malformed block (missing fields) → parses what it can, uses empty defaults

**Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/ai/parser.test.ts
```

Expected: all tests fail (parser doesn't exist yet).

**Step 3: Implement the parser**

`lib/ai/parser.ts` — export `parseMessage(content: string): ParsedMessage`

Logic:
1. Use regex to find `[DOMAIN_SUMMARY]`, `[LIFE_MAP_SYNTHESIS]`, or `[SESSION_SUMMARY]` opening tags
2. Find the corresponding closing tag
3. If found: split into textBefore, block content, textAfter. Parse the block content by splitting on `Key: value` lines.
4. If no block found or malformed: return entire content as text, block null

Also export `parseStreamingChunk(accumulated: string): { displayText: string; pendingBlock: boolean; completedBlock: StructuredBlock | null }` for use during streaming:
- If no opening tag seen: `displayText` is the full accumulated text, `pendingBlock` false
- If opening tag seen but no closing tag: `displayText` is text before the opening tag, `pendingBlock` true
- If both tags seen: `displayText` is text before, `completedBlock` has the parsed block

**Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/ai/parser.test.ts
```

Expected: all pass.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add structured output parser with streaming support"
```

---

## Task 7: Claude API Streaming Route

**Files:**
- Create: `lib/ai/prompts.ts`
- Create: `lib/ai/context.ts`
- Create: `app/api/chat/route.ts`

**Step 1: Create system prompts module**

`lib/ai/prompts.ts` — export two functions:

- `getLifeMappingPrompt(): string` — returns the full life mapping system prompt from MVP_PRD.md (the one under "System Prompt: Sage (Life Mapping Session)")
- `getWeeklyCheckinPrompt(lifeMap: LifeMap, sessionSummaries: string[], patterns: Pattern[], lastCommitment: string): string` — returns the weekly check-in system prompt with injected context

**Step 2: Create context builder**

`lib/ai/context.ts` — export `buildConversationContext(sessionType, userId)`:

- Queries Supabase for the user's current life map, last 3-5 session summaries, active patterns, and last stated commitment
- Formats them into a string that gets appended to the system prompt
- For life mapping sessions: minimal context (just user profile notes if any)
- For weekly check-ins: full context injection

**Step 3: Build the streaming API route**

`app/api/chat/route.ts` — POST handler:

1. Validate auth: extract user from Supabase session (via cookies). Return 401 if not authenticated.
2. Parse request body: `{ sessionId: string, sessionType: SessionType, messages: { role, content }[] }`
3. Build system prompt using `getLifeMappingPrompt()` or `getWeeklyCheckinPrompt()` based on session type. Inject context from `buildConversationContext()`.
4. Call Claude API with streaming enabled:

```typescript
const stream = await anthropic.messages.stream({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1024,
  system: systemPrompt,
  messages: messages,
})
```

5. Return a `ReadableStream` response with `Content-Type: text/event-stream`. Each chunk sends `data: {"text": "token"}\n\n`. On stream end, send `data: [DONE]\n\n`.

6. Error handling: if Claude API fails, return `data: {"error": "message"}\n\n` and close the stream.

**Step 4: Test manually with curl**

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test","sessionType":"life_mapping","messages":[{"role":"user","content":"Hi"}]}'
```

Expected: streaming text response from Sage.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add Claude API streaming chat route with system prompts"
```

---

## Task 8: Chat UI — Core Conversation View

**Files:**
- Create: `components/chat/chat-view.tsx`
- Create: `components/chat/message-bubble.tsx`
- Create: `components/chat/chat-input.tsx`
- Create: `components/chat/typing-indicator.tsx`
- Modify: `app/(main)/chat/page.tsx`

**Step 1: Build message bubble component**

`components/chat/message-bubble.tsx` — client component. Props: `message: ChatMessage`, `parsedContent: ParsedMessage`.

- User messages: right-aligned, cream bg with subtle border, rounded-lg, max-width 85%
- Sage messages: left-aligned, `--color-bg-sage`, 3px left border `--color-accent-sage`, rounded-lg
- If `parsedContent.block` exists, render the structured card component (Task 9) instead of plain text for that portion
- Render `textBefore` and `textAfter` as plain text around the block

**Step 2: Build typing indicator**

`components/chat/typing-indicator.tsx` — three dots animation in Sage's message style. Shows when waiting for first streaming token.

**Step 3: Build chat input component**

`components/chat/chat-input.tsx` — client component. Text input field (secondary, per design spec). Submit on Enter. Props: `onSend: (text: string) => void`, `disabled: boolean`, `prefill?: string` (for domain card corrections).

Text field styled per design: warm border, rounded-lg, 44px height minimum. Send button with `--color-primary`.

Voice button placeholder — just the visual button for now (64px amber circle with pulse animation per design skill). On tap, show a toast "Voice coming soon" until Task 11.

**Step 4: Build chat view (main orchestrator)**

`components/chat/chat-view.tsx` — client component. This is the core of the app. State:

- `messages: ChatMessage[]`
- `streamingText: string` (current streaming response)
- `isStreaming: boolean`
- `error: string | null`

On mount: check for active session in Supabase. If found, load messages and resume. If not, create new session and display Sage's opening message.

On user send:
1. Add user message to `messages` state
2. Save user message to Supabase `messages` table
3. Fetch `/api/chat` with all messages
4. Stream response: read SSE chunks, accumulate into `streamingText`, use `parseStreamingChunk()` to decide what to display
5. On stream complete: finalize the assistant message, save to Supabase `messages` table, clear streaming state
6. On error: show retry button (per gap analysis design)

Auto-scroll to bottom on new messages. Use `useRef` for scroll container.

**Step 5: Wire up the chat page**

`app/(main)/chat/page.tsx` — renders `<ChatView />` full-height (minus tab bar).

**Step 6: Test conversation flow manually**

```bash
npm run dev
```

Log in, navigate to Chat, send a text message. Verify streaming response appears token by token. Verify messages persist on page reload.

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: add chat UI with streaming responses and message persistence"
```

---

## Task 9: Domain Cards + Synthesis Cards

**Files:**
- Create: `components/chat/domain-card.tsx`
- Create: `components/chat/synthesis-card.tsx`
- Create: `components/chat/building-card-placeholder.tsx`
- Modify: `components/chat/message-bubble.tsx` (integrate cards)
- Modify: `components/chat/chat-view.tsx` (domain tracking + quick-reply)

**Step 1: Build the "building card" placeholder**

`components/chat/building-card-placeholder.tsx` — shows while a structured block is streaming but not yet complete. Subtle pulsing card outline with "Building your map..." text. Warm amber accent.

**Step 2: Build domain card component**

`components/chat/domain-card.tsx` — Props: `domain: DomainSummary`, `onCorrect: (domain: DomainName) => void`.

Per design skill:
- Full-width, white bg (`--color-bg-card`), `--shadow-md`, rounded-lg
- Status dot (8px circle) top-right with domain status color
- Structured fields: "Current state", "What's working", "What's not working", "Key tension", "Stated intention" — secondary color labels, primary color values
- Edit icon (pencil) top-right — on tap, calls `onCorrect(domain.domain)` which pre-fills the chat input with "About my {domain} card — "
- Fade-up animation on entry (translateY 8px → 0, 200ms)

**Step 3: Build synthesis card component**

`components/chat/synthesis-card.tsx` — Props: `synthesis: LifeMapSynthesis`.

Larger, more prominent card. Sections:
- Narrative summary (paragraphs)
- Primary compounding engine (highlighted)
- Top 3 quarterly priorities (numbered list)
- Key tensions (bullet list)
- Anti-goals (bullet list)

Warm styling, elevated shadow, `--color-primary` accent borders.

**Step 4: Add quick-reply buttons**

Modify `components/chat/chat-view.tsx`:
- Track `domainsExplored: Set<DomainName>` in state
- When a domain card is parsed from stream, add the domain to the set and update `sessions.domains_explored` in Supabase
- After the most recent domain card message, render quick-reply pill buttons for remaining domains + "Wrap up"
- Tapping a domain button calls `onSend("Let's explore {domain}")`
- Tapping "Wrap up" sends a system message to trigger synthesis

Style per design skill: pill-shaped, cream bg with border, horizontal scroll if overflow.

**Step 5: Integrate cards into message bubble**

Modify `components/chat/message-bubble.tsx`:
- If `parsedContent.block?.type === 'domain_summary'`, render `<DomainCard>` inline
- If `parsedContent.block?.type === 'life_map_synthesis'`, render `<SynthesisCard>` inline
- If `parsedContent.block?.type === 'session_summary'`, don't render a card — this is for backend processing only

**Step 6: Test life mapping flow end-to-end**

Start a conversation, talk through a domain with Sage, verify the domain card renders inline when Sage outputs `[DOMAIN_SUMMARY]`. Verify quick-reply buttons appear. Verify tapping a quick-reply sends the message. Verify "Wrap up" triggers synthesis and the synthesis card renders.

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: add domain cards, synthesis cards, and quick-reply buttons"
```

---

## Task 10: Session Lifecycle + Life Map Persistence

**Files:**
- Create: `lib/supabase/sessions.ts`
- Create: `lib/supabase/life-map.ts`
- Modify: `components/chat/chat-view.tsx` (lifecycle integration)

**Step 1: Create session database helpers**

`lib/supabase/sessions.ts` — exports:

- `getActiveSession(userId, sessionType)` — finds active session, returns with messages
- `createSession(userId, sessionType)` — creates new session row, returns it
- `saveMessage(sessionId, role, content, hasStructuredBlock)` — inserts into messages table
- `completeSession(sessionId)` — sets status to 'completed', completed_at to now()
- `updateDomainsExplored(sessionId, domains)` — updates the domains_explored array
- `updateSessionSummary(sessionId, summary, themes, commitments, sentiment, energyLevel)` — writes parsed session summary fields

**Step 2: Create life map database helpers**

`lib/supabase/life-map.ts` — exports:

- `getCurrentLifeMap(userId)` — fetches current life map with all domains
- `getOrCreateLifeMap(userId)` — returns current life map or creates empty one
- `upsertDomain(lifeMapId, domain: DomainSummary)` — inserts or updates a domain row
- `updateLifeMapSynthesis(lifeMapId, synthesis: LifeMapSynthesis)` — writes narrative, priorities, tensions, anti-goals

**Step 3: Integrate session lifecycle into chat view**

Modify `components/chat/chat-view.tsx`:

On mount:
1. Call `getActiveSession()` — if found, load messages, restore `domainsExplored`, continue
2. If not found, call `createSession()` — inject Sage's opening message as first assistant message

On domain card parsed:
1. Call `upsertDomain()` to write/update the domain in the life map
2. Call `updateDomainsExplored()` to persist explored domains on the session

On synthesis card parsed:
1. Call `updateLifeMapSynthesis()` to write the synthesis
2. Call `completeSession()` to mark session done

On session summary parsed (weekly check-in):
1. Call `updateSessionSummary()` with parsed fields
2. Call `completeSession()`
3. Update relevant life map domains if mentioned

**Step 4: Test session recovery**

Start a life mapping session, explore 1 domain, close the browser tab. Reopen — verify the conversation resumes where you left off with the domain card visible.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add session lifecycle, life map persistence, and session recovery"
```

---

## Task 11: Voice Input

**Files:**
- Create: `lib/voice/recorder.ts`
- Create: `app/api/transcribe/route.ts`
- Modify: `components/chat/chat-input.tsx` (integrate real voice)

**Step 1: Build voice recorder hook**

`lib/voice/recorder.ts` — export `useVoiceRecorder()` custom hook:

- `startRecording()` — requests mic permission, creates MediaRecorder with `audio/webm` mime type, starts recording
- `stopRecording()` — stops MediaRecorder, returns audio Blob
- `isRecording: boolean`
- `duration: number` (elapsed seconds, updated every second)
- `error: string | null` — mic permission denied, browser not supported, etc.

Check `navigator.mediaDevices.getUserMedia` support. If not available, set error and don't show voice button.

**Step 2: Build transcription API route**

`app/api/transcribe/route.ts` — POST handler:

1. Validate auth (same pattern as chat route)
2. Accept `FormData` with audio file
3. Forward to OpenAI Whisper API:

```typescript
const transcription = await openai.audio.transcriptions.create({
  file: audioFile,
  model: 'whisper-1',
})
```

4. Return `{ text: transcription.text }`

**Step 3: Integrate voice into chat input**

Modify `components/chat/chat-input.tsx`:

- Replace voice placeholder with real functionality
- Voice button states per design skill:
  - Idle: 64px amber circle, subtle pulse animation
  - Recording: grows to 72px, deeper amber, ripple animation, shows elapsed time
  - Processing: gentle spinner, "Processing..." label
- On tap (idle → recording): call `startRecording()`
- On tap (recording → processing): call `stopRecording()`, send blob to `/api/transcribe`, show processing state
- On transcription complete: populate the text input with transcript, auto-send (or let user review — try auto-send for MVP, it's more natural for voice-first)

**Step 4: Test voice flow**

Record a voice message in the app. Verify transcription appears. Verify it sends to Sage and gets a streaming response.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add voice recording and Whisper transcription"
```

---

## Task 12: Weekly Check-In Flow

**Files:**
- Modify: `lib/ai/context.ts` (context injection)
- Modify: `components/chat/chat-view.tsx` (check-in mode)
- Modify: `app/(main)/chat/page.tsx` (accept session type param)

**Step 1: Implement context injection for check-ins**

Modify `lib/ai/context.ts` — `buildConversationContext()` for weekly check-ins:

1. Query current life map (all domains + synthesis)
2. Query last 3-5 completed sessions, get their `ai_summary` fields
3. Query active patterns for this user
4. Query last session's `commitments_made` for the "last stated commitment"
5. Format all of this into a structured string appended to the system prompt

**Step 2: Support session type in chat page**

Modify `app/(main)/chat/page.tsx` to accept a `?type=weekly_checkin` search param. Pass it to `<ChatView sessionType={type} />`.

Modify `components/chat/chat-view.tsx`:
- Accept `sessionType` prop (default: `'life_mapping'`)
- Use it when creating sessions and selecting system prompts
- For check-ins: no quick-reply domain buttons, no domain cards expected (though parser handles them if Sage outputs one)
- For check-ins: parse `[SESSION_SUMMARY]` block to extract summary data and complete the session

**Step 3: Test check-in flow**

Complete a life mapping session first (need data). Then navigate to `/chat?type=weekly_checkin`. Verify Sage references the life map and previous sessions. Verify session completes when summary is generated.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add weekly check-in flow with context injection"
```

---

## Task 13: Home Screen

**Files:**
- Modify: `app/(main)/home/page.tsx`
- Create: `lib/supabase/home-data.ts`

**Step 1: Create home data fetcher**

`lib/supabase/home-data.ts` — server-side function that queries:

- Last completed check-in session → calculate next check-in date (7 days after)
- Current life map → extract quarterly priorities (top 3)
- Whether onboarding (life mapping) is complete
- User's first name (from email or profile) for greeting

**Step 2: Build home page**

`app/(main)/home/page.tsx` — server component. Fetches data from `getHomeData()`.

Layout per UX spec:
- Greeting: "Good morning" / "Good afternoon" / "Good evening" (time-based)
- If onboarding not complete: prominent "Map your life" CTA → links to `/chat`
- If onboarding complete:
  - Next check-in: "Check in due [date]" with "Start now" button → links to `/chat?type=weekly_checkin`
  - Current priorities: top 3, displayed simply as a list
  - "Talk to Sage" quick-start button → links to `/chat`

Warm, minimal. No clutter, no metrics walls.

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: build home screen with check-in scheduling and priorities"
```

---

## Task 14: Life Map View

**Files:**
- Modify: `app/(main)/life-map/page.tsx`
- Create: `components/life-map/domain-grid.tsx`
- Create: `components/life-map/synthesis-section.tsx`
- Create: `components/life-map/domain-detail-card.tsx`

**Step 1: Build synthesis section**

`components/life-map/synthesis-section.tsx` — displays the cross-cutting insights at the top of the life map view:

- Narrative summary
- Primary compounding engine (highlighted)
- Quarterly priorities
- Key tensions
- Anti-goals

Warm card styling, generous padding.

**Step 2: Build domain detail card**

`components/life-map/domain-detail-card.tsx` — expandable/collapsible card for each domain:

- Collapsed: domain name, status dot (color per status), current state summary (1 line), stated intention (1 line)
- Expanded: full detail — what's working, what's not working, desires, tensions, stated intentions
- Last updated timestamp
- Tap to expand/collapse

**Step 3: Build domain grid**

`components/life-map/domain-grid.tsx` — renders all explored domains as a vertical list of `DomainDetailCard` components. Domains not yet explored show a muted "Not yet explored" state.

**Step 4: Build life map page**

`app/(main)/life-map/page.tsx` — server component. Fetches current life map with all domains from Supabase.

- If no life map exists: warm empty state — "Your life map will appear here after your first conversation with Sage." + CTA to start.
- If life map exists: `<SynthesisSection />` at top, `<DomainGrid />` below

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: build life map view with domain grid and synthesis display"
```

---

## Task 15: History View

**Files:**
- Modify: `app/(main)/history/page.tsx`
- Create: `components/history/session-list.tsx`
- Create: `components/history/session-card.tsx`
- Create: `app/(main)/history/[sessionId]/page.tsx`

**Step 1: Build session card**

`components/history/session-card.tsx` — displays one session:

- Date (formatted nicely)
- Session type badge ("Life Mapping" or "Weekly Check-In")
- AI summary snippet (first 2 lines, truncated)
- Key themes as small pill tags
- Status indicator (completed vs abandoned)
- Links to `/history/[sessionId]` for full view

**Step 2: Build session list**

`components/history/session-list.tsx` — reverse chronological list of `SessionCard` components. Query completed and abandoned sessions from Supabase.

**Step 3: Build history page**

`app/(main)/history/page.tsx` — server component. Fetches sessions.

- If no sessions: "Your conversation history will show up here. Start by talking to Sage." + CTA
- If sessions exist: renders `<SessionList />`

**Step 4: Build session detail page**

`app/(main)/history/[sessionId]/page.tsx` — shows full conversation for a past session. Fetches messages for the session, renders them using the same `MessageBubble` component from chat (including domain cards). Read-only view — no input bar.

Back button to return to history list.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: build history view with session list and detail pages"
```

---

## Task 16: Error Handling + Retry

**Files:**
- Create: `components/chat/error-message.tsx`
- Modify: `components/chat/chat-view.tsx` (retry logic)

**Step 1: Build error message component**

`components/chat/error-message.tsx` — renders in place of an assistant message when the API call fails:

- "Sage couldn't respond. Tap to retry." with a retry button
- After 3 failed retries: "Sage is having trouble right now. Your conversation is saved — come back and pick up where you left off."
- Warm styling — muted terracotta text, subtle border. Not alarming.

**Step 2: Add retry logic to chat view**

Modify `components/chat/chat-view.tsx`:

- Track `retryCount` per failed message
- On API error: show `<ErrorMessage>` instead of streaming text
- On retry tap: re-send the same API request, increment retry count
- On success after retry: replace error with the streamed response
- After 3 retries: show the "come back later" message, stop showing retry button

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add error handling with retry mechanism"
```

---

## Task 17: PWA Setup

**Files:**
- Create: `public/manifest.json`
- Create: `public/sw.js` (service worker)
- Modify: `app/layout.tsx` (manifest link)
- Create: `public/icons/` (app icons)

**Step 1: Create PWA manifest**

`public/manifest.json`:

```json
{
  "name": "MeOS",
  "short_name": "MeOS",
  "description": "Your AI life partner",
  "start_url": "/home",
  "display": "standalone",
  "background_color": "#FAF7F2",
  "theme_color": "#D4A574",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Step 2: Create service worker**

`public/sw.js` — basic service worker that:

- Caches static assets (JS, CSS, fonts, icons) using cache-first strategy
- Does NOT cache API routes (`/api/*`) or Supabase connections
- Handles push notification events (listen for `push` event, show notification)
- Handles notification click (open `/chat?type=weekly_checkin`)

**Step 3: Register service worker**

Add service worker registration in `app/layout.tsx` via a client component script. Register only in production or when explicitly enabled.

**Step 4: Create placeholder icons**

Generate simple amber-colored app icons at 192x192 and 512x512. Can be a simple circle with "M" text for MVP.

**Step 5: Link manifest in layout**

Add `<link rel="manifest" href="/manifest.json" />` and PWA meta tags (theme-color, apple-mobile-web-app-capable) to `app/layout.tsx`.

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add PWA manifest and service worker"
```

---

## Task 18: Push Notifications + Email Fallback

**Files:**
- Create: `lib/notifications/push.ts`
- Create: `app/api/push/subscribe/route.ts`
- Create: `supabase/functions/check-in-reminder/index.ts`
- Modify: `components/chat/chat-view.tsx` (request permission after onboarding)

**Step 1: Build push subscription API route**

`app/api/push/subscribe/route.ts` — POST handler:

1. Validate auth
2. Accept push subscription object (endpoint, keys)
3. Upsert into `push_subscriptions` table

**Step 2: Build client-side push helper**

`lib/notifications/push.ts` — exports:

- `requestPushPermission()` — requests notification permission, subscribes to push via service worker, sends subscription to `/api/push/subscribe`
- `isPushSupported()` — checks if Push API is available

**Step 3: Request permission after first life mapping**

Modify `components/chat/chat-view.tsx` — after a life mapping session completes (synthesis detected), prompt for push permission: "Want me to remind you when it's time to check in?" with Allow/Skip buttons. If allowed, call `requestPushPermission()`.

**Step 4: Build check-in reminder function**

`supabase/functions/check-in-reminder/index.ts` — Supabase Edge Function (or Vercel cron):

1. Query users whose last completed check-in is 7+ days ago
2. For each user: check if they have a push subscription → send web push notification
3. If no push subscription → send reminder email via Resend or Supabase email
4. Notification text: "Hey, it's been a week. Ready for a quick check-in with Sage?"

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add push notifications and email fallback for check-in reminders"
```

---

## Task 19: Final Polish + Deploy

**Files:**
- Modify: various components for responsive polish
- Create: `vercel.json` (if needed)

**Step 1: Mobile responsive audit**

Check every screen at 375px (iPhone SE), 390px (iPhone 14), and 768px (tablet) widths:

- Voice button centered and prominent
- Chat bubbles max-width 85%
- Domain cards full-width with padding
- Tab bar fixed to bottom with safe area padding
- All touch targets minimum 44px

**Step 2: Loading states**

Ensure every async operation has a loading state:
- Chat: typing indicator while waiting for first token
- Voice: processing state during transcription
- Pages: skeleton or fade-in while data loads
- Auth: loading spinner during OAuth redirect

**Step 3: Empty state review**

Verify every screen has a warm, non-empty state per UX spec. No blank screens anywhere.

**Step 4: Build and type-check**

```bash
npm run build && npm run type-check && npm run lint
```

Fix any errors.

**Step 5: Deploy to Vercel**

```bash
npx vercel --prod
```

Configure environment variables in Vercel dashboard (Supabase URL, keys, Anthropic API key, OpenAI API key).

**Step 6: Verify production**

Test the full flow on a mobile device:
1. Visit the URL → landing page
2. Sign in → redirected to home
3. Start life mapping → voice works, streaming works, domain cards render
4. Complete 2-3 domains → quick-reply buttons work
5. Wrap up → synthesis card renders, life map populated
6. View life map → all domains displayed
7. View history → session listed with summary
8. Start weekly check-in → Sage references life map

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: final polish and production deployment"
```
