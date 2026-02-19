---
title: "fix: R4.1 Playtest Patches — Onboarding & Core UX Fixes"
type: fix
date: 2026-02-19
source: Docs/feedback/20260219_R4a_onboarding_fixes.md
priority: P0 — ship before any new feature work
---

# fix: R4.1 Playtest Patches — Onboarding & Core UX Fixes

## Overview

Nine targeted patches from Playtest R4 observations, covering three categories:

1. **Layout/visual bugs** — spider chart overlap, markdown rendering, chat anchoring
2. **State management gaps** — tab bar/FAB visibility, pulse check data injection
3. **Viewport framing** — phone container on desktop, z-index hierarchy

Implementation order (from spec): 8 → 3 → 1 → 2 → 4 → 5 → 6 → 7 → 9

---

## Problem Statement

Playtest R4 revealed critical regressions and UX gaps that prevent the app from being usable for Wave 1 external testing:

- **P0:** Life snapshot screen is visually broken — synthesis text renders on top of the spider chart
- **P0:** Sage ignores pulse check ratings at conversation start — asks users to rate again despite having the data
- **P0:** Tab bar and FAB appear during onboarding when they should be hidden
- **P1–P2:** Raw markdown asterisks visible in chat, messages anchor to top not bottom, pulse circles barely visible, voice orb dominates input bar, desktop layout inconsistent, bottom sheets overlap tab bar

Screenshots confirm all issues are reproducible. Fix all nine before proceeding to milestone features.

---

## Technical Approach

### Key Files

| Patch | File(s) |
|-------|---------|
| 1 Spider chart | [`components/onboarding/summary-screen.tsx`](components/onboarding/summary-screen.tsx) |
| 2 Pulse injection | [`app/api/chat/route.ts`](app/api/chat/route.ts) |
| 3 Tab bar state | [`app/(main)/layout.tsx`](app/(main)/layout.tsx), [`components/ui/bottom-tab-bar.tsx`](components/ui/bottom-tab-bar.tsx) |
| 4 Markdown render | [`components/chat/message-bubble.tsx`](components/chat/message-bubble.tsx) |
| 5 Bottom-anchor | [`components/chat/chat-view.tsx`](components/chat/chat-view.tsx) (line 954) |
| 6 Pulse circles | [`components/onboarding/rating-scale.tsx`](components/onboarding/rating-scale.tsx) |
| 7 Input bar | [`components/chat/chat-input.tsx`](components/chat/chat-input.tsx) |
| 8 Phone container | [`app/(main)/layout.tsx`](app/(main)/layout.tsx), [`app/layout.tsx`](app/layout.tsx) |
| 9 Z-index | [`components/ui/bottom-tab-bar.tsx`](components/ui/bottom-tab-bar.tsx), [`components/ui/user-menu-sheet.tsx`](components/ui/user-menu-sheet.tsx) |

### Architecture Decisions

- **Tab bar state machine** runs in the client (`BottomTabBar`) using a React context or URL/pathname signal — the main layout is a server component and cannot read session state. We'll detect "active session" by checking the current pathname + URL params (`/chat?...`), and "pre-onboarding" by passing `onboardingCompleted` as a prop down from the server layout.
- **Phone container** wraps the existing `<main>` and navigation at the layout level — no individual screen rewrites needed.
- **Markdown rendering** uses a minimal inline renderer (bold + italic + paragraph breaks only) — NOT react-markdown for full markdown, to keep it lightweight and conversation-appropriate.
- **Voice transcribe-to-field** changes the `transcribeAndSend` function to set field text instead of calling `onSend` directly.

### Institutional Learnings to Apply

- **Sanitize pulse data before prompt injection** — strip `[FILE_UPDATE]` block tags from any user-submitted content before interpolating into system prompts (from `20260218-daily-rhythm-m3-review-findings.md`)
- **No `will-change: transform` on always-rendered elements** — remove from animations if not performance-critical (from breathing-orb-optimization)
- **Parser regex state** — use `matchAll()` not `.exec()` with `/g` flag if any regex changes touch the parser
- **Type validation at data layer** — validate union types in data fetchers, not in components

---

## Implementation Plan

### Phase 1: Foundation (Patches 8 + 9)

Do this first. Phone container constrains the viewport and may resolve some layout issues automatically. Z-index hierarchy should be established before adding more fixed elements.

#### Patch 8: Global Phone Container on Desktop

**File:** [`app/(main)/layout.tsx`](app/(main)/layout.tsx)

**Current state:** `<div className="min-h-screen bg-bg">` — no max-width, fills full viewport on desktop.

**Change:**

```tsx
// app/(main)/layout.tsx — outer wrapper change only
return (
  <div className="min-h-screen bg-[#F0EDE8]"> {/* outer bg — warm neutral "desktop surround" */}
    <div className="relative mx-auto max-w-[430px] min-h-[100dvh] bg-bg shadow-[0_0_60px_rgba(0,0,0,0.08)] overflow-hidden md:rounded-[20px]">
      <ActivityTracker />
      <AppHeader email={email} displayName={displayName} />
      <main className="pb-24">
        {children}
      </main>
      <BottomTabBar onboardingCompleted={onboardingCompleted} />
    </div>
  </div>
)
```

**Key details:**
- `max-w-[430px]` — centered phone width on desktop
- `md:rounded-[20px]` — device frame only at tablet+ (not on mobile ≤480px)
- `overflow-hidden` — clips content to container bounds
- Outer `bg-[#F0EDE8]` — warm neutral surround
- All `fixed` elements (tab bar, app header, session header) inside this container will anchor to the container, not the browser viewport — **requires a `relative` wrapper with `overflow-hidden` + testing that `fixed` children respect the containing block**

> ⚠️ Note: CSS `position: fixed` is relative to the viewport unless a containing block establishes a new stacking context (transform, filter, will-change). The `overflow-hidden` on the wrapper may be sufficient, but test carefully. If fixed elements escape, switch tab bar and header to `position: sticky` or `position: absolute` within a flex column layout.

**Alternative approach (safer for fixed elements):**

```tsx
// Use flex column + sticky positioning instead of fixed
<div className="mx-auto max-w-[430px] min-h-[100dvh] flex flex-col bg-bg">
  <AppHeader ... />  {/* sticky top-0 */}
  <main className="flex-1 overflow-y-auto">
    {children}
  </main>
  <BottomTabBar ... />  {/* sticky bottom, part of flex column */}
</div>
```

Decide during implementation which approach avoids the `fixed` positioning issue.

**Acceptance criteria:**
- [ ] Desktop (>480px): app in centered 430px container with subtle shadow and warm surround
- [ ] Mobile (≤480px): full viewport, no visible container
- [ ] All screens render inside the container
- [ ] No horizontal overflow

#### Patch 9: Z-Index Hierarchy

**Files:** [`components/ui/bottom-tab-bar.tsx`](components/ui/bottom-tab-bar.tsx), [`components/ui/user-menu-sheet.tsx`](components/ui/user-menu-sheet.tsx)

**Current state:** Tab bar is `z-50`. Bottom sheet z-index unknown (likely unset or same level).

**Establish global z-index constants (in `tailwind.config.ts` or a `lib/z-index.ts`):**

```typescript
// lib/z-index.ts
export const Z = {
  pageContent: 1,
  tabBar: 10,
  fab: 15,
  sessionHeader: 20,
  bottomSheet: 50,
  backdrop: 40,  // behind sheet, above tab bar
  modal: 100,
  toast: 150,
} as const
```

**Changes:**
- `bottom-tab-bar.tsx`: Change `z-50` → `z-10` (using the z-10 Tailwind class or inline style)
- `user-menu-sheet.tsx`: Ensure sheet overlay is `z-[50]` and backdrop is `z-[40]`
- Backdrop should dim everything below it (including tab bar)
- Tapping backdrop dismisses the sheet

**Acceptance criteria:**
- [ ] Bottom sheets render cleanly above tab bar
- [ ] Backdrop dims content behind bottom sheet including tab bar
- [ ] FAB not visible when bottom sheet is open
- [ ] Tapping backdrop dismisses the sheet

---

### Phase 2: Navigation State Machine (Patch 3)

**Priority: P0 — first impression for every new user**

#### Patch 3: Tab Bar & FAB Visibility State Machine

**Files:** [`app/(main)/layout.tsx`](app/(main)/layout.tsx), [`components/ui/bottom-tab-bar.tsx`](components/ui/bottom-tab-bar.tsx)

**Current state:** `BottomTabBar` always renders. No awareness of onboarding status or active session.

**Approach:**

The main layout is a server component that already fetches `onboarding_completed`. Pass it to `BottomTabBar`. The tab bar (client component) uses `usePathname()` to detect active sessions.

```tsx
// app/(main)/layout.tsx — fetch onboarding state and pass down
const { data: profile } = await supabase
  .from('users')
  .select('email, display_name, onboarding_completed')  // already fetched
  .eq('id', user.id).single()

const onboardingCompleted = profile?.onboarding_completed ?? false

// Pass to BottomTabBar
<BottomTabBar onboardingCompleted={onboardingCompleted} />
```

```tsx
// components/ui/bottom-tab-bar.tsx — state machine
interface BottomTabBarProps {
  onboardingCompleted: boolean
}

export function BottomTabBar({ onboardingCompleted }: BottomTabBarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Detect active session: any /chat route that has started a session
  // (could also check for a session param, but pathname is sufficient)
  const isActiveSession = pathname.startsWith('/chat')

  // State machine
  if (!onboardingCompleted) return null  // pre-onboarding: hide everything
  if (isActiveSession) return null       // active session: hide, session header takes over

  // Post-onboarding, no active session: show tab bar + FAB
  return <nav ...> ... </nav>
}
```

**Session header during active sessions:**

The existing `SessionHeader` component (`components/chat/session-header.tsx`) only renders the label + duration pill. It needs to be promoted to a **top bar with exit affordance** when the tab bar is hidden.

```tsx
// components/chat/session-header.tsx — extend with exit button
interface SessionHeaderProps {
  sessionType: SessionType
  exploreDomain?: string
  nudgeContext?: string
  onExit?: () => void          // NEW: exit/pause handler
  messageCount?: number        // NEW: for 3-message threshold
}

export function SessionHeader({ ..., onExit, messageCount = 0 }: SessionHeaderProps) {
  // Show confirmation if 3+ messages, silent exit if fewer
  // Styling: sticky top bar, subtle, matches bg
}
```

**Onboarding exit affordance:**

During onboarding (`/onboarding` route), add a "Save & finish later" link in the top-left. This is in `app/(onboarding)/` which is separate from `app/(main)/` — needs its own exit handling in `components/onboarding/onboarding-flow.tsx`.

**FAB routing:**

```typescript
// components/ui/bottom-tab-bar.tsx — FAB routing
function getOrbHref(hour: number): string {
  if (hour < 11) return '/chat?type=open_day'
  if (hour < 18) return '/home?capture=1'
  return '/chat?type=close_day'
}
// Current logic is correct — just needs to only render when onboarding complete + no active session
```

**Acceptance criteria:**
- [ ] Brand new user (onboarding_completed = false) sees NO tab bar and NO FAB
- [ ] Tab bar appears after life mapping completion (onboarding_completed set to true)
- [ ] Tab bar and FAB hide when on any `/chat` route
- [ ] Session header visible at top during active sessions with exit affordance
- [ ] Exit button: 0-2 messages → silent exit; 3+ messages → pause confirmation sheet
- [ ] FAB routes to correct session type by time of day
- [ ] No overlap between tab bar and any other UI element

---

### Phase 3: Core Bug Fixes (Patches 1 + 2)

#### Patch 1: Fix Spider Chart Text Overlap on Life Snapshot Screen

**File:** [`components/onboarding/summary-screen.tsx`](components/onboarding/summary-screen.tsx)

**Root cause:** The blurb container is `<div className="h-16 flex items-center justify-center mb-10">` — a **fixed h-16 (64px)** that cannot expand. The generated blurb routinely exceeds 64px of height, overflowing onto the chart and CTA button.

**Fix — change layout to normal document flow with no fixed height:**

```tsx
// components/onboarding/summary-screen.tsx

// BEFORE:
<div className="flex flex-col items-center min-h-[100dvh] px-6 pt-16 pb-12 relative z-10">
  <h1>...</h1>
  <p>a map, not a grade</p>

  {/* Chart */}
  <motion.div className="w-full max-w-[360px] mb-8">
    <RadarChart ... />
  </motion.div>

  {/* Blurb — FIXED HEIGHT: BUG */}
  <div className="h-16 flex items-center justify-center mb-10">
    <p>{commentary}</p>
  </div>

  {/* CTA */}
  <button>Start Conversation</button>
</div>

// AFTER:
<div className="flex flex-col items-center min-h-[100dvh] px-6 pt-12 pb-10 overflow-y-auto">
  <h1 className="text-[32px] font-bold text-text mb-2 text-center">...</h1>
  <p className="text-[15px] text-text-secondary/60 mb-6 italic">a map, not a grade</p>

  {/* Chart — self-contained, fixed height wrapper */}
  <div className="w-full max-w-[340px] h-[360px] flex items-center justify-center mb-6">
    <RadarChart ... />
  </div>

  {/* Blurb — NATURAL HEIGHT, full width */}
  <div className="w-full max-w-[320px] mb-8 min-h-[3rem]">
    {blurbLoading ? (
      <p className="text-[15px] text-text-secondary/50 italic text-center leading-relaxed">
        Looking at your ratings...
      </p>
    ) : (
      <p className="text-[15px] text-text-secondary italic text-center leading-relaxed">
        {commentary}
      </p>
    )}
  </div>

  {/* CTA — always below blurb, never overlapping */}
  <button className="w-full max-w-[320px] ...">Start Conversation</button>
  <button className="mt-4 text-[13px] ...">Edit ratings</button>
  <div className="h-6" /> {/* bottom breathing room */}
</div>
```

**Domain label abbreviations** (if labels still overlap chart axes):

| Original | Abbreviated |
|----------|-------------|
| Play / Fun / Adventure | Play / Fun |
| Creative Pursuits | Creative |
| Learning / Growth | Learning |
| Meaning / Purpose | Purpose |
| Health / Body | Health |

These abbreviations live in the `DOMAINS` array in `types/pulse-check.ts` or wherever domain labels are defined — add a `shortLabel` field.

**Acceptance criteria:**
- [ ] No text overlaps anywhere on the life snapshot screen at any viewport width
- [ ] Spider chart labels fully readable, don't touch polygon edges
- [ ] Synthesis blurb fully readable below the chart
- [ ] CTA button clearly separated from surrounding text
- [ ] Scrollable if content exceeds viewport height

#### Patch 2: Fix Pulse Check Data Injection into Life Mapping Conversation

**Files:** [`app/api/chat/route.ts`](app/api/chat/route.ts), [`components/chat/chat-view.tsx`](components/chat/chat-view.tsx), [`components/onboarding/summary-screen.tsx`](components/onboarding/summary-screen.tsx)

**Root cause:** The API route already has `onboarding_baseline` mode handling (lines 90–154) that injects pulse ratings. The bug is either:
1. `pulseContextMode` is not being passed as `'onboarding_baseline'` when the conversation starts, OR
2. The ratings are retrieved from the session but the session `metadata` doesn't contain them yet at conversation start

**Diagnosis steps (implement first):**
1. Add a temporary console.log in `app/api/chat/route.ts` to log the received `pulseContextMode` value
2. Check `chat-view.tsx:311,413,460` where `triggerSageResponse('onboarding_baseline')` is called — confirm these code paths are actually hit after onboarding

**The system prompt injection format (already exists at `app/api/chat/route.ts:154`):**

```
The user just completed their onboarding pulse check. Here are their self-ratings:

[onboarding context with ratings]

Use these ratings to guide the conversation. Focus on the lowest-rated domains first.
Do NOT ask the user to rate domains again — you already have their ratings.
Reference specific ratings naturally (e.g., "You rated Creative Pursuits a 2 — that stood out to me. What's going on there?").
```

**Ensure the blurb context is also injected** — currently the `generate-blurb` response is displayed in `SummaryScreen` but not stored anywhere for the conversation. After `SummaryScreen` generates the blurb, it should be passed back to the parent and included in the session metadata or initial context.

**Fix in `components/onboarding/onboarding-flow.tsx`:**

```tsx
// When SummaryScreen onStart is called, pass the generated blurb along
// so it can be stored in session metadata or as a context part
interface SummaryScreenProps {
  ...
  onStart: (blurb: string | null) => void  // pass blurb to parent
}

// In onboarding-flow.tsx, store in session metadata:
await supabase.from('sessions').update({
  metadata: {
    ...existingMeta,
    pulse_blurb: blurb,  // AI synthesis text shown to user
  }
}).eq('id', sessionId)
```

**In `app/api/chat/route.ts`, include blurb in context:**

```typescript
// After building the pulse ratings context:
const blurb = meta.pulse_blurb
if (blurb) {
  contextParts.push(`The user also saw this AI-generated synthesis of their ratings: "${sanitizePulseContent(blurb)}"`)
}
```

> ⚠️ **Security note:** sanitize the blurb before interpolation — strip `[FILE_UPDATE]` tags and other block markers (per institutional learning from `20260218-daily-rhythm-m3-review-findings.md`).

**Opening message:** Ensure Sage's system prompt explicitly forbids the "Rate each of these areas" opener. The existing prompt may not be strong enough — add:

```
IMPORTANT: The user has ALREADY rated all 8 domains in the pulse check. DO NOT ask them to rate anything. Your opening message should acknowledge their ratings and propose which domain to explore first, referencing their lowest-rated areas by name.
```

**Acceptance criteria:**
- [ ] Sage's opening message references specific pulse check ratings by name and number
- [ ] Sage does NOT ask the user to rate domains
- [ ] Sage proposes starting with the lowest-rated domains
- [ ] The intake question answer is referenced naturally in the opening
- [ ] AI synthesis blurb shown in SummaryScreen is available to Sage as context

---

### Phase 4: UI Polish (Patches 4 + 5 + 6)

#### Patch 4: Fix Raw Markdown Rendering in Chat Bubbles

**File:** [`components/chat/message-bubble.tsx`](components/chat/message-bubble.tsx)

**Current state (line 28):** `<p className="text-text whitespace-pre-wrap">{content}</p>` — no processing.

**Fix — minimal inline markdown renderer** (no library needed for bold/italic only):

```tsx
// components/chat/message-bubble.tsx

function renderInlineMarkdown(text: string): React.ReactNode {
  // Split on **bold** and *italic* markers
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return part
  })
}

function TextSegment({ content, isUser }: { content: string; isUser: boolean }) {
  // Split into paragraphs on blank lines
  const paragraphs = content.split(/\n\n+/)
  return (
    <div className={cn('max-w-[85%] rounded-lg px-4 py-3 animate-fade-up', ...)}>
      {paragraphs.map((para, i) => (
        <p key={i} className={cn('text-text', i > 0 && 'mt-3')}>
          {renderInlineMarkdown(para)}
        </p>
      ))}
    </div>
  )
}
```

**Acceptance criteria:**
- [ ] `**bold**` renders as bold text in all Sage messages
- [ ] `*italic*` renders as italic
- [ ] No raw asterisks visible in any chat message
- [ ] Paragraph breaks (blank lines) render correctly

#### Patch 5: Bottom-Anchor Chat Messages

**File:** [`components/chat/chat-view.tsx`](components/chat/chat-view.tsx)

**Current state (line 954):** `<div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">` — messages stack from top.

**Fix:**

```tsx
// components/chat/chat-view.tsx
// Wrap the scroll container with a flex column that pushes content to bottom

<div ref={scrollRef} className="flex-1 overflow-y-auto px-4">
  {/* Spacer that shrinks as messages fill the space */}
  <div className="flex flex-col justify-end min-h-full py-4">
    <div className="flex flex-col gap-0">
      {/* SessionHeader — appears at top */}
      {/* Messages */}
      {/* Streaming */}
      {/* Cards */}
    </div>
  </div>
</div>
```

The key pattern: wrap messages in a `flex flex-col justify-end min-h-full` container inside the scroll area. When few messages exist, they anchor to the bottom. When messages exceed the height, normal scroll takes over.

**Auto-scroll on new message** (already likely exists — verify `scrollRef` is called on `messages` change).

**Acceptance criteria:**
- [ ] First message in a new conversation appears near bottom of viewport, not top
- [ ] Input bar and most recent message are visually close
- [ ] Scrolling works naturally as conversation grows
- [ ] New messages auto-scroll into view

#### Patch 6: Pulse Check Circle Contrast & Feedback

**File:** [`components/onboarding/rating-scale.tsx`](components/onboarding/rating-scale.tsx) (or `components/chat/pulse-check-card.tsx` — verify which renders the rating circles)

**Color values for 5 circles (unselected → selected):**

| Circle | Unselected | Selected |
|--------|-----------|---------|
| 1 (Rough) | `#E8A598` | `#D4725C` |
| 2 | `#E8C498` | `#D4A05C` |
| 3 (Middle) | `#E8D898` | `#D4BC5C` |
| 4 | `#A8D4A0` | `#6BB85E` |
| 5 (Thriving) | `#88C490` | `#4AA85C` |

**Selected state (Framer Motion):**

```tsx
// Use motion.button with whileTap and animate for each circle
<motion.button
  onClick={() => onSelect(i)}
  animate={isSelected ? { scale: 1.15 } : { scale: 1.0 }}
  whileTap={{ scale: 0.95 }}
  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
  style={{ backgroundColor: isSelected ? selectedColor : unselectedColor }}
  className="w-10 h-10 rounded-full flex items-center justify-center"
>
  {isSelected && (
    <span className="text-white text-sm font-semibold">{i + 1}</span>
  )}
</motion.button>
```

**Label contrast:** Change "ROUGH" and "THRIVING" labels from muted color to `text-text` (dark warm gray).

**"Tap to rate" hint:** Keep, but fade out after first tap using local state.

**Acceptance criteria:**
- [ ] All 5 rating circles clearly visible before any tap
- [ ] Color gradient from red → green apparent across 5 circles
- [ ] Selected circle: color change + scale + number visible
- [ ] "ROUGH" / "THRIVING" labels easy to read
- [ ] Circles have smooth spring tap animation

---

### Phase 5: Input Bar + Final Cleanup (Patches 7 + 9b)

#### Patch 7: Simplify Chat Input Bar & Change Voice Flow

**File:** [`components/chat/chat-input.tsx`](components/chat/chat-input.tsx)

**Current state:**
- Voice button: `w-[64px] h-[64px]` orb (oversized)
- Voice flow: records → transcribes → calls `onSend` directly (no user review)
- Layout: mic | textarea | send

**New layout spec:**

```
[ 🎙 ] [ Type a message...                    ] [ ➤ ]
 40px   flex-1                                   40px
```

**Changes to `chat-input.tsx`:**

```tsx
// 1. Shrink mic button: w-[40px] h-[40px] → standard icon button
<button
  className={cn(
    'flex-shrink-0 w-10 h-10 rounded-full',
    'flex items-center justify-center',
    'transition-all duration-200',
    voiceState === 'idle' && 'text-warm-gray/70 hover:text-text',
    voiceState === 'recording' && 'text-amber-500',
    // NO oversized orb, NO animate-pulse in idle
  )}
>
  <MicIcon /> {/* 20px icon */}
</button>

// 2. Change transcribeAndSend → transcribeToField
async function transcribeToField(blob: Blob) {
  setVoiceState('processing')
  try {
    const result = await fetch('/api/transcribe', ...)
    const { text } = await result.json()
    if (text?.trim()) {
      setText(text)           // PUT text in field, DO NOT send
      inputRef.current?.focus()
    }
  } finally {
    setVoiceState('idle')
  }
}

// 3. Remove animate-pulse from idle voice button
// 4. Recording indicator: mic icon turns amber + subtle pulse ring (not size change)
```

**Recording visual feedback:**

```tsx
// When recording: amber mic icon + animated ring
voiceState === 'recording' && (
  <span className="absolute inset-0 rounded-full border-2 border-amber-400 animate-ping opacity-50" />
)
```

**Acceptance criteria:**
- [ ] Mic button is ~40px, not an oversized orb
- [ ] Text field takes majority of input bar width
- [ ] Send button only activates when text is present
- [ ] Voice recording transcribes to text field (does NOT auto-send)
- [ ] User can edit transcribed text before sending
- [ ] Input bar overall looks balanced and compact

---

## Acceptance Criteria (Full Suite)

### P0 — Ship Blockers

- [ ] No text overlaps on life snapshot screen (Patch 1)
- [ ] Sage references pulse check ratings in opening message, never asks to rate again (Patch 2)
- [ ] Pre-onboarding users see NO tab bar and NO FAB (Patch 3)
- [ ] Tab bar and FAB hide during any active chat session (Patch 3)

### P1 — Core UX

- [ ] Bold and italic text renders correctly in all Sage messages (Patch 4)
- [ ] First message anchors near bottom of viewport (Patch 5)
- [ ] Rating circles clearly visible with color gradient and tap feedback (Patch 6)
- [ ] Mic button is standard-sized icon, voice transcribes to field (Patch 7)

### P2 — Polish

- [ ] Desktop: app in centered 430px container (Patch 8)
- [ ] Mobile: full viewport (Patch 8)
- [ ] Bottom sheets render above tab bar with dimming backdrop (Patch 9)

---

## Dependencies & Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| `position: fixed` elements escape phone container | High — tab bar/header float outside container on desktop | Test immediately after Patch 8; switch to sticky/flex column approach if needed |
| Pulse injection timing — session metadata may not be populated when first message fires | High | Add console.log to trace the `pulseContextMode` value; fix the trigger path in `chat-view.tsx` |
| Tab bar hiding breaks navigation for existing users (mid-session page refresh) | Medium | On `/chat` route, tab bar hides regardless of message count — acceptable; session header provides exit |
| Markdown renderer regex edge cases | Low | Only bold + italic supported; no nested formatting needed |
| `onboarding_completed` prop drilling through main layout | Low | Single prop from server → BottomTabBar; straightforward |

---

## Out of Scope for R4.1

Per spec (`Docs/feedback/20260219_R4a_onboarding_fixes.md`):

- Close the Day session (Milestone 1)
- Open the Day session (Milestone 2)
- Quick Capture + Mid-Day (Milestone 3)
- Ghost session / home screen reliability
- Google Calendar OAuth
- Home card-stack layout
- R3 fix verification (artifact sidebar, emerging patterns, domain preview lines, etc.)

**Next step after R4.1:** Verify R3 fixes (from `2026-02-17-feat-r3-playtest-fixes-plan.md`) are working before layering daily rhythm features on top.

---

## References

### Internal Files

- [`app/(main)/layout.tsx`](app/(main)/layout.tsx) — main layout shell
- [`components/ui/bottom-tab-bar.tsx`](components/ui/bottom-tab-bar.tsx) — tab bar + FAB
- [`components/chat/chat-input.tsx`](components/chat/chat-input.tsx) — input bar + voice
- [`components/chat/chat-view.tsx`](components/chat/chat-view.tsx) — chat message list
- [`components/chat/message-bubble.tsx`](components/chat/message-bubble.tsx) — text rendering
- [`components/chat/session-header.tsx`](components/chat/session-header.tsx) — session top bar
- [`components/onboarding/summary-screen.tsx`](components/onboarding/summary-screen.tsx) — life snapshot screen
- [`components/onboarding/rating-scale.tsx`](components/onboarding/rating-scale.tsx) — pulse rating circles
- [`components/ui/user-menu-sheet.tsx`](components/ui/user-menu-sheet.tsx) — bottom sheet
- [`app/api/chat/route.ts`](app/api/chat/route.ts) — pulse context injection (lines 90–154)
- [`lib/supabase/home-data.ts`](lib/supabase/home-data.ts) — onboarding state query

### Source Docs

- [`Docs/feedback/20260219_R4a_onboarding_fixes.md`](Docs/feedback/20260219_R4a_onboarding_fixes.md) — original spec
- [`Docs/solutions/code-review-fixes/20260218-daily-rhythm-m3-review-findings.md`](Docs/solutions/code-review-fixes/20260218-daily-rhythm-m3-review-findings.md) — prompt injection security, type safety patterns
- [`Docs/solutions/performance-issues/breathing-orb-optimization.md`](Docs/solutions/performance-issues/breathing-orb-optimization.md) — z-index / will-change anti-patterns
