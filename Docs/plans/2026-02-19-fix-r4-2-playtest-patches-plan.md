---
title: "fix: R4.2 playtest patches — life map pill, spider chart, chat anchoring"
type: fix
date: 2026-02-19
source: Docs/feedback/20260219_R4b_patches_to_R4a.md
---

# fix: R4.2 Playtest Patches

## Overview

Four patches identified during R4B playtest. One (Patch 1: Session Header) is **already complete** on the current branch `feat/tab-bar-session-exit-ux`. This plan covers the remaining three patches plus a Patch 1 verification step.

| # | Patch | Priority | Status |
|---|-------|----------|--------|
| 1 | Session Header + Resume Card | P0 | ✅ Done — verified resume card exists |
| 2 | Life Map Progress Pill | P0 | ✅ Done — pill + shelf + animations |
| 3 | Spider Chart Label Clipping | P1 | ✅ Done — labels prop + abbreviations |
| 4 | Bottom-Anchor Chat | P1 | ✅ Done — proximity-aware scroll |

---

## Patch 1: Session Header — Verification Only

### Status

`SessionHeader`, `ExitConfirmationSheet`, and `BottomTabBar` suppression are all committed on `feat/tab-bar-session-exit-ux`. The exit flow (3-message threshold, silent discard, pause sheet) is fully implemented.

### Verification Required

**Check if "Resume session" card exists on home screen.** The spec says paused sessions must surface a resume card. The home data already passes `activeSessionId` / `activeSessionType`, but it's unclear if `HomeScreen` renders the card visually.

#### Files to Check

- [components/home/home-screen.tsx](components/home/home-screen.tsx) — does it render a resume card when `activeSessionId` is present?
- [components/home/active-session-card.tsx](components/home/active-session-card.tsx) — this likely exists; confirm it's displayed

#### If Resume Card Is Missing

Add the `ActiveSessionCard` to `HomeScreen` using the `activeSessionId` prop already available from `getHomeData()`. The card should appear above the weekly check-in prompt if a `life_mapping` session is active.

#### Acceptance Criteria (Patch 1)

- [ ] User exits mid-session (≥ 3 messages) → taps "Pause & Exit" → home screen shows "Resume session" card
- [ ] Tapping the card navigates back to `/chat` with the active session
- [ ] Session with < 3 user messages exits silently — no card on home
- [ ] Completed sessions show no exit button (confirmed by `onExit={sessionCompleted ? undefined : handleExit}` pattern)

---

## Patch 2: Life Map Progress Pill

### Problem

No mobile progress indicator exists during life mapping sessions. The R3 desktop sidebar doesn't translate to mobile. Users have no visibility into how much of their life map has been explored.

### Architecture Decision (Resolve Before Starting)

**Critical question:** How does `isStreaming` and `lastCompletedDomain` (signals that live in `ChatView` state) reach the pill component?

The `SidebarContext` (`components/chat/sidebar-context.tsx`) already bridges ChatView signals to sidebar components. **Recommended approach:** Extend `SidebarContext` with two new fields:

```typescript
// components/chat/sidebar-context.tsx — extend interface
interface SidebarContextValue {
  activeDomain: string | null
  setActiveDomain: (domain: string | null) => void
  // Add:
  isStreaming: boolean
  setIsStreaming: (v: boolean) => void
  lastCompletedDomain: string | null
  setLastCompletedDomain: (domain: string | null) => void
}
```

`ChatView` sets these when streaming state changes and when a `[FILE_UPDATE type="domain"]` block is parsed. The pill reads them via `useSidebarContext()`.

> **Alternative:** Render the pill inside `ChatView`'s JSX directly (not a true sibling). This avoids context changes but makes `ChatView` more complex. Recommended against.

### Component Architecture

```
┌─────────────────────────────┐
│  SessionHeader (z-30)       │  flex-shrink-0 — already rendered
├─────────────────────────────┤
│  LifeMapProgressPill (z-20) │  flex-shrink-0 — NEW (life_mapping + mobile only)
├─────────────────────────────┤
│  Chat Messages (scroll)     │  flex-1, overflow-y-auto
├─────────────────────────────┤
│  ChatInput (z-20)           │  fixed bottom
└─────────────────────────────┘
```

### Files to Create / Modify

#### New Files

**`components/chat/life-map-progress-pill.tsx`** — Main pill component

```typescript
// Collapsed pill layout:
// [✦ SparklesIcon] "Life Map" [● dot×8] "3 of 8" [˅ ChevronDown]

// Props
interface LifeMapProgressPillProps {
  domains: PillDomain[]          // 8 domains in fixed order
  exploredCount: number
  currentlyAnimating: boolean    // from SidebarContext.isStreaming
  lastCompletedIndex: number | null
  onToggle: () => void
  isExpanded: boolean
}

// Tunable constants (top of file)
const AUTO_EXPAND_DURATION = 3000
const FLASH_TEXT_DURATION = 2000
const PILL_SCALE_DURATION = 0.6
const DOT_FILL_DURATION = 0.4
```

**`components/chat/life-map-pill-shelf.tsx`** — Expanded shelf overlay

```typescript
// Shelf contains:
// 1. Close button (absolute top-right, XIcon)
// 2. SpiderChart — RadarChart component at 180px, with abbreviated labels
// 3. Domain grid — 4 columns, compact domain slots
// 4. Emerging patterns section (if exploredCount >= 2)

// Spring animation config
const SHELF_SPRING = { stiffness: 200, damping: 25 }
```

**`components/chat/domain-slot-compact.tsx`** — Compact domain slot for pill grid

```typescript
// 36×36 rounded-xl icon container
// Domain name (10px, truncated to first word if > 8 chars)
// Rating (9px, amber, explored only) — uses 1–5 scale from pulse check

// Just-completed animation:
// spring scale [0.8 → 1], stiffness: 300, damping: 15
// Icon pulse [1 → 1.2 → 1], 0.5s
// Background color: gray → amber
```

#### Files to Modify

**`components/chat/sidebar-context.tsx`** — Add `isStreaming`, `setIsStreaming`, `lastCompletedDomain`, `setLastCompletedDomain`

**`components/chat/chat-view.tsx`**:
- Set `SidebarContext.isStreaming` when `isStreaming` state changes
- Set `SidebarContext.lastCompletedDomain` when a `file_update` with `fileType === 'domain'` is parsed (around line 831)
- Render `<LifeMapProgressPill>` between `SessionHeader` and the messages scroll div
- Pill renders only when `sessionType === 'life_mapping' && !showPulseCheck && isMobile`
- Use a `useMediaQuery` hook or inline window width check

**`components/ui/radar-chart.tsx`** — Add optional `labels?: string[]` prop

```typescript
// Before (line ~50):
interface RadarChartProps {
  domains: string[]
  // ...
}

// After:
interface RadarChartProps {
  domains: string[]
  labels?: string[]  // Optional abbreviated display labels; falls back to domains[]
  // ...
}
// Usage inside component: use labels[i] ?? domains[i] for rendering
```

### Data Model

```typescript
interface PillDomain {
  name: string        // Full domain name (e.g., "Career / Work")
  iconName: string    // Lucide icon key (e.g., "Briefcase")
  rating: number      // 1–5 from pulse check (NOT 0–10 — spec's range is incorrect)
  explored: boolean   // domain present in domainsExplored Set
  insight: string     // preview_line from file_index (via Supabase Realtime)
}
```

**Domain order (8 dots, fixed):**
```
Career / Work → Relationships → Health / Body → Finances →
Learning / Growth → Creative Pursuits → Play / Fun / Adventure → Meaning / Purpose
```

**Icon mapping** (defined in the pill component):
```typescript
// Briefcase, Heart, Activity, DollarSign, BookOpen, Palette, Gamepad2, Compass
```

### Visibility Guard

```typescript
// In chat-view.tsx, use a simple hook or inline check:
const isMobile = useMediaQuery('(max-width: 768px)')
// Render pill only when:
// isMobile && sessionType === 'life_mapping' && !showPulseCheck
```

The existing `LifeMapSidebar` already uses `hidden md:flex` — the pill is the inverse (`flex md:hidden`).

### Animation Reference

All animation constants live at top of `life-map-progress-pill.tsx`. Reference the Magic Patterns deliverable at `inspiration/20260219_Lifemap_pillbox.zip` for animation specifics:
- Shimmer: CSS shimmer overlay with `pointer-events: none` (V1 line 82–84)
- Dot fill: V4 lines 170–178
- Shelf spring: V1 lines 148–150

### Realtime Subscription

The pill needs `preview_line` (insight text) per domain. The desktop `LifeMapSidebar` already subscribes to `file_index` Postgres changes (lines 141–176). **Share this subscription via context** rather than duplicating it. Lift the subscription into `SidebarContext` or a new `useFileIndex` hook consumed by both sidebar and pill.

### Known Gaps to Address During Implementation

- **Shelf max-height:** Apply `max-h-[calc(100vh-180px)]` with `overflow-y-auto` inside the shelf panel to prevent overflow on small screens (iPhone SE: 667px viewport)
- **Auto-expand + streaming conflict:** Add a 300ms delay before auto-expand fires if `isStreaming` is true when `lastCompletedDomain` changes
- **Z-index correction:** The exit sheet uses `z-[50]` for panel and `z-[40]` for backdrop — ensure pill shelf at `z-20` and its backdrop at `z-30` don't conflict
- **Timer cancellation:** Any tap inside the shelf (not just pill + close button) should cancel the auto-collapse timer

### Acceptance Criteria (Patch 2)

- [ ] Pill renders below session header during life_mapping on mobile (≤ 768px)
- [ ] Pill does NOT render during weekly_checkin or on desktop
- [ ] Pill does NOT render during pulse check phase (`showPulseCheck: true`)
- [ ] 8 dot indicators accurately reflect `domainsExplored` Set
- [ ] Shimmer plays when Sage is streaming
- [ ] Dot fill animation fires when a domain is added to `domainsExplored`
- [ ] Flash text shows "{Domain} added!" for 2 seconds, then reverts to count
- [ ] Tapping pill toggles shelf open/closed
- [ ] Shelf contains: spider chart (180px, abbreviated labels), 4-col domain grid, emerging patterns (if ≥ 2 explored)
- [ ] Backdrop dims chat at 30% opacity; tapping it closes the shelf
- [ ] Auto-expand fires on domain completion (collapsed shelf → opens → 3s → closes)
- [ ] Auto-expand does NOT fire if shelf is already open
- [ ] Manual interaction during auto-expand cancels the timer
- [ ] Chevron rotates 180° when expanded
- [ ] Shelf has `max-height` constraint to prevent overflow on small screens
- [ ] No overlap with session header or input bar

---

## Patch 3: Spider Chart Label Clipping

### Problem

"Play / Fun / Adventure" (and potentially "Creative Pursuits", "Learning / Growth") clips on the spider chart edges. Long labels render outside the SVG viewport and get cut off by parent container overflow.

### Fix — Two Changes Required

#### A. Add optional `labels` prop to `RadarChart`

**File:** [components/ui/radar-chart.tsx](components/ui/radar-chart.tsx)

```typescript
// Current props interface (approximate line 12):
interface RadarChartProps {
  domains: string[]
  ratings: number[]
  // ...other props
}

// Add:
interface RadarChartProps {
  domains: string[]
  ratings: number[]
  labels?: string[]  // Abbreviated display labels — falls back to domains[] if omitted
  // ...other props
}

// In renderLabel function (line ~51), replace domains[i] with:
const displayLabel = (labels ?? domains)[i]
```

#### B. Pass abbreviated labels at call sites

**Three call sites:**

1. **Life map page** — [app/(main)/life-map/page.tsx](app/(main)/life-map/page.tsx) line ~212:
```tsx
const RADAR_LABELS = [
  'Career', 'Relationships', 'Health', 'Finances',
  'Learning', 'Creative', 'Play', 'Purpose'
]
// Add labels={RADAR_LABELS} to <RadarChart>
<RadarChart domains={radarDomains} ratings={...} labels={RADAR_LABELS} />
```

2. **Life map sidebar** — [components/chat/life-map-sidebar.tsx](components/chat/life-map-sidebar.tsx) line ~259:
```tsx
// Same RADAR_LABELS constant — extract to a shared lib/constants location
// Add labels={RADAR_LABELS}
```

3. **New pill shelf** (Patch 2) — pass same abbreviated labels array

**Shared constant location:** Add `RADAR_ABBREVIATED_LABELS` to [lib/constants.ts](lib/constants.ts) so all three call sites import from one place.

#### C. Ensure adequate container padding

At each call site, wrap `RadarChart` in a container with `px-16` (64px horizontal padding) to give labels room to render outside the chart radius without clipping.

```tsx
// Before:
<div className="mb-2">
  <RadarChart ... />
</div>

// After:
<div className="mb-2 px-16">
  <RadarChart ... />
</div>
```

> Note: The SVG already uses `overflow-visible`, so labels do render outside the SVG bounds. The clipping comes from the parent container having `overflow: hidden` or insufficient width. `px-16` provides the 64px breathing room needed.

### Acceptance Criteria (Patch 3)

- [ ] All 8 spider chart labels fully visible at 430px viewport width
- [ ] No label clipping on any edge (especially left: "Play", "Learning")
- [ ] Abbreviated labels used only in spider chart — full names everywhere else (domain cards, conversation, grid slots)
- [ ] `RADAR_ABBREVIATED_LABELS` constant defined once, imported at all three call sites

---

## Patch 4: Bottom-Anchor Chat

### Problem

New conversations open with messages at the top of the viewport, leaving a void between messages and the input bar. The current unconditional `scrollToBottom()` yanks users to the bottom when they've scrolled up to read history.

### Fix — Two Changes

#### A. Verify inner message container CSS (likely already correct)

**File:** [components/chat/chat-view.tsx](components/chat/chat-view.tsx) line ~990

The existing inner div already has `min-h-full flex flex-col justify-end space-y-4`, which is the correct CSS from the spec. Verify this is in place. If so, Patch 4A requires no code change.

#### B. Make `scrollToBottom` proximity-aware

**File:** [components/chat/chat-view.tsx](components/chat/chat-view.tsx) line ~192

```typescript
// Current (unconditional):
const scrollToBottom = useCallback(() => {
  if (scrollRef.current) {
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }
}, [])

// Replace with proximity-aware version:
const NEAR_BOTTOM_THRESHOLD = 100  // px — adjust after testing

const scrollToBottom = useCallback((force = false) => {
  if (!scrollRef.current) return
  const el = scrollRef.current
  const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
  if (force || distanceFromBottom < NEAR_BOTTOM_THRESHOLD) {
    el.scrollTop = el.scrollHeight
  }
}, [])
```

The `force` parameter is used for the initial load (first `useEffect` after session creation). Subsequent message arrivals use the proximity check.

**Update the `useEffect` call sites** (line ~198–200) to pass `force = true` only on initial mount/session start:

```typescript
// On initial load (once, when messages first arrive after session creation):
useEffect(() => {
  scrollToBottom(true)
}, [])  // empty deps — runs once on mount

// On subsequent message/streaming updates:
useEffect(() => {
  scrollToBottom()  // proximity-aware
}, [messages, streamingText, scrollToBottom])
```

### Acceptance Criteria (Patch 4)

- [ ] First message appears in lower portion of viewport (not top) in a new conversation
- [ ] Messages and input bar feel visually connected
- [ ] Scrolling up to read history works — new messages do NOT yank user back to bottom
- [ ] When user is near bottom (< 100px), new messages DO auto-scroll into view
- [ ] No layout jank on message addition
- [ ] Cross-browser: test in Safari (flex justify-end in scroll container has Safari quirks)

---

## Implementation Order

```
1. Patch 1 verification  (30 min)
   └── Read HomeScreen, check for ActiveSessionCard rendering
   └── If missing: add resume card display to home screen

2. Patch 3: Spider Chart  (1–2 hrs)
   └── Simplest, self-contained, unblocks Patch 2 (pill shelf needs abbreviated labels)
   └── Add labels prop to RadarChart
   └── Extract RADAR_ABBREVIATED_LABELS to lib/constants.ts
   └── Update 2 existing call sites + add px-16 padding

3. Patch 4: Bottom-Anchor  (1–2 hrs)
   └── Verify inner div CSS
   └── Replace scrollToBottom with proximity-aware version
   └── Fix useEffect call sites

4. Patch 2: Life Map Pill  (full day)
   └── Extend SidebarContext with streaming + completion signals
   └── Create DomainSlotCompact component
   └── Create LifeMapPillShelf component (RadarChart + domain grid + patterns)
   └── Create LifeMapProgressPill component (collapsed state + animations)
   └── Wire into ChatView (render between SessionHeader and scroll div)
   └── Set SidebarContext values from ChatView streaming/domain-completion events
```

---

## Technical Considerations

### Performance
- Avoid `will-change` on always-rendered elements (pill is always visible during sessions). Only apply for the shimmer animation via a CSS class that's added/removed conditionally.
- Extract shimmer CSS animation to a static keyframe (not inline styles) to prevent per-render recreation.
- The Realtime subscription for domain insights should be shared, not duplicated between sidebar and pill.

### Accessibility
- Pill toggle button: `aria-expanded={isExpanded}` + `aria-controls="life-map-shelf"`
- Shelf backdrop: `aria-hidden="true"` (decorative)
- Shelf panel: `role="dialog"` with `aria-label="Life map progress"`, `inert={!isExpanded}` when closed
- Exit confirmation sheet (already implemented): verify it has both `aria-hidden={!open}` and `inert={!open}`

### React Hook Hygiene
- No `createClient()` in `useCallback`/`useMemo` dependency arrays — call inside the handler
- `isOnboarding` and `isMobile` computed once with `useMemo`, not inline in callbacks
- No empty `.catch(() => {})` — capture exceptions at minimum with `console.error`

### Reduced Motion
```typescript
// In pill animations:
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
// Skip scale pulse, dot fill animation, shelf spring — use immediate transitions instead
```

---

## Open Questions (Decisions Before Patch 2)

| # | Question | Default If Unresolved |
|---|----------|-----------------------|
| Q1 | Where does `isStreaming` / `lastCompletedDomain` live? | Extend `SidebarContext` |
| Q2 | Does resume session card already exist on home screen? | Verify before starting |
| Q4 | What DB status does a "paused" session have? | `status: 'active'` (no change) |
| Q6 | Rating scale for pill — 1–5 or 0–10? | Use 1–5 (matches pulse check data) |
| Q7 | Should pill share LifeMapSidebar's Realtime subscription? | Yes, via context |
| Q12 | Max-height on the expanded shelf? | `max-h-[calc(100vh-180px)]` with overflow-y-auto |

---

## References

### Spec (Source of Truth)
- [Docs/feedback/20260219_R4b_patches_to_R4a.md](Docs/feedback/20260219_R4b_patches_to_R4a.md) — authoritative spec for all 4 patches

### Key Implementation Files
- [components/chat/chat-view.tsx](components/chat/chat-view.tsx) — main integration point (SessionHeader @ line 976, scroll div @ line 989, streaming state @ line 155, domainsExplored @ line 159)
- [components/chat/session-header.tsx](components/chat/session-header.tsx) — already implemented, reference for styling patterns
- [components/chat/exit-confirmation-sheet.tsx](components/chat/exit-confirmation-sheet.tsx) — reference for bottom sheet patterns
- [components/chat/life-map-sidebar.tsx](components/chat/life-map-sidebar.tsx) — desktop analog for pill (Realtime subscription pattern @ lines 141–176, RadarChart usage @ line 259)
- [components/chat/sidebar-context.tsx](components/chat/sidebar-context.tsx) — extend for streaming/completion signals
- [components/ui/radar-chart.tsx](components/ui/radar-chart.tsx) — add `labels` prop (label rendering @ line ~51)
- [lib/constants.ts](lib/constants.ts) — add `RADAR_ABBREVIATED_LABELS`
- [app/(main)/life-map/page.tsx](app/(main)/life-map/page.tsx) — radar chart call site @ line ~212

### Reference Implementation (Magic Patterns)
- `inspiration/20260219_Lifemap_pillbox.zip`
  - Primary pattern: `src/components/variations/V1ThinkingPill.tsx`
  - Dot indicator: `src/components/variations/V4BottomPeek.tsx` (lines 163–181)
  - Slot architecture: `src/components/ChatView.tsx` (topSlot prop)

### Related Commits / Branches
- `feat/tab-bar-session-exit-ux` — current branch, Patch 1 complete
- Commit: `feat(nav): tab bar session exit UX — visibility + exit affordance + pause flow`
