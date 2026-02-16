---
title: "feat: Onboarding Flow Rework"
type: feat
date: 2026-02-16
source: Docs/feedback/20260216_Onboarding_flow_rework.md
---

# Onboarding Flow Rework

## Overview

Rework the onboarding flow from 4 screens to 6 screens. Add name collection, rework intent options, introduce a trust-building mini-conversation with quick replies, add domain descriptors to pulse check, add conditional Sage commentary to the radar chart, fix 406 errors caused by a missing DB column, and inject all onboarding context into the life mapping system prompt.

The guiding principle: the user should feel like they're having a warm, low-stakes conversation with Sage — not filling out a clinical intake form.

## Problem Statement

Playtest feedback identified 5 critical issues:

1. **Broken name display** — shows raw email prefix ("Tk4vu") because there's no `display_name` column
2. **Vague intent options** — current 4 options are variations of the same feeling, giving Sage no differentiated signal
3. **Trust gap before pulse check** — jumps from a single tap straight into rating 8 sensitive life domains with no relationship built
4. **Clinical pulse check framing** — reads like a therapy intake form, not a conversation
5. **406 errors on chat load** — `sessions.metadata` column doesn't exist, causing PostgREST 406 when chat view tries to read it

## Proposed Solution

### New Flow (6 Screens)

```
Screen 1: Sage intro + name collection
Screen 2: Reworked intent selection (5 situational options)
Screen 3: Mini-conversation (2-3 quick-reply exchanges, includes pulse check framing)
Screen 4: Pulse check (8 domains, same mechanic, domain descriptors added)
Screen 5: Radar chart + conditional Sage commentary
Screen 6: Chat (life mapping, with full onboarding context injected)
```

Note: The spec's "Screen 4: Pulse check intro" is absorbed into Screen 3's final exchange (Sage naturally frames the pulse check at the end of the mini-conversation). This keeps the flow feeling like one conversation rather than another discrete screen.

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Mini-conversation responses storage | `sessions.metadata` JSONB | Column needs to be created anyway for intent; keeps all onboarding context together |
| Name persistence timing | Save immediately on Screen 1 | Survives page refresh; non-blocking (advance even if write fails, retry at end) |
| State persistence across refresh | `sessionStorage` | Lightweight, no DB schema change, clears on tab close |
| Screen 4 (pulse intro) | Part of Screen 3's conversation | Keeps conversational feel, avoids another discrete screen |
| Radar commentary thresholds | stddev > 1.0 = high variance; mean >= 4.0 = mostly high; mean <= 2.0 = mostly low | Simple, deterministic, covers all distributions |
| Display name derivation | Shared utility with fallback chain | `display_name` -> Google OAuth `full_name` -> email prefix -> "there" |

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────────┐
│ OnboardingFlow (state machine)                      │
│                                                     │
│  step: 'intro' | 'intent' | 'conversation'         │
│        | 'domains' | 'summary'                      │
│                                                     │
│  State: name, intent, quickReplies, ratings,        │
│         domainIndex                                  │
│                                                     │
│  Persistence: sessionStorage (survives refresh)     │
│                                                     │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ SageIntro │→│IntentSelection│→│MiniConversation│ │
│  │ +name     │  │ (5 options)  │  │ (quick reply) │ │
│  └───────────┘  └──────────────┘  └──────────────┘ │
│        ↓                                            │
│  ┌───────────┐  ┌──────────────┐                   │
│  │ DomainCard│→│ SummaryScreen │→ router.push('/chat')
│  │ (8x pulse)│  │ +commentary  │                   │
│  └───────────┘  └──────────────┘                   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Database Changes                                    │
│                                                     │
│  users:    + display_name TEXT                       │
│  sessions: + metadata JSONB DEFAULT '{}'             │
│                                                     │
│  RLS: users can UPDATE own display_name             │
│       users can read own sessions.metadata          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ System Prompt Context Injection                     │
│                                                     │
│  buildConversationContext() now includes:            │
│  - User's display_name                              │
│  - Selected intent (intentional|new_start|stuck|    │
│    tough_time|exploring)                            │
│  - Quick reply selections from mini-conversation    │
│  - All 8 pulse check ratings (already exists)       │
└─────────────────────────────────────────────────────┘
```

### Implementation Phases

---

#### Phase 1: Database & Bug Fix (Foundation)

**Goal:** Fix the 406 error and create schema for new features. Everything else depends on this.

##### Task 1.1: Add migration for `display_name` and `metadata`

**File:** `supabase/migrations/004_onboarding_rework.sql` (or next sequential number)

```sql
-- Add display_name to users table
ALTER TABLE users ADD COLUMN display_name TEXT;

-- Add metadata JSONB to sessions table (fixes 406 error)
ALTER TABLE sessions ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;

-- RLS: users can update their own display_name
-- (existing policy on users table likely already covers this,
--  but verify SELECT and UPDATE policies include display_name)
```

- [ ] Create migration file
- [ ] Update TypeScript types in `types/database.ts` — add `display_name?: string | null` to `User`, add `metadata?: Record<string, unknown> | null` to `Session`
- [ ] Run `npx supabase db push`
- [ ] Run `npx supabase gen types` to regenerate types
- [ ] Verify RLS policies cover the new columns (SELECT + UPDATE for own rows)

##### Task 1.2: Create shared `getDisplayName()` utility

**File:** `lib/utils/display-name.ts`

```typescript
export function getDisplayName(user: {
  display_name?: string | null
  email?: string | null
}): string | null {
  if (user.display_name) return user.display_name

  // Fallback: derive from email prefix
  const email = user.email || ''
  const name = email.split('@')[0]?.split(/[._+-]/)[0] || null
  if (name) return name.charAt(0).toUpperCase() + name.slice(1)

  return null
}
```

- [ ] Create the utility
- [ ] Update `lib/supabase/home-data.ts` (line ~103) — replace email parsing with `getDisplayName()`, query `display_name` from users table
- [ ] Update `lib/supabase/session-state.ts` (line ~57-58) — replace email parsing with `getDisplayName()`, query `display_name`
- [ ] Update any other locations that derive name from email

##### Task 1.3: Fix 406 error in chat-view

**File:** `components/chat/chat-view.tsx`

The `metadata` column now exists after migration 1.1. Verify:

- [ ] The `.select('id, metadata')` query at line ~231 succeeds after migration
- [ ] The intent reading logic at lines ~233-241 works with the new column
- [ ] Chat loads without 406 errors after completing onboarding

---

#### Phase 2: Name Collection + Intent Rework (Quick Wins)

**Goal:** Small changes, big impact. Fix the greeting and improve intent signal.

##### Task 2.1: Add name input to Sage Intro screen

**File:** `components/onboarding/sage-intro.tsx`

Current screen shows heading + subtext + "Let's go" button. Add a text input between subtext and CTA.

```
Layout:
  Sage avatar (72px, centered)
  "Hey — I'm Sage."
  "I'm going to help you build a map of where you are in life right now."
  Text input: placeholder "What should I call you?"
  "Let's go" button (disabled until name >= 2 chars)
```

- [ ] Add `name` and `setName` state (or receive as props from parent)
- [ ] Add text input with conversational styling — no visible border, underline or subtle placeholder, `text-text` color, `bg-transparent`, `border-b border-border`
- [ ] If Google OAuth provides name, pre-fill from `user_metadata.full_name` or `user_metadata.name` (pass from parent)
- [ ] Validation: min 2 chars after trimming, max 50 chars
- [ ] Strip leading/trailing whitespace, capitalize first letter on submit
- [ ] "Let's go" button disabled until valid name entered
- [ ] `onContinue` callback passes the name string to parent
- [ ] Staggered fade-in animation for the input field (consistent with existing elements)

**Props change:**

```typescript
interface SageIntroProps {
  onContinue: (name: string) => void
  initialName?: string  // Pre-fill from OAuth or sessionStorage
}
```

##### Task 2.2: Save display name on Screen 1 completion

**File:** `components/onboarding/onboarding-flow.tsx`

- [ ] Add `name` state to `OnboardingFlow`
- [ ] On `SageIntro` completion, save name to `users.display_name` (non-blocking — `await` but don't block navigation on failure)
- [ ] Pass name to `SageIntro` as `initialName` (from `sessionStorage` or OAuth metadata)
- [ ] Fetch Google OAuth user metadata on mount to pre-fill name

##### Task 2.3: Rework intent selection options

**File:** `components/onboarding/intent-selection.tsx`

Replace `INTENTS` array (line ~11) with 5 new options:

```typescript
const INTENTS = [
  { label: 'Things are good — I want to be more intentional', value: 'intentional', icon: '🌱' },
  { label: "I'm starting something new", value: 'new_start', icon: '🚀' },
  { label: "I'm feeling stuck or scattered", value: 'stuck', icon: '🌀' },
  { label: "I'm going through a tough time", value: 'tough_time', icon: '🌊' },
  { label: 'Just exploring', value: 'exploring', icon: '✨' },
]
```

- [ ] Update the `INTENTS` array with 5 new options
- [ ] Update heading: "What's going on in your world right now?"
- [ ] Update subtext: "Pick whatever fits best — there's no wrong answer."
- [ ] Replace Lucide icons with emoji icons per spec (or keep Lucide if a better match exists — follow MeOS design skill guidance on emoji usage)
- [ ] Verify card layout handles the longer label text ("Things are good — I want to be more intentional" is long)
- [ ] Auto-advance behavior same as current (300ms delay after tap)

**Note on icons:** The MeOS design skill says "No emojis as design elements." Consider using Lucide icons that semantically match instead: `Sprout` for intentional, `Rocket` for new_start, `Orbit` for stuck, `Waves` for tough_time, `Sparkles` for exploring. Ask user during implementation.

---

#### Phase 3: Mini-Conversation Screen (Biggest New Piece)

**Goal:** Build the trust-building conversational exchange between intent and pulse check.

##### Task 3.1: Define conversation scripts for all 5 intents

Before building the component, all 5 scripts need to be defined. The spec provides 2; 3 need writing.

**Provided scripts:**

1. **intentional** — "Nice — sounds like you're in a good place..." → 4 quick replies
2. **stuck** — "I hear you — that scattered feeling is really common..." → 4 quick replies

**Scripts to write (following same pattern):**

3. **new_start** — Sage acknowledges the transition, asks what kind of new beginning

   > "Starting something new is exciting — and a little overwhelming. Quick question: is this something you chose, or something that happened to you?"

   Quick replies:
   - `I chose this — ready for what's next`
   - `It happened to me — still figuring it out`
   - `A bit of both honestly`
   - `I'd rather not say`

4. **tough_time** — Sage acknowledges difficulty with warmth, asks gently

   > "I appreciate you sharing that. No pressure to get into specifics right now. Quick question: is there one area of life that's weighing on you most, or does it feel like everything at once?"

   Quick replies:
   - `One thing is really weighing on me`
   - `It feels like everything at once`
   - `I'm not sure — it's hard to pin down`
   - `I'd rather just get started`

5. **exploring** — Sage keeps it light and fun

   > "Love that — no pressure, just curiosity. Quick question: what made you want to check this out?"

   Quick replies:
   - `Someone recommended it`
   - `Saw it online and was curious`
   - `I like the idea of a life map`
   - `Honestly, just killing time`

**Exchange 2 (all intents):** Same for all — Sage reflects back, frames the pulse check, asks "Sound good?"

- [ ] Write and finalize all 5 Exchange 1 scripts
- [ ] Define Exchange 2 (shared across all intents)
- [ ] Define the "What do you mean by gut rating?" follow-up
- [ ] Store scripts as a typed constant (not fetched from API)

##### Task 3.2: Build MiniConversation component

**New file:** `components/onboarding/mini-conversation.tsx`

This is a simplified chat-like interface within the onboarding flow. NOT the full chat view.

```
Layout:
  - Same warm bg as other onboarding screens (bg-bg)
  - No nav bar
  - Sage messages: left-aligned, bg-sage-message rounded-2xl, max-w-[80%]
  - User quick-reply selections: right-aligned, bg-primary text-white rounded-2xl
  - Quick reply buttons: pill-shaped, bg-bg border-border, horizontal layout
  - Typing indicator: 3 animated dots (500-800ms before message appears)
```

**State machine within the component:**

```typescript
type ConversationStep =
  | 'sage_exchange1'       // Sage's first message appearing (typing delay)
  | 'user_exchange1'       // Quick reply buttons visible, waiting for tap
  | 'sage_exchange2'       // Sage reflects + frames pulse check
  | 'user_exchange2'       // "Let's do it" / "What do you mean?"
  | 'sage_clarification'   // Optional: explains gut rating
  | 'user_final'           // "Got it — let's go"
  | 'complete'             // Advance to pulse check
```

**Props:**

```typescript
interface MiniConversationProps {
  intent: string           // From Screen 2
  userName: string         // From Screen 1
  onComplete: (quickReplies: QuickReplySelection[]) => void
  onBack: () => void       // Return to intent selection
  initialReplies?: QuickReplySelection[]  // From sessionStorage
}

interface QuickReplySelection {
  exchange: number         // 1, 2, or 3
  selectedOption: string   // The label text of the selected reply
}
```

- [ ] Create the component with conversation state machine
- [ ] Implement typing indicator (3 dots, 500-800ms delay)
- [ ] Implement Sage message bubble (left-aligned, staggered appearance)
- [ ] Implement user reply display (right-aligned, after quick reply tap)
- [ ] Implement quick reply buttons (pill-shaped, horizontal layout, 44px min height)
- [ ] Implement intent-based script selection
- [ ] Implement Exchange 2 with optional "gut rating" clarification branch
- [ ] Add `aria-live="polite"` region for Sage messages (accessibility)
- [ ] Respect `prefers-reduced-motion` — skip typing delays, show messages instantly
- [ ] Auto-advance to complete after final quick reply (400ms delay)
- [ ] Back button: returns to intent selection from Exchange 1 only

##### Task 3.3: Integrate MiniConversation into OnboardingFlow

**File:** `components/onboarding/onboarding-flow.tsx`

- [ ] Add `'conversation'` to `Step` union type
- [ ] Add `quickReplies: QuickReplySelection[]` state
- [ ] Insert `MiniConversation` between intent and domains in the flow
- [ ] Update `goForward`/`goBack` to handle the new step
- [ ] Pass intent and name to `MiniConversation`
- [ ] On complete, store quick replies in state and advance to domains

---

#### Phase 4: Pulse Check & Radar Enhancements

**Goal:** Add domain descriptors and conditional Sage commentary.

##### Task 4.1: Add domain descriptors to pulse check

**File:** `types/pulse-check.ts` + `components/onboarding/domain-card.tsx`

Add a `descriptor` field to `PULSE_DOMAINS`:

```typescript
export const PULSE_DOMAINS = [
  { label: 'Career / Work', key: 'career_work', descriptor: 'your job, projects, professional life' },
  { label: 'Relationships', key: 'relationships', descriptor: 'partner, family, friendships' },
  { label: 'Health / Body', key: 'health_body', descriptor: 'physical health, energy, fitness' },
  { label: 'Finances', key: 'finances', descriptor: 'money, security, financial goals' },
  { label: 'Learning / Growth', key: 'learning_growth', descriptor: 'skills, education, personal development' },
  { label: 'Creative Pursuits', key: 'creative_pursuits', descriptor: 'art, writing, creative expression' },
  { label: 'Play / Fun / Adventure', key: 'play_fun_adventure', descriptor: 'hobbies, travel, enjoyment' },
  { label: 'Meaning / Purpose', key: 'meaning_purpose', descriptor: 'values, spirituality, life direction' },
]
```

- [ ] Add `descriptor` to `PULSE_DOMAINS`
- [ ] Display descriptor below domain name in `domain-card.tsx` — `text-sm text-text-secondary italic`
- [ ] Add `aria-describedby` linking descriptor to the rating group

##### Task 4.2: Add conditional Sage commentary to radar chart

**File:** `components/onboarding/summary-screen.tsx`

Replace the static "I can see some patterns already. Ready to explore?" with conditional commentary.

```typescript
function getRadarCommentary(ratings: Record<number, number>): string {
  const values = Object.values(ratings)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  const stddev = Math.sqrt(variance)

  if (stddev > 1.0) {
    return "Interesting — some areas are really strong while others are pulling for attention. Let's explore that."
  }
  if (mean >= 3.5) {  // "mostly high" (ratings are 0-4, so 3.5+ means mostly Good/Thriving)
    return "You're doing well across the board — let's figure out where to focus your energy for the biggest impact."
  }
  if (mean <= 1.5) {  // "mostly low"
    return "It sounds like things have been tough lately. That's exactly why mapping it out helps — let's find where to start."
  }
  return "Looks like things are generally okay but there might be room to dig deeper. Let's find out what's underneath."
}
```

- [ ] Add `getRadarCommentary()` function (client-side, no LLM call)
- [ ] Replace static Sage message with dynamic commentary
- [ ] Handle edge cases: all same rating, empty ratings object

---

#### Phase 5: sessionStorage Persistence

**Goal:** Onboarding state survives page refresh.

##### Task 5.1: Add sessionStorage persistence to OnboardingFlow

**File:** `components/onboarding/onboarding-flow.tsx`

- [ ] On each state change, serialize `{ step, domainIndex, ratings, intent, name, quickReplies }` to `sessionStorage` under key `meos_onboarding_state`
- [ ] On mount, check for existing state in `sessionStorage` and restore
- [ ] Clear `sessionStorage` key on successful completion (after `handleStartConversation`)
- [ ] Handle `sessionStorage` unavailability gracefully (private browsing in some browsers)

---

#### Phase 6: System Prompt & Chat Context

**Goal:** Sage references all onboarding context in the opening life mapping message.

##### Task 6.1: Store onboarding context in session metadata

**File:** `components/onboarding/onboarding-flow.tsx`

Update `handleStartConversation()` to write complete onboarding context:

```typescript
await supabase
  .from('sessions')
  .update({
    metadata: {
      onboarding_intent: intent,
      onboarding_name: name,
      onboarding_quick_replies: quickReplies,
    }
  })
  .eq('id', session.id)
```

- [ ] Include intent, name, and quick replies in session metadata
- [ ] Verify the write succeeds (metadata column now exists from Phase 1)

##### Task 6.2: Inject onboarding context into system prompt

**Files:** `lib/ai/context.ts`, `components/chat/chat-view.tsx`, `app/api/chat/route.ts`

The system prompt for the life mapping conversation should include:

```
ONBOARDING CONTEXT:
- User's name: {display_name}
- What brought them here: {intent label, e.g., "feeling stuck or scattered"}
- Their response to my question: {quick reply text}
- Instructions: Reference this context naturally in your opening message.
  Greet them by name. Acknowledge what brought them here. Reference
  their pulse check shape. Don't robotically list things — weave it in.
```

- [ ] Read onboarding context from `sessions.metadata` in chat-view init
- [ ] Build an onboarding context string
- [ ] Pass it to the API route alongside the existing pulse check context
- [ ] Append to system prompt in `app/api/chat/route.ts`
- [ ] Update `getLifeMappingPrompt()` if needed to include placeholder/instructions for onboarding context

##### Task 6.3: Update display name usage in chat

- [ ] Ensure `session-state.ts` reads `display_name` from users table (not email prefix)
- [ ] Ensure chat-view uses `display_name` for the greeting and passes to system prompt
- [ ] Verify home screen greeting uses `display_name`

---

#### Phase 7: Resilience & Polish

**Goal:** Handle edge cases, partial failures, and accessibility.

##### Task 7.1: Refactor `handleStartConversation()` for resilience

**File:** `components/onboarding/onboarding-flow.tsx`

Currently, one failure in the waterfall can leave the system in an inconsistent state. Restructure:

1. Name was already saved in Phase 2 (Screen 1)
2. Create session
3. Save pulse ratings (if fails, delete session and show error)
4. Seed life map domains (if fails, log but continue — domains will be created during conversation)
5. Store metadata on session (if fails, log but continue — chat still works without it)
6. Mark onboarding complete (only if session + ratings succeeded)
7. Clear sessionStorage
8. Redirect to `/chat`

- [ ] Restructure `handleStartConversation()` with prioritized error handling
- [ ] Ensure `onboarding_completed` is only set to `true` if critical data (session + ratings) was saved
- [ ] Add specific error messages instead of generic "Something went wrong"
- [ ] Prevent duplicate session creation on retry (check for existing active session first)

##### Task 7.2: Accessibility pass

- [ ] Add `aria-live="polite"` to Sage message container in mini-conversation
- [ ] Add `aria-describedby` for domain descriptors in pulse check
- [ ] Ensure quick reply buttons are focusable, have clear `aria-label`
- [ ] Support `prefers-reduced-motion`: skip typing delays, reduce transition durations
- [ ] Test keyboard navigation through quick reply buttons

##### Task 7.3: Handle backward compatibility

- [ ] Existing users with `onboarding_completed: true` but no `display_name`: the `getDisplayName()` utility falls back to email prefix, then to `null`
- [ ] Home screen and chat view show "there" as fallback greeting (e.g., "Good morning, there")
- [ ] Old intent values (`scattered`, `transition`, `clarity`, `curious`) in existing session metadata: system prompt should handle gracefully (map to nearest new intent or use as-is)

---

## Acceptance Criteria

### Functional Requirements

- [ ] New user sees their actual name on home screen after onboarding (not email prefix)
- [ ] Name input pre-fills from Google OAuth metadata when available
- [ ] Intent selection offers 5 distinct situational options
- [ ] Mini-conversation shows 2-3 exchanges with Sage before pulse check
- [ ] Quick reply buttons feel tappable, responsive, and conversational
- [ ] Sage's messages appear with a typing delay (~500-800ms)
- [ ] Pulse check domains show brief descriptors
- [ ] Radar chart shows conditional commentary based on rating distribution
- [ ] Chat loads without 406 errors
- [ ] Sage's opening message references user's name, intent, and pulse check shape
- [ ] Entire onboarding takes under 3 minutes

### Non-Functional Requirements

- [ ] Onboarding state survives page refresh (sessionStorage)
- [ ] Typing delays respect `prefers-reduced-motion`
- [ ] Quick reply buttons have minimum 44px touch targets
- [ ] Screen reader users hear Sage messages via ARIA live regions
- [ ] No XSS via name input (React escapes by default, but sanitize on save)
- [ ] Display name capped at 50 characters

### Quality Gates

- [ ] TypeScript strict mode — no `any` types
- [ ] All new components follow MeOS design system tokens
- [ ] Existing onboarded users unaffected (backward compat verified)
- [ ] `npm run build` succeeds
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Dependencies & Prerequisites

| Dependency | Status | Impact |
|------------|--------|--------|
| Supabase migration (display_name + metadata) | Phase 1 | Blocks everything |
| Mini-conversation scripts for 3 remaining intents | Phase 3 | Blocks mini-conversation build |
| MeOS design skill tokens | Available | Reference for all UI work |
| framer-motion (already installed) | Available | Animations |

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Migration fails or breaks existing data | Low | High | Migration is additive (new columns only); no existing data modified |
| Mini-conversation feels slow/tedious | Medium | High | Keep to 2 exchanges max; respect reduced-motion; test with real users |
| sessionStorage unavailable (private browsing) | Low | Medium | Graceful fallback — restart from Screen 1 on refresh |
| Quick reply buttons overflow on small screens | Medium | Low | Horizontal scroll or wrap; test on 320px width |
| Existing users confused by new intent values | Low | Low | Old intents only exist in session metadata (which was broken before); no user-facing impact |

## Open Questions (To Resolve During Implementation)

1. **Emoji vs Lucide icons for intent options?** MeOS design skill says "no emojis as design elements" — likely use Lucide icons. Decide during Phase 2.
2. **Should analytics events be added?** Tracking drop-off per screen would be valuable. Defer to post-MVP if time-constrained.
3. **Should name input use underline style or subtle border?** Spec says "no visible border, just an underline" — test both during implementation.

## References & Research

### Internal References

- Onboarding flow: `components/onboarding/onboarding-flow.tsx`
- Sage intro: `components/onboarding/sage-intro.tsx`
- Intent selection: `components/onboarding/intent-selection.tsx`
- Domain card: `components/onboarding/domain-card.tsx`
- Rating scale: `components/onboarding/rating-scale.tsx`
- Summary screen: `components/onboarding/summary-screen.tsx`
- Radar chart: `components/onboarding/radar-chart.tsx`
- Pulse check logic: `lib/supabase/pulse-check.ts`
- Session state: `lib/supabase/session-state.ts`
- Home data: `lib/supabase/home-data.ts`
- Chat view: `components/chat/chat-view.tsx`
- Chat API: `app/api/chat/route.ts`
- System prompts: `lib/ai/prompts.ts`
- Context injection: `lib/ai/context.ts`
- DB types: `types/database.ts`
- Pulse check types: `types/pulse-check.ts`
- Initial schema: `supabase/migrations/001_initial_schema.sql`
- MeOS design system: `.claude/skills/meos-design/SKILL.md`

### Institutional Learnings Applied

- Deny-by-default permission checks (from `docs/solutions/security-issues/markdown-storage-security-review-fixes.md`)
- Keep animations under 500ms for perceived responsiveness (from `docs/solutions/performance-issues/breathing-orb-optimization.md`)
- Validate all AI-sourced values against allowlists (from security review)
- Complete RLS on all new columns (from security review)

### Source Spec

- `Docs/feedback/20260216_Onboarding_flow_rework.md`
