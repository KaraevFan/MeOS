---
title: "feat: Playtest R2 — Onboarding Redesign & Polish"
type: feat
date: 2026-02-15
source: Docs/feedback/20260215_Playtest_feedback_onboarding.md
supersedes: null
---

# feat: Playtest R2 — Onboarding Redesign & Polish

## Overview

Second playtest of MeOS MVP revealed 10 issues: 1 major onboarding redesign, 4 bugs, 3 UX improvements, and 2 prompt tuning items. This plan addresses all 10 in priority order, grouped into 5 implementation phases to minimize context-switching.

**Source spec:** `Docs/feedback/20260215_Playtest_feedback_onboarding.md`
**Inspiration code:** `inspiration/onboarding_pulse_check_experience.zip`
**Prior plan overlap:** `docs/plans/2026-02-13-feat-post-playtest-fixes-r1-plan.md` (R1 fixes — pulse check data model, parser, prompts already implemented)

---

## Key Architecture Decisions

These resolve ambiguities identified during spec analysis:

### 1. Onboarding flow routing

The new 4-screen onboarding flow lives at **`/onboarding`** as a separate route under `/(auth)` or a new `/(onboarding)` route group. Reasons:

- Keeps `ChatView` clean — no conditional rendering for onboarding vs. conversation
- Session creation is deferred until onboarding completes and user taps "Start Conversation"
- Clean navigation: `/onboarding` -> completion -> redirect to `/chat`
- If user navigates away and returns without completing, `detectSessionState()` still returns `new_user` (since `onboarding_completed` is still false), and the home page routes them back to `/onboarding` instead of `/chat`

The `PreOnboardingHero` on the home page will link to `/onboarding` instead of `/chat` for `new_user` state.

### 2. Intent selection storage

Store intent as a column on the `sessions` table: `onboarding_intent TEXT`. This way it survives page refresh, is available when building the system prompt, and is naturally scoped to the session. The chat API route reads it from the session and injects it into `pulseContext`.

Alternatively, include it in the `pulseContext` metadata string already sent to the API — simpler, no migration. **Recommended: include in `pulseContext` string + store in session metadata for persistence.**

### 3. Pulse rating scale labels

Keep the internal 5-point scale unchanged (`thriving | good | okay | struggling | in_crisis`). The onboarding UI relabels `in_crisis` as "Rough" for approachability — mapping is UI-only:

| UI Label | Internal Value | Domain Status Mapping |
|---|---|---|
| Rough | `in_crisis` | `in_crisis` |
| Struggling | `struggling` | `needs_attention` |
| Okay | `okay` | `stable` |
| Good | `good` | `stable` |
| Thriving | `thriving` | `thriving` |

No breaking changes to types, mappings, or existing data.

### 4. Status label resolution (Item 6)

**Sage-assigned status wins when available.** For explored domains, show only the Sage-assessed `status` label in the top-right. For unexplored domains, show the pulse-derived status. Never show both simultaneously. The initial pulse rating is retained in the DB for baseline tracking but hidden from the domain card UI after Sage explores the domain.

### 5. file_update domain card rendering (Item 3)

Create a **new `MarkdownDomainCard` component** that renders `FileUpdateData.content` (raw markdown) in a card layout. It parses known headings (`## Current State`, `## What's Working`, `## Key Tension`, `## Stated Intention`) from the markdown body into sections. This avoids the fragility of converting markdown back into `DomainSummary` objects.

`SegmentRenderer` dispatches `file_update` blocks with `fileType === 'domain'` to `MarkdownDomainCard`.

### 6. Pulse check completion trigger (Item 5)

Remove the visible `"I completed the pulse check."` message. Instead, after saving ratings, call the chat API with a system-level injection: append the pulse context to the system prompt for Sage's first response, and trigger Sage's response without a user message in the chat bubble. The `messages` array sent to Claude will include a `user` role message with the pulse data so Claude knows to respond, but it will NOT be saved to the `messages` table or displayed in the UI.

### 7. Partial onboarding progress

**Do not persist partial progress.** The 4-screen flow takes <60 seconds. If the user leaves mid-flow, they restart from Screen 1. Ratings are held in React state only. This avoids DB writes for incomplete onboarding and keeps the implementation simple.

### 8. Radar chart implementation

**Custom SVG** — no charting library needed. The inspiration code already has a working `RadarChart` component using raw SVG + framer-motion. Adapt this directly. Bundle size stays zero for this feature.

---

## Implementation Phases

### Phase 1: Quick Bug Fixes (Items 3, 4, 5)

Low-risk, high-impact. Fixes the three most broken parts of the current experience with minimal code changes.

---

#### 1.1 Fix file_update domain cards not rendering inline in chat (Item 3)

**Root cause:** `SegmentRenderer` in `message-bubble.tsx` handles `domain_summary` and `life_map_synthesis` block types but `file_update` falls through to `return null` (line ~62).

**Files:**
- `components/chat/message-bubble.tsx` — add `file_update` case to `SegmentRenderer`
- `components/chat/markdown-domain-card.tsx` — **new file**, renders `FileUpdateData` markdown in a card layout
- `components/chat/chat-view.tsx` — update quick-reply button condition (lines 622-625) to also check for `file_update` blocks with `fileType === 'domain'`

**Changes:**

1. Create `MarkdownDomainCard` component:
   - Accepts `FileUpdateData` (`{ fileType, name, content }`)
   - Parses `content` markdown to extract sections by `##` headings
   - Renders in the same card layout as existing `DomainCard` (amber accent, status badge, expandable)
   - Uses a lightweight markdown renderer (or simple regex-based extraction) for section content
   - Domain name from `data.name` shown as card title

2. In `SegmentRenderer`, add cases:
   - `blockType === 'file_update'` && `data.fileType === 'domain'` -> `<MarkdownDomainCard>`
   - `blockType === 'file_update'` && `data.fileType === 'overview'` -> `<SynthesisCard>` (extract sections from markdown)
   - Other `file_update` types -> `null` (silently consumed, same as `session_summary`)

3. Update quick-reply button detection:
   ```typescript
   // Before:
   parsed.segments.some(s => s.type === 'block' && s.blockType === 'domain_summary')
   // After:
   parsed.segments.some(s => s.type === 'block' && (
     s.blockType === 'domain_summary' ||
     (s.blockType === 'file_update' && s.data?.fileType === 'domain')
   ))
   ```

**Acceptance criteria:**
- [x] `[FILE_UPDATE type="domain" name="Career / Work"]` blocks render as inline cards in chat
- [x] Quick-reply buttons appear after domain cards (both legacy and file_update)
- [x] `[FILE_UPDATE type="overview"]` blocks render as synthesis cards
- [x] Other file_update types are silently consumed (no visible rendering)
- [x] Cards are visually consistent with existing `DomainCard` component

---

#### 1.2 Fix stated intentions markdown rendering (Item 4)

**Root cause:** `domain-detail-card.tsx` renders `stated_intentions` as plain text `<li>` elements. Raw markdown formatting (`**bold**`, `- ` prefixes) appears literally.

**Files:**
- `components/life-map/domain-detail-card.tsx` — add markdown rendering for text fields

**Changes:**

1. Add a simple inline markdown renderer (or use `dangerouslySetInnerHTML` with a sanitizer) for text fields in `DomainDetailCard`:
   - Strip leading `s - ` and `- ` prefixes from list items
   - Convert `**text**` to `<strong>text</strong>`
   - Apply to `stated_intentions`, `current_state`, `whats_working`, `whats_not_working`, and `tensions` for consistency

2. Alternative: Use the `react-markdown` package if already available, or a minimal regex-based renderer to avoid adding a dependency.

**Acceptance criteria:**
- [x] Stated intentions render with proper bold text and bullet formatting
- [x] No raw `**` markers or `s -` prefixes visible in UI
- [x] Fix applies to all text fields in domain detail cards, not just stated intentions
- [x] Both collapsed preview text and expanded view render correctly

---

#### 1.3 Remove visible "I completed the pulse check" message (Item 5)

**Root cause:** `handlePulseCheckSubmit()` in `chat-view.tsx` line 308 calls `sendMessage('I completed the pulse check.', false, pulseContext)`, which displays and saves the message.

**Files:**
- `components/chat/chat-view.tsx` — modify `handlePulseCheckSubmit()`

**Changes:**

1. Replace the visible `sendMessage()` call with a direct API call that:
   - Sends pulse context as part of the system prompt or as a non-displayed user message
   - Triggers Sage's first response
   - Does NOT add "I completed the pulse check." to the message list or save it to the DB
   - Sage's response IS saved and displayed normally

2. Implementation approach:
   - After saving pulse ratings and hiding the pulse card, call a new function `triggerSageResponse(pulseContext)` that:
     - Adds a temporary "thinking" indicator
     - Calls `/api/chat` with the pulse context injected into the system prompt
     - Sage's response is added to the message list as an assistant message
     - No user message appears in the UI

**Acceptance criteria:**
- [x] After pulse check submission, Sage responds directly — no "I completed the pulse check" visible
- [x] Sage's opening response references the pulse check data (same behavior as before)
- [x] The conversation history in the DB does not contain the trigger message
- [x] The flow works correctly on page refresh (existing pulse check detection logic still applies)

---

### Phase 2: Voice & Error Handling (Item 2)

---

#### 2.1 Fix voice transcription and add error feedback (Item 2)

**Root cause candidates (investigate in order):**

1. `OPENAI_API_KEY` environment variable not set or invalid
2. MIME type mismatch: recorder may produce `audio/mp4` (Safari) but file is sent as `recording.webm`
3. Errors swallowed silently in catch block (line 80-82 of `chat-input.tsx`)

**Files:**
- `components/chat/chat-input.tsx` — fix error handling, dynamic file extension
- `app/api/transcribe/route.ts` — add error logging, validate response
- `lib/voice/recorder.ts` — expose actual MIME type

**Changes:**

1. **Fix file extension/MIME type:**
   - In `recorder.ts`, expose the actual MIME type used by MediaRecorder (stored in `mediaRecorder.mimeType`)
   - In `chat-input.tsx`, use the actual MIME type to determine file extension:
     ```typescript
     const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('webm') ? 'webm' : 'webm'
     formData.append('file', blob, `recording.${ext}`)
     ```

2. **Add user-visible error feedback:**
   - On transcription failure, show an inline error below the mic button (similar pattern to existing `voiceError` display): "Couldn't transcribe audio. Tap to try again."
   - On empty transcription result, show: "No speech detected. Try speaking louder."
   - Auto-dismiss error after 5 seconds or on next mic tap

3. **Add error logging in API route:**
   - Log Whisper API response status and error details server-side
   - Return structured error responses (not just generic 500)

4. **Add recording time limit:**
   - Cap recording at 120 seconds (well under Whisper's 25MB limit)
   - Show elapsed time during recording (already implemented in UI)
   - Auto-stop at limit with a brief "Maximum recording length reached" notice

**Acceptance criteria:**
- [x] Voice transcription works on Chrome (webm) and Safari (mp4)
- [x] Transcription failures show a visible, dismissible error message
- [x] Empty transcription results show appropriate feedback
- [x] Recording auto-stops at 120 seconds
- [x] API route logs transcription errors for debugging

---

### Phase 3: Prompt Tuning (Items 9, 10)

Prompt-only changes. No UI code. Can be tested immediately with existing chat flow.

---

#### 3.1 Tune Sage message length (Item 9)

**File:** `lib/ai/prompts.ts`

**Changes to the system prompt in `getLifeMappingPrompt()`:**

Replace the current length guidance:
```
- Your responses are concise (2-4 sentences typical). Only go longer when synthesizing.
```

With stronger, more specific constraints:
```
## Response Format Rules

- MAXIMUM 2-3 sentences per response. This is a hard limit, not a suggestion.
- End every response with exactly ONE question. Never ask multiple questions.
- Each turn, pick TWO of these four moves — never all four:
  1. Reflect (mirror what you heard)
  2. Reframe (offer a new perspective)
  3. Challenge (gently push back)
  4. Question (ask something deeper)
- Write like a text message from a wise friend, not a therapy session transcript.
- The only exception: when emitting a [FILE_UPDATE] block, the block content does not count toward the sentence limit. Your conversational text before/after the block still follows the 2-3 sentence rule.
```

Apply the same constraints to `getWeeklyCheckinBasePrompt()`.

**Acceptance criteria:**
- [x] System prompt includes explicit sentence limit (2-3), single question rule, and "pick 2 of 4" pattern
- [x] Constraints apply to both life_mapping and weekly_checkin session types
- [x] FILE_UPDATE blocks are explicitly exempted from length limits
- [ ] Test with 5+ conversation turns to verify compliance

---

#### 3.2 Add domain transition warmth (Item 10)

**File:** `lib/ai/prompts.ts`

**Add to the domain transition guidance in `getLifeMappingPrompt()`:**

```
## Domain Transitions

When moving from one domain to another:
1. First, offer a brief emotional acknowledgment of the domain you're leaving — one line that honors the weight or meaning of what was just discussed. Examples:
   - "That's a lot to carry in your finances right now. Thank you for being honest about it."
   - "It sounds like your creative life is really alive — that's worth protecting."
   - "Relationships are complicated. What you shared takes courage."
2. Then introduce the next domain naturally, referencing their pulse rating if relevant.
3. Never say "Okay, moving on" or "Let's talk about X next" — the transition should feel like a conversation, not a checklist.
```

**Acceptance criteria:**
- [x] System prompt includes domain transition warmth guidance with examples
- [x] Guidance specifies one-line emotional beat before pivoting
- [x] Anti-pattern examples prevent clinical transitions

---

### Phase 4: Life Map UX (Items 6, 7, 8)

UI improvements to the Life Map page. No data model changes.

---

#### 4.1 Fix status label confusion (Item 6)

**File:** `components/life-map/domain-detail-card.tsx`

**Changes:**

1. For **explored domains** (domains with Sage-written content):
   - Show only the Sage-assigned `status` label in the top-right badge
   - Remove the "Initial pulse: X" line from the bottom of the card
   - The pulse rating is still stored in the DB for baseline tracking, just not displayed

2. For **unexplored domains** (no Sage content, only pulse data):
   - Show the pulse-derived status (via `pulseRatingToDomainStatus()`) as the status badge
   - No "Initial pulse: X" label needed since it IS the only status

3. Logic: if domain has `content` (Sage has explored it), use `domain.status` from frontmatter. Otherwise, use pulse-derived status.

**Acceptance criteria:**
- [x] Explored domain cards show only one status label (Sage-assigned)
- [x] Unexplored domain cards show pulse-derived status
- [x] No card shows contradictory status labels
- [x] Status badge colors remain consistent with existing `STATUS_COLORS`

---

#### 4.2 Improve unexplored domain cards (Item 7)

**Files:**
- `components/life-map/domain-grid.tsx` — update unexplored domain rendering

**Changes:**

Use the **CTA approach** — it's more aligned with the product's "no dead ends" principle:

1. Unexplored domain stubs become compact cards with:
   - Domain name (bold)
   - Pulse-derived status badge (small, muted)
   - "Explore with Sage" text link in amber
   - Tapping navigates to `/chat` with a query param `?explore=<domain-name>` that pre-populates a quick-reply

2. Group unexplored domains after explored ones with a subtle divider: "Not yet explored"

3. If `ChatView` receives `?explore=<domain>`, it sends a quick reply: "Let's explore [domain name]" to Sage.

**Acceptance criteria:**
- [x] Unexplored domains show as compact cards with "Explore with Sage" CTA
- [x] Tapping CTA navigates to chat with the domain pre-selected
- [x] Explored domains still render as full expandable cards
- [x] Visual hierarchy: explored domains prominent, unexplored domains smaller

---

#### 4.3 Hide "What I'm Doing" tab until life plan exists (Item 8)

**File:** `components/life-map/life-map-tabs.tsx`

**Changes:**

1. Accept a `hasLifePlan` boolean prop (computed in the parent server component)
2. When `hasLifePlan === false`:
   - Don't render the `SegmentedControl`
   - Only render the "Where I Am" content directly
3. When `hasLifePlan === true`:
   - Render tabs as currently implemented

4. In `app/(main)/life-map/page.tsx`, compute:
   ```typescript
   const hasLifePlan = (lifePlanData?.commitments?.length ?? 0) > 0
     || lifePlanData?.quarterTheme != null
   ```

**Acceptance criteria:**
- [x] "What I'm Doing" tab hidden when no life plan content exists
- [x] Tab appears once commitments or quarter theme are set
- [x] No visual regression when tabs are visible
- [x] "Where I Am" content renders correctly without the tab control

---

### Phase 5: Onboarding Redesign (Item 1)

The largest change. Depends on Phase 1 (bug fixes) being complete so the chat experience works correctly after onboarding.

---

#### 5.1 Create onboarding route and flow controller

**Files:**
- `app/(onboarding)/layout.tsx` — **new file**, minimal layout without bottom nav
- `app/(onboarding)/onboarding/page.tsx` — **new file**, server component that checks auth + `onboarding_completed` flag
- `components/onboarding/onboarding-flow.tsx` — **new file**, client component managing the 4-screen flow state machine

**Changes:**

1. **Route group `/(onboarding)`:** No bottom tab nav, no header — full-screen clean canvas. Only contains the onboarding flow.

2. **Server component `page.tsx`:**
   - Verify user is authenticated
   - If `onboarding_completed === true`, redirect to `/home`
   - Otherwise, render `<OnboardingFlow>`

3. **Client component `OnboardingFlow`:**
   - State machine: `intro` -> `intent` -> `domains` -> `summary`
   - Holds all state in React: `step`, `domainIndex`, `ratings: Record<number, number>`, `intent: string | null`
   - Uses `framer-motion` `AnimatePresence` for slide transitions between steps
   - On "Start Conversation": saves pulse check ratings + intent to DB, marks `onboarding_completed = true`, redirects to `/chat`

4. **Update `PreOnboardingHero`:** Link to `/onboarding` instead of `/chat` for new users.

5. **Update `detectSessionState()` / home page:** Route new users to `/onboarding`.

**Acceptance criteria:**
- [x] `/onboarding` accessible only for users with `onboarding_completed === false`
- [x] Completed users redirected to `/home`
- [x] No bottom nav or app shell visible during onboarding
- [x] Flow state managed in React — no DB writes until final submission
- [ ] Browser back button moves through steps correctly

---

#### 5.2 Build Screen 1: Sage Intro

**File:** `components/onboarding/sage-intro.tsx` — **new file**

**Design (adapted from inspiration code to match MeOS design system):**
- Centered layout, full viewport height
- Sage avatar/icon: use existing `BreathingOrb` component (ambient variant) or the custom SVG from inspiration
- "Hey — I'm Sage." — `text-2xl font-semibold text-text-primary`, Satoshi font
- "I'm going to help you build a map of where you are in life right now." — `text-base text-text-secondary`
- "Let's go" CTA: full-width amber button, `bg-primary text-white rounded-full`, bottom-fixed
- Staggered fade-in animations (avatar -> heading -> subtext -> CTA)

**Acceptance criteria:**
- [x] Avatar, greeting, subtext, and CTA render with staggered animations
- [x] CTA triggers transition to Screen 2
- [x] Matches MeOS warm palette (amber/cream/warm gray)
- [x] Accessible: button is focusable, has proper label

---

#### 5.3 Build Screen 2: Intent Selection

**File:** `components/onboarding/intent-selection.tsx` — **new file**

**Design:**
- "What brought you here today?" — large heading
- "No wrong answers — just helps me know where to start." — muted subtext
- 4 pill buttons, stacked vertically, each with:
  - Icon (from lucide-react: Shuffle, Compass, Search, Sparkles)
  - Label text
  - `border-border bg-white/40` default, `border-primary bg-primary/[0.08]` selected
- On tap: select (amber highlight), auto-advance after 300ms
- Staggered entrance animation (0.2s, 0.28s, 0.36s, 0.44s delays)

**Intent values:**
```typescript
const INTENTS = [
  { label: 'Feeling scattered — need more focus', value: 'scattered' },
  { label: 'Going through a transition', value: 'transition' },
  { label: 'Want more clarity on what matters', value: 'clarity' },
  { label: 'Just curious', value: 'curious' },
]
```

**Acceptance criteria:**
- [x] 4 pill buttons with icons, staggered entrance
- [x] Tapping selects and auto-advances after ~300ms
- [x] Selected state uses amber highlight
- [x] Touch targets >= 44px
- [x] `aria-pressed` on buttons for accessibility

---

#### 5.4 Build Screen 3: Domain Pulse Check (one per screen)

**Files:**
- `components/onboarding/domain-card.tsx` — **new file**, single domain rating screen
- `components/onboarding/rating-scale.tsx` — **new file**, 5-point circle scale

**Design:**

**DomainCard:**
- Top bar: back arrow (left) + "X of 8" progress indicator (right)
- Centered domain name: `text-3xl font-bold text-text-primary`
- First domain only: italic instruction "Quick gut check — don't overthink these." (fades after first rating)
- `RatingScale` component centered below
- "tap to rate" hint below scale (fades after first selection)

**RatingScale:**
- Horizontal row of 5 tappable circles (44px) on a connecting line
- End labels: "Rough" (left) / "Thriving" (right) in small caps
- On tap: selected circle fills amber (`bg-primary`), spring animation
- Selected label fades in below: "Rough" / "Struggling" / "Okay" / "Good" / "Thriving"
- Auto-advances to next domain after ~400ms

**Domain order (matches `PULSE_DOMAINS`):**
Career, Relationships, Health & Body, Finances, Learning & Growth, Creative Pursuits, Play & Adventure, Meaning & Purpose

**Acceptance criteria:**
- [x] One domain per screen, 8 total
- [x] 5-point scale with amber fill animation
- [x] Auto-advance after 400ms delay
- [x] Back arrow works (returns to previous domain, or to intent selection from domain 1)
- [x] Progress indicator shows "X of 8"
- [x] Instructional text appears only on first domain, fades after first rating
- [x] All 5 scale circles have ARIA labels (radio group pattern)
- [x] Touch targets >= 44px

---

#### 5.5 Build Screen 4: Summary with Radar Chart

**Files:**
- `components/onboarding/summary-screen.tsx` — **new file**
- `components/onboarding/radar-chart.tsx` — **new file**, custom SVG radar chart

**Design:**

**SummaryScreen:**
- "Here's your life snapshot" — large heading
- "a map, not a grade" — italic subtext (Caveat font if available, otherwise italic Inter)
- RadarChart component
- Sage observation: "I can see some patterns already. Ready to explore?" — italic, muted
- "Start Conversation" CTA: full-width amber button, same style as Screen 1
- "Edit ratings" text link below CTA

**RadarChart (custom SVG, adapted from inspiration):**
- 320x320 SVG viewBox
- 8 axes at equal angles from center
- Grid rings at 25%, 50%, 75%, 100%
- Data polygon: `fill: #D4A574` at 20% opacity, `stroke: #D4A574` at 2px
- Data points: small circles at each vertex
- Domain labels around perimeter
- Animate: polygon draws outward from center, points spring in sequentially
- Axis/grid lines: `stroke: #B8A99A` at low opacity

**Acceptance criteria:**
- [x] Radar chart renders with animated entrance
- [x] All 8 domain labels visible around perimeter
- [x] Data polygon accurately reflects ratings (scale 0-4 mapped to radius)
- [x] "Start Conversation" saves ratings, marks onboarding complete, redirects to `/chat`
- [x] "Edit ratings" navigates back to domain 1 (ratings preserved for quick re-rating)

---

#### 5.6 Wire onboarding completion to chat

**Files:**
- `components/onboarding/onboarding-flow.tsx` — submission handler
- `lib/supabase/pulse-check.ts` — reuse `savePulseCheckRatings()`
- `components/chat/chat-view.tsx` — update `init()` for post-onboarding state
- `lib/ai/prompts.ts` — update Sage's opening for post-onboarding context

**Changes:**

1. **On "Start Conversation" tap:**
   - Create a new `life_mapping` session
   - Save all 8 pulse check ratings via `savePulseCheckRatings()`
   - Include intent in session metadata or pulse context
   - Set `onboarding_completed = true` on the user record
   - Redirect to `/chat`

2. **Update `ChatView.init()` for `new_user` with completed onboarding:**
   - When the user arrives at `/chat` with a fresh session and existing pulse data, skip the pulse check UI
   - Auto-trigger Sage's opening response with pulse context + intent injected
   - Sage's first message should reference both intent and pulse data

3. **Update `SAGE_OPENING_NEW_USER` or `getSageOpening()`:**
   - Instead of asking the user to take a pulse check, Sage should greet them warmly and reference their intent:
     - "scattered" -> "You mentioned feeling scattered — let's untangle that..."
     - "transition" -> "Going through a transition can feel disorienting. Let's map where things stand..."
     - "clarity" -> "You want more clarity on what matters — that's a great place to start..."
     - "curious" -> "Just exploring — I love that. Let's see what comes up..."
   - Follow with a reference to the most notable pulse data (e.g., lowest-rated domain)

**Acceptance criteria:**
- [x] Onboarding completion saves all data and redirects to chat
- [x] Sage's first message references intent selection
- [x] Sage's first message references pulse check data (especially flagged domains)
- [x] No "I completed the pulse check" message appears
- [x] Flow works on page refresh after onboarding (session + ratings already exist)

---

## Dependency Graph

```
Phase 1 (Items 3, 4, 5) ──┐
                           ├── Phase 5 (Item 1: Onboarding)
Phase 2 (Item 2: Voice) ──┘        │
                                    │
Phase 3 (Items 9, 10: Prompts) ────┘  (prompt changes needed before onboarding wiring)

Phase 4 (Items 6, 7, 8: Life Map UX) — independent, can run in parallel with any phase
```

**Critical path:** Phase 1 -> Phase 3 -> Phase 5 (onboarding depends on bug fixes + prompt tuning)

**Parallel tracks:**
- Phase 2 (voice) and Phase 4 (life map UX) can run independently

---

## Open Questions (Non-Blocking)

These have reasonable defaults (stated above) but could be revisited:

1. **Domain name consistency:** Spec says "Health & Body" but `PULSE_DOMAINS` uses "Health / Body". Should we standardize? **Default:** Use whatever `PULSE_DOMAINS` already has.

2. **Framer-motion dependency:** The inspiration code uses framer-motion for animations. Is this already in the project dependencies? If not, should we add it or use CSS animations? **Default:** Add framer-motion — it's the standard for React animation and worth the bundle cost for the onboarding feel.

3. **Sage's response length during synthesis:** Item 9 says "2-3 sentences max" but FILE_UPDATE blocks are long. **Default:** Exempt FILE_UPDATE blocks from length limits (already specified in the prompt changes).

---

## References

### Internal
- Playtest feedback: `Docs/feedback/20260215_Playtest_feedback_onboarding.md`
- Inspiration code: `inspiration/onboarding_pulse_check_experience.zip`
- R1 fixes plan: `docs/plans/2026-02-13-feat-post-playtest-fixes-r1-plan.md`
- Markdown architecture: `docs/plans/2026-02-14-feat-markdown-data-architecture-plan.md`
- Narrative home plan: `docs/plans/2026-02-14-feat-narrative-home-approachability-plan.md`

### Key Source Files
- Pulse check types: `types/pulse-check.ts`
- Pulse check DB: `lib/supabase/pulse-check.ts`
- Session state: `lib/supabase/session-state.ts`
- Chat view: `components/chat/chat-view.tsx`
- Message rendering: `components/chat/message-bubble.tsx`
- Parser: `lib/ai/parser.ts`
- System prompts: `lib/ai/prompts.ts`
- Voice recorder: `lib/voice/recorder.ts`
- Chat input: `components/chat/chat-input.tsx`
- Transcribe API: `app/api/transcribe/route.ts`
- Life Map page: `app/(main)/life-map/page.tsx`
- Domain detail card: `components/life-map/domain-detail-card.tsx`
- Domain grid: `components/life-map/domain-grid.tsx`
- Life map tabs: `components/life-map/life-map-tabs.tsx`
- Markdown extraction: `lib/markdown/extract.ts`

### Institutional Learnings
- Heading boundary bug in `extractCommitments()`: `docs/solutions/logic-errors/markdown-section-extraction-heading-boundary.md` — use h1/h2 boundaries only
- Security deny-by-default: `docs/solutions/security-issues/markdown-storage-security-review-fixes.md` — validate file writes against session-scoped whitelist
- `Promise.allSettled()` for parallel reads — avoid sequential N+1 pattern
