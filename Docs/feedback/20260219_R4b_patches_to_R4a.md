# MeOS R4.2 Implementation Spec

**Date:** 2026-02-19
**Status:** Active — source of truth for Claude Code
**Context:** Playtest R4B revealed critical gaps after R4.1 patches. This spec covers all remaining fixes needed before external demos.

---

## Priority Order

| # | Patch | Priority | Status |
|---|-------|----------|--------|
| 1 | Session Header | P0 — users trapped | 🔧 Claude Code working on this |
| 2 | Life Map Progress Pill | P0 — sidebar breaks mobile | Spec ready, awaiting implementation |
| 3 | Spider Chart Label Clipping | P1 — cosmetic | Spec ready |
| 4 | Bottom-Anchor Chat | P1 — polish | Spec ready |

---

## Patch 1: Session Header (Lightweight — Claude Code In Progress)

**Problem:** Users are trapped in conversations with no exit affordance. When the tab bar hides during active sessions, there's no way to leave.

**Requirements:**

- Render a top bar when tab bar is hidden during any active session
- **Left:** Back/exit button (← chevron or ✕ icon)
  - If conversation has **< 3 messages**: exit silently, discard session, return to home
  - If conversation has **≥ 3 messages**: show confirmation bottom sheet — "Want to pause this session? You can pick up where you left off." with "Pause & Exit" and "Keep Going" buttons
  - Paused sessions surface a "Resume session" card on the home screen
- **Center:** Session type label + estimated duration (e.g., "Life Mapping · ~25 min")
- **Right:** Empty for now (future: elapsed time, overflow menu)
- Styling: subtle, translucent or matching background. Small text. Conversation is the focus, not chrome.

**Onboarding-specific behavior:**
- Show back/exit affordance on every onboarding screen (intake, pulse check, life mapping)
- If user exits during intake/pulse check: save progress, next open resumes exact step
- If user exits during life mapping conversation: save state, show "Resume your life mapping" card on home
- Label: "Save & finish later" to reduce abandonment anxiety

**Acceptance Criteria:**
- [ ] Session header visible at top during all active sessions
- [ ] Exit flow works with message-count threshold
- [ ] Paused sessions show resume card on home
- [ ] No overlap with other UI elements (pill renders below this header)

---

## Patch 2: Life Map Progress Pill — Full Behavioral Spec

### Overview

Replace the R3 desktop "Evolving Artifact Sidebar" with a mobile-optimized indicator on viewports ≤ 768px. The pill is a persistent, compact status bar that sits below the session header during life mapping sessions. Tapping it reveals an expandable shelf overlay showing the full life map state.

**Design decision:** V1 Thinking Pill from Magic Patterns + V4 dot indicators. Top position chosen over bottom because top is "status and context" territory (doesn't compete with input bar for thumb zone). Dots borrowed from V4 for at-a-glance progress without needing to expand.

### Reference Code

Magic Patterns deliverable at `/Users/tomoyukikano/Desktop/Projects/Kairn/inspiration/20260219_Lifemap_pillbox.zip`:
- **Primary pattern:** `src/components/variations/V1ThinkingPill.tsx`
- **Dot indicator pattern:** `src/components/variations/V4BottomPeek.tsx` (lines 163–181)
- **Slot architecture:** `src/components/ChatView.tsx` — `topSlot` prop
- **Domain state hook:** `src/hooks/useLifeMap.ts`
- **Domain slot component:** `src/components/DomainSlot.tsx` (compact + full variants)
- **Spider chart:** `src/components/SpiderChart.tsx`

Use these as implementation reference. The behavioral spec below is authoritative where it differs from the mockup code.

---

### Component Architecture

```
┌─────────────────────────────┐
│  Session Header (Patch 1)   │  ← fixed, z-30
├─────────────────────────────┤
│  Life Map Progress Pill     │  ← fixed below header, z-20
├─────────────────────────────┤
│                             │
│    Chat Messages (scroll)   │  ← flex-1, overflow-y-auto
│                             │
├─────────────────────────────┤
│  Input Bar                  │  ← fixed bottom, z-20
└─────────────────────────────┘
```

The pill renders in the `topSlot` of ChatView (see `ChatView.tsx` line 85). It is a **sibling** to the session header, not a child. Both are `flex-shrink-0` so the chat area fills remaining space.

When the shelf expands, it overlays the chat area with a backdrop. The session header and input bar remain visible and interactive.

### Responsive Breakpoint

- **Mobile (viewport ≤ 768px):** Pill + expandable shelf (this spec)
- **Desktop (viewport > 768px):** R3 sidebar alongside chat (existing implementation, no changes)

The pill component should only render when the viewport is ≤ 768px AND the session type is life mapping. It does not appear during weekly check-ins, day planning, or other session types.

---

### Data Model

The pill reads from the existing life map state. Required interface:

```typescript
interface Domain {
  name: string;       // e.g. "Career", "Relationships", "Health"
  iconName: string;   // Lucide icon key: "Briefcase", "Heart", "Activity", etc.
  rating: number;     // 0–10, from pulse check or conversation
  explored: boolean;  // has Sage completed this domain's exploration?
  insight: string;    // one-line summary generated after domain exploration
}
```

**The 8 domains** (in order, matching spider chart axes):

| Domain | Icon | Abbreviated Label |
|--------|------|-------------------|
| Career | Briefcase | Career |
| Relationships | Heart | Relation… |
| Health | Activity | Health |
| Finances | DollarSign | Finances |
| Creative Pursuits | Palette | Creative |
| Play | Gamepad2 | Play |
| Learning | BookOpen | Learning |
| Meaning & Purpose | Compass | Purpose |

**State signals the pill consumes:**

| Signal | Type | Meaning |
|--------|------|---------|
| `domains` | `Domain[]` | Current state of all 8 domains |
| `exploredCount` | `number` | Count of `domains.filter(d => d.explored).length` |
| `currentlyAnimating` | `boolean` | True while Sage is actively updating the artifact (domain exploration in progress) |
| `lastCompletedIndex` | `number \| null` | Index of most recently completed domain. Resets to `null` after animation window (3s). |

These should come from a `useLifeMap` hook or equivalent state manager. See `src/hooks/useLifeMap.ts` for reference implementation.

---

### Collapsed State — The Pill

**Dimensions:** Full-width with horizontal padding (16px each side). Height: 44px. Rendered as a rounded-full button.

**Layout (left to right):**

```
[✦] Life Map [●●●○○○○○] 3 of 8 [˅]
```

| Element | Spec |
|---------|------|
| Sparkle icon (✦) | `SparklesIcon` from lucide-react, size 14px, color `amber` |
| "Life Map" label | 13px, font-medium, color `warm-gray` |
| Dot indicators | 8 circles, 10px diameter each, 6px gap between. Filled = `amber`, empty = `warm-gray-muted`. Order matches domain array. |
| Count | "3 of 8" — 13px, font-medium, color `warm-gray`. Accessibility fallback for dots. |
| Chevron | `ChevronDownIcon`, size 16px, color `warm-gray-light`. Rotates 180° when expanded. |

**Styling:**
- Background: `cream` (matches app background)
- Border: 1px `warm-gray-muted`
- The pill should feel like a subtle status bar, not a prominent button. It earns attention through animation, not visual weight.

#### Pill Animations

**1. Shimmer effect** — when `currentlyAnimating: true`
- A subtle left-to-right shimmer passes across the pill surface
- Border transitions to `amber/30` with a soft glow shadow
- Indicates Sage is actively processing/updating the life map
- Implementation: CSS shimmer overlay with `pointer-events: none` (see V1 line 82–84)

**2. Scale pulse** — on domain completion (`lastCompletedIndex` changes to non-null)
- Pill scales `[1 → 1.02 → 1]` over 0.6 seconds, ease-in-out
- Subtle enough to notice peripherally, not distracting enough to interrupt reading

**3. Dot fill** — when a domain completes
- The corresponding dot animates from gray to amber
- Scale animation: `[0 → 1.3 → 1]` over 0.4 seconds, ease-out (borrowed from V4, lines 170–178)
- The dot "pops" into existence

**4. Flash text** — on domain completion
- The "Life Map · 3 of 8 explored" text temporarily replaces with "{Domain Name} added!" for 2 seconds
- Fade transition between states
- After 2 seconds, reverts to standard count text

---

### Expanded State — The Shelf

Triggered by tapping the pill. The shelf is a panel that drops down from below the pill, overlaying the chat messages.

#### Open/Close Mechanics

**Opening:**
- User taps pill → shelf expands downward
- Spring animation: `stiffness: 200, damping: 25` (see V1 line 148–150)
- Initial state: `opacity: 0, height: 0, y: -10`
- Animate to: `opacity: 1, height: auto, y: 0`
- Chevron rotates to point up (180°, 0.3s transition)

**Closing — 3 methods, all equivalent:**
1. Tap the pill again (toggle)
2. Tap the ✕ close button inside the shelf
3. Tap the dimmed backdrop behind the shelf

All three clear any auto-collapse timer and set `isExpanded: false`.

**Backdrop:**
- Semi-transparent overlay covering the chat area below the shelf
- Color: `warm-gray` at 30% opacity (`bg-warm-gray/30`)
- Fades in over 0.3 seconds
- Tap to dismiss (calls `closePanel`)
- Does NOT cover the session header above or input bar below

#### Shelf Contents

The shelf is a `rounded-2xl` card with `cream` background, subtle border, and warm shadow. Internal padding: 16px.

**Layout (top to bottom):**

**1. Close button** — absolute positioned top-right (12px, 12px). 28px circle, `warm-gray-muted/50` background. `XIcon` at 14px.

**2. Spider chart** — centered, 180px × 180px. Shows all 8 domain axes with filled areas for explored domains. This is the same `SpiderChart` component used elsewhere in the app.

Label abbreviations for spider chart to prevent clipping:
- "Creative Pursuits" → "Creative"
- "Meaning & Purpose" → "Purpose"
- All others use full name (they fit)

**3. Domain grid** — 4 columns, 12px gap. Each slot uses the `DomainSlot` component in `compact` variant:

Per slot (compact mode, see `DomainSlot.tsx` lines 35–103):
- 36px × 36px rounded-xl icon container
  - Explored: `amber/10` background, `amber` icon at strokeWidth 2
  - Not explored: `warm-gray-muted/60` background, `warm-gray-light` icon at strokeWidth 1.5
- Domain name below: 10px text, centered, truncated to first word if > 8 chars
- Rating below name (explored only): 9px bold `amber` text showing "{rating}/10"
- Just-completed animation: spring scale `[0.8 → 1]` with stiffness 300, damping 15. Icon container pulses `[1 → 1.2 → 1]` with background color transition from gray to amber.

**4. Emerging Patterns** — only shown when `exploredCount >= 2`
- Separated by a top border (`warm-gray-muted/50`)
- Header: "EMERGING PATTERNS" — 11px, semibold, uppercase, tracked wider, `warm-gray-light`
- Pattern text: 12px, `warm-gray-light`, relaxed line-height
- Content comes from Sage's cross-domain synthesis (stored in life map state)

---

### Auto-Expand Behavior

This is a key delight moment. When a domain exploration completes, the pill briefly auto-opens to show the user their progress building in real time — then quietly closes.

**Trigger:** `lastCompletedIndex` changes from `null` to a valid index.

**If shelf is currently collapsed:**
1. Set flash text to "{Domain Name} added!"
2. Auto-expand the shelf (`setIsExpanded(true)`)
3. Start auto-collapse timer: `AUTO_EXPAND_DURATION = 3000ms`
4. After 3 seconds, auto-collapse (`setIsExpanded(false)`, clear flash text)
5. If user manually interacts (taps pill or close button) during auto-expand, cancel the timer — user has taken control

**If shelf is currently expanded (user opened it manually):**
1. Set flash text to "{Domain Name} added!" for 2 seconds
2. Do NOT auto-collapse — user explicitly opened the shelf, respect that
3. Domain slot animates its just-completed state within the already-visible grid

**Tunable constant:**
```typescript
const AUTO_EXPAND_DURATION = 3000; // ms — adjust after user testing
```

This value should be easy to find and change. 3 seconds is the starting hypothesis. If playtests show users want more time to absorb, increase to 4–5 seconds. If it feels interruptive, decrease to 2 seconds.

---

### Visibility Rules

The pill appears when ALL of these are true:
- Viewport width ≤ 768px (mobile breakpoint)
- Active session type is "life_mapping"
- User has completed the pulse check and entered the conversation phase

The pill does NOT appear:
- During onboarding intake screens (name, pulse check sliders)
- During weekly check-in sessions
- During any non-life-mapping session type
- On desktop viewports (> 768px) — use sidebar instead

---

### Z-Index Hierarchy

Maintain this stacking order across the entire app:

| Layer | Z-Index | Element |
|-------|---------|---------|
| z-40 | 40 | Bottom sheets, confirmation modals |
| z-30 | 30 | Session header, shelf backdrop |
| z-20 | 20 | Pill (collapsed), shelf panel, input bar |
| z-10 | 10 | Chat messages |
| z-0 | 0 | Background |

The expanded shelf's backdrop sits at z-30 (covers chat), while the shelf panel itself sits at z-20 but renders above the backdrop due to DOM order. This matches the V1 implementation (lines 112–126 for backdrop, 130–197 for panel).

---

### Implementation Checklist

- [ ] Pill renders in `topSlot` below session header during life mapping on mobile
- [ ] 8 dot indicators show real-time domain exploration progress
- [ ] Dot fill animation fires when domain completes
- [ ] Flash text shows "{Domain} added!" on completion (2s duration)
- [ ] Shimmer effect plays when `currentlyAnimating` is true
- [ ] Tap pill toggles shelf open/closed
- [ ] Shelf contains spider chart (180px), domain grid (4-col compact), emerging patterns
- [ ] Backdrop dims chat when shelf is open
- [ ] Tap backdrop or ✕ closes shelf
- [ ] Auto-expand fires on domain completion (3s timer)
- [ ] Auto-expand does NOT fire if shelf is already open
- [ ] Manual interaction during auto-expand cancels the timer
- [ ] Chevron rotates 180° when expanded
- [ ] Desktop (> 768px) uses existing sidebar, pill does not render
- [ ] No overlap with session header, input bar, or chat content

---

## Patch 3: Spider Chart Label Clipping

**Problem:** "Play / Fun / Adventure" label clips on left edge of spider chart. Visible in R4B playtest.

**Fix:** Two changes, both required:

**A. Add padding to chart container:**
- Minimum 60px padding on left and right sides of the spider chart's parent container
- This gives long labels room to render without clipping

**B. Abbreviate domain labels in the spider chart:**

| Full Name | Spider Chart Label |
|-----------|--------------------|
| Career | Career |
| Relationships | Relationships |
| Health / Body | Health |
| Finances | Finances |
| Creative Pursuits | Creative |
| Play / Fun / Adventure | Play |
| Learning / Growth | Learning |
| Meaning / Purpose | Purpose |

These abbreviated labels are used **only** in the spider chart component. Full names appear in domain cards, domain grid slots, and conversation text.

**Acceptance Criteria:**
- [ ] All 8 spider chart labels fully visible at all viewport widths (430px minimum)
- [ ] No text clipping on any edge
- [ ] Labels readable at the smallest supported size

---

## Patch 4: Bottom-Anchor Chat

**Problem:** Chat messages still have empty space above them at conversation start. First message floats at top of viewport instead of near the input bar. Creates a disconnected, "lonely" feeling.

**Fix:** Chat container should anchor messages to the bottom of the available space.

```css
.chat-scroll {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-height: 100%;
}
```

**Behavior:**
- **Few messages (don't fill viewport):** Messages cluster near the bottom, close to the input bar. The empty space is above them, not below.
- **Many messages (fill or exceed viewport):** Normal scrolling behavior. Newest message at bottom, user can scroll up to see history.
- **New message arrives:** Auto-scroll to bottom so newest message is visible. Only auto-scroll if user is already near the bottom (within ~100px). If user has scrolled up to read history, don't yank them down.

**Acceptance Criteria:**
- [ ] First message in a new conversation appears in lower portion of viewport
- [ ] Messages and input bar feel visually connected (not separated by void)
- [ ] Scrolling works naturally as conversation grows
- [ ] Auto-scroll on new message (only when user is near bottom)
- [ ] No layout jank when messages are added

---

## Appendix: Animation Constants Reference

All animation values in one place for easy tuning:

```typescript
// Pill animations
const PILL_SCALE_PULSE = [1, 1.02, 1];       // scale keyframes
const PILL_SCALE_DURATION = 0.6;              // seconds
const DOT_FILL_SCALE = [0, 1.3, 1];          // scale keyframes
const DOT_FILL_DURATION = 0.4;               // seconds
const FLASH_TEXT_DURATION = 2000;             // ms
const SHIMMER_DURATION = 1.5;                 // seconds, one pass

// Shelf animations
const SHELF_SPRING_STIFFNESS = 200;
const SHELF_SPRING_DAMPING = 25;
const CHEVRON_ROTATE_DURATION = 0.3;         // seconds
const BACKDROP_FADE_DURATION = 0.3;          // seconds

// Auto-expand
const AUTO_EXPAND_DURATION = 3000;           // ms — primary tuning knob

// Domain slot (compact, just-completed)
const SLOT_SPRING_STIFFNESS = 300;
const SLOT_SPRING_DAMPING = 15;
const SLOT_ICON_PULSE = [1, 1.2, 1];         // scale keyframes
const SLOT_ICON_PULSE_DURATION = 0.5;        // seconds
```

---

## Appendix: Domain Icon Mapping

For the `DomainSlot` component — maps domain `iconName` to Lucide React components:

```typescript
import {
  BriefcaseIcon,    // Career
  HeartIcon,         // Relationships
  ActivityIcon,      // Health
  DollarSignIcon,    // Finances
  PaletteIcon,       // Creative Pursuits
  Gamepad2Icon,      // Play
  BookOpenIcon,      // Learning
  CompassIcon        // Meaning & Purpose
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Briefcase: BriefcaseIcon,
  Heart: HeartIcon,
  Activity: ActivityIcon,
  DollarSign: DollarSignIcon,
  Palette: PaletteIcon,
  Gamepad2: Gamepad2Icon,
  BookOpen: BookOpenIcon,
  Compass: CompassIcon,
};
```