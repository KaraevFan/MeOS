# Playtest R4.1 — Implementation Spec

**Date:** 2026-02-19
**Scope:** Critical fixes from Playtest R4 observations
**Priority:** Ship all patches in this spec before moving to new feature work

---

## Overview

Playtest R4 revealed a set of UX issues that fall into three categories:

1. **Layout/visual bugs** that break key screens (spider chart overlap, markdown rendering, chat anchoring)
2. **State management gaps** where the app doesn't distinguish new users from returning users (tab bar, FAB, pulse check data)
3. **Viewport framing** inconsistency between screens on desktop

This spec addresses all three with nine patches, ordered by priority.

---

## Patch 1: Fix Spider Chart Text Overlap on Life Snapshot Screen

**Priority:** P0 — most visually broken screen in the app
**Screen:** Post-pulse-check "Here's your life snapshot" view

### Problem

The AI-generated synthesis blurb text renders directly on top of the spider chart's axis labels. "Creative Pursuits," "Finances," and "Learning / Growth" labels overlap with paragraph text. The "Start Conversation" CTA button also overlaps the blurb. The entire bottom half of the screen is an unreadable mess of layered text.

### Root Cause (likely)

The synthesis blurb is probably positioned absolutely or has insufficient top margin, and the spider chart container doesn't have a fixed/minimum height that accounts for its labels. The labels themselves may be positioned absolutely relative to the chart SVG and extending outside the chart's layout box.

### Fix

1. **Contain the spider chart in a fixed-height wrapper.** The wrapper must include space for all 8 axis labels. Recommended approach:
   - Chart SVG/canvas: constrain to roughly 60-70% of viewport width, centered
   - Padding around the chart: minimum 60px on all sides to accommodate labels
   - Total chart container height: fixed at roughly 350-400px on mobile (scale proportionally)
   - Labels should be positioned with enough offset from chart vertices that they never overlap the polygon area

2. **Stack content below the chart in normal document flow.** No absolute positioning. The layout from top to bottom should be:
   - Title: "Here's your life snapshot"
   - Subtitle: "a map, not a grade"
   - Spacer (16-24px)
   - Spider chart container (fixed height, self-contained)
   - Spacer (24px)
   - Synthesis blurb text (normal flow, full-width with horizontal padding)
   - Spacer (24px)
   - "Start Conversation" CTA button
   - Spacer (12px)
   - "Edit ratings" link
   - Bottom padding (40px)

3. **Consider abbreviating long domain labels.** If label overlap persists even with proper spacing:
   - "Play / Fun / Adventure" → "Play / Fun"
   - "Creative Pursuits" → "Creative"
   - "Learning / Growth" → "Learning"
   - "Meaning / Purpose" → "Purpose"
   - "Health / Body" → "Health"

### Acceptance Criteria

- [ ] No text overlaps anywhere on the life snapshot screen at any viewport width
- [ ] Spider chart labels are fully readable and don't touch the polygon edges
- [ ] Synthesis blurb is fully readable below the chart
- [ ] CTA button is clearly separated from surrounding text
- [ ] Scrollable if content exceeds viewport height

---

## Patch 2: Fix Pulse Check Data Injection into Life Mapping Conversation

**Priority:** P0 — core functionality broken
**Screen:** Chat view, life mapping session

### Problem

After completing the pulse check (rating all 8 domains), Sage's opening message in the life mapping conversation says "Rate each of these areas" — indicating it has no knowledge of the ratings the user just submitted. When the user asks "Can you not refer to the pulse check ratings I passed along?", Sage acknowledges it should have them but was ignoring them. The pulse check data is either not being passed into the system prompt / conversation context, or it's being passed in a format Sage isn't recognizing.

### Fix

1. **Verify the data pipeline:** After pulse check completion, the ratings object (domain name → 1-5 score) must be:
   - Saved to the database (likely already happening if the spider chart renders correctly)
   - Injected into the system prompt or first message context when the life mapping conversation initializes

2. **System prompt injection format.** The pulse check data should appear in Sage's system prompt as something like:

```
The user just completed a pulse check. Here are their self-ratings (1 = Rough, 5 = Thriving):

- Career / Work: 4
- Relationships: 3
- Health / Body: 4
- Finances: 3
- Creative Pursuits: 2
- Play / Fun / Adventure: 2
- Learning / Growth: 4
- Meaning / Purpose: 4

The user also selected their current life context as: "[intake answer, e.g. 'I'm feeling stuck or scattered']"

Use these ratings to guide the conversation. Focus on the lowest-rated domains first. Do NOT ask the user to rate domains again — you already have their ratings. Reference specific ratings naturally (e.g., "You rated Creative Pursuits a 2 — that stood out to me. What's going on there?").
```

3. **Remove Sage's default "rate each of these areas" opening.** The opening message should acknowledge the pulse check was completed and reference specific findings. The system prompt should instruct Sage to skip any intake/rating steps and go straight into domain exploration.

4. **Also inject the spider chart synthesis blurb** if one was generated — so Sage has access to the same narrative the user just read and can reference it.

### Acceptance Criteria

- [ ] Sage's opening message references specific pulse check ratings by name and number
- [ ] Sage does NOT ask the user to rate domains
- [ ] Sage proposes starting with the lowest-rated domains
- [ ] The intake question answer (e.g., "I'm feeling stuck or scattered") is referenced naturally in the opening

---

## Patch 3: Tab Bar & FAB Visibility State Machine

**Priority:** P0 — affects first impression for every new user
**Scope:** Global navigation behavior

### Problem

The bottom tab bar (Home, Chat, Life Map, History) and the floating action button (FAB mic) are always visible, including during onboarding and active sessions. This creates several issues:

- New users can tap into empty Life Map/History screens before onboarding
- The FAB routes to "Open Your Day" for users who haven't completed life mapping
- During active sessions, there are two competing mic buttons (input bar + FAB)
- The tab bar overlaps with the chat input bar and bottom sheets

### Design Rules

Implement a visibility state machine based on two dimensions: **onboarding status** and **session state**.

```
STATE: pre_onboarding (user has not completed life mapping)
  Tab bar: HIDDEN
  FAB: HIDDEN
  Navigation: None — user is in the onboarding funnel only

STATE: post_onboarding + no_active_session
  Tab bar: VISIBLE
  FAB: VISIBLE (routes to time-appropriate action: Open the Day / Close the Day / Talk to Sage)
  Navigation: Full — all tabs accessible

STATE: post_onboarding + active_session (any session type)
  Tab bar: HIDDEN
  FAB: HIDDEN
  Navigation: Session header replaces tab bar (see below)
```

### Session Header (replaces tab bar during active sessions)

When the tab bar is hidden during an active session, render a **top session bar** with:

- **Left:** Exit/pause button (← chevron icon or ✕)
  - On tap: if conversation has 3+ messages, show confirmation bottom sheet: "Want to pause this session? You can pick up where you left off." with two buttons: "Pause & Exit" (saves state, returns to home, home shows "Resume session" card) and "Keep Going" (dismisses sheet)
  - On tap: if conversation has 0-2 messages, exit silently, discard session, return to home
- **Center:** Session type label + estimated time (e.g., "Life Mapping · ~25 min", "Closing Your Day", "Weekly Check-in")
- **Right:** Empty for now (future: elapsed time, overflow menu)

**Styling:** The session header should be subtle — not a heavy navigation bar. Translucent or matching the background, with small text. The conversation is the focus, not the chrome.

### Onboarding Exit Behavior

During the onboarding flow specifically (intake question → pulse check → life mapping conversation):

- Show a back/exit affordance in the top-left corner of every onboarding screen
- If user exits during intake question or pulse check: save progress, next app open resumes at the exact step they left
- If user exits during the life mapping conversation: save conversation state, next app open shows home with "Resume your life mapping" card
- Label the exit affordance "Save & finish later" (tooltip or text, not just an icon) during onboarding to reduce abandonment anxiety

### FAB Behavior Detail

- When visible (post-onboarding, no active session), the FAB should check time of day and onboarding state:
  - Before noon + no Open the Day completed today → routes to Open the Day session
  - After 5pm + no Close the Day completed today → routes to Close the Day session
  - Otherwise → routes to general "Talk to Sage" conversation
- When the tab bar animates out (session starts), the FAB should animate out with it
- When the tab bar animates back in (session ends/pauses), the FAB animates back

### Acceptance Criteria

- [ ] Brand new user sees NO tab bar and NO FAB on first app open
- [ ] Tab bar appears (with subtle animation) after life mapping completion
- [ ] Tab bar and FAB hide when any session starts
- [ ] Session header appears at top during active sessions
- [ ] Exit/pause button works correctly with the 3+ message threshold for confirmation
- [ ] Paused sessions show a "Resume" card on home screen
- [ ] FAB routes to the correct session type based on time of day
- [ ] No overlap between tab bar and any other UI element

---

## Patch 4: Fix Raw Markdown Rendering in Chat Bubbles

**Priority:** P1
**Screen:** Chat view

### Problem

Sage's messages show raw markdown syntax instead of rendered formatting. For example, `**Creative Pursuits**` displays as literal asterisks around the text instead of rendering as **bold**.

### Fix

Run Sage's message text through a markdown renderer before displaying in chat bubbles. Use a lightweight renderer (e.g., `react-markdown` or a simple regex-based bold/italic handler) that supports at minimum:

- `**bold**` → bold text
- `*italic*` → italic text
- Line breaks / paragraph spacing

Do NOT render full markdown (headers, code blocks, tables, etc.) in chat bubbles — this isn't a document, it's a conversation. Just bold, italic, and paragraph breaks.

### Acceptance Criteria

- [ ] Bold text renders as bold in all Sage messages
- [ ] Italic text renders as italic
- [ ] No raw asterisks visible in any chat message
- [ ] Paragraph breaks render correctly (blank line between paragraphs)

---

## Patch 5: Bottom-Anchor Chat Messages

**Priority:** P1
**Screen:** Chat view

### Problem

The conversation starts at the top of the viewport with massive empty space above the messages. On desktop, the first few messages appear in the middle of the screen with nothing above them, making the chat feel ungrounded and disconnected from the input bar at the bottom.

### Fix

Chat messages should be bottom-anchored:

1. The chat container should use `display: flex; flex-direction: column; justify-content: flex-end;` (or equivalent) so messages stack from the bottom up
2. When there are few messages, they should appear near the bottom of the viewport, close to the input bar
3. When messages fill the viewport, normal scrolling behavior — newest messages at bottom, scroll up for history
4. Auto-scroll to bottom on new message (both user-sent and Sage responses)

The session type label ("Life Mapping · ~25 min") can remain at the top of the chat area as a header, with messages growing upward from the bottom.

### Acceptance Criteria

- [ ] First message in a new conversation appears near the bottom of the viewport, not the top
- [ ] Input bar and most recent message are visually close together
- [ ] Scrolling works naturally as conversation grows
- [ ] New messages auto-scroll into view

---

## Patch 6: Pulse Check Circle Contrast & Feedback

**Priority:** P1
**Screen:** Pulse check (domain rating screens)

### Problem

The rating circles (1-5 scale) are nearly invisible against the cream background. The Rough-end circles are faint pink wisps and the Thriving-end circles are barely-visible gray. Users may not realize these are interactive elements. The "ROUGH" and "THRIVING" labels are also low-contrast.

### Fix

1. **Increase unselected circle saturation significantly.** The color gradient from Rough (1) to Thriving (5) should be clearly visible even in the unselected state. Suggested colors:
   - Circle 1 (Rough): muted terracotta/red, e.g., `#E8A598` unselected, `#D4725C` selected
   - Circle 2: muted orange, e.g., `#E8C498` unselected, `#D4A05C` selected
   - Circle 3 (Middle): warm amber, e.g., `#E8D898` unselected, `#D4BC5C` selected
   - Circle 4: warm sage, e.g., `#A8D4A0` unselected, `#6BB85E` selected
   - Circle 5 (Thriving): clear green, e.g., `#88C490` unselected, `#4AA85C` selected

2. **Selected state feedback:** When a circle is tapped:
   - Scale up slightly (1.0 → 1.15 with spring animation)
   - Fill deepens to the selected color
   - Number (1-5) appears inside the circle in white text
   - Subtle haptic feedback if available (mobile)

3. **Label contrast:** "ROUGH" and "THRIVING" labels should be darker — use the body text color (dark warm gray) instead of the current light color. Consider making them slightly smaller but bolder.

4. **Add "tap to rate" hint:** Keep the existing "tap to rate" text below the circles but make it slightly more visible. After the user taps their first circle, this text can fade out.

### Acceptance Criteria

- [ ] All 5 rating circles are clearly visible and obviously interactive before any tap
- [ ] Color gradient from red → green is apparent across the 5 circles
- [ ] Selected circle has clear visual differentiation (color change + scale + number)
- [ ] "ROUGH" and "THRIVING" labels are easy to read
- [ ] Circles have smooth, satisfying tap animation

---

## Patch 7: Simplify Chat Input Bar During Active Conversations

**Priority:** P1
**Screen:** Chat view (all session types)

### Problem

The current input bar has a large amber mic orb (left), a text field (center), and a send button (right). The mic orb is visually dominant and competes with the FAB mic in the tab bar (addressed in Patch 3). The oversized mic button also makes the text field look disproportionately tall and the send button looks unanchored.

### Design

Restructure the input bar for mid-conversation use:

```
[ 🎙 ] [ Type a message...                    ] [ ➤ ]
  mic      text field (takes most width)         send
```

- **Mic button:** Standard-sized icon button (40-44px), not an orb. Use a mic icon in warm gray. When recording, the icon turns amber and a subtle pulse/waveform appears. The mic button should be to the LEFT of the text field.
- **Text field:** Takes remaining width. Single line, expanding to multi-line as text is entered. Rounded corners, subtle border. Placeholder: "Type a message..."
- **Send button:** Same size as mic button (40-44px). Arrow/send icon. Only becomes active (amber) when text is present in the field.
- **Overall height:** Compact — roughly 48-56px for the input row, with padding.

### Voice Flow Change

Currently, voice input sends directly without the user seeing the transcription. Change to transcribe-to-field:

1. User taps mic → recording state (mic icon turns amber, subtle animation)
2. User taps mic again to stop → brief loading indicator
3. Transcribed text appears in the text field (user can review and edit)
4. User taps send to submit

This gives users confidence in what they're sending and catches transcription errors.

### Acceptance Criteria

- [ ] Mic button is a standard-sized icon, not an oversized orb
- [ ] Text field takes the majority of the input bar width
- [ ] Send button only activates when there's text to send
- [ ] Voice recording transcribes to the text field (does not auto-send)
- [ ] User can edit transcribed text before sending
- [ ] Input bar overall looks balanced and compact

---

## Patch 8: Consistent Phone Container on Desktop

**Priority:** P2
**Screen:** All screens (global layout wrapper)

### Problem

On desktop viewports, some screens render with a phone-frame container and others fill the full viewport. This inconsistency makes the app feel unfinished.

### Fix

Implement a global layout wrapper that enforces a consistent phone container on wide viewports:

```css
/* Mobile: full viewport, no container */
@media (max-width: 480px) {
  .app-shell {
    width: 100%;
    max-width: 100%;
    margin: 0;
    border-radius: 0;
    box-shadow: none;
    min-height: 100dvh;
  }
}

/* Tablet/Desktop: centered phone container */
@media (min-width: 481px) {
  .app-shell {
    max-width: 430px;
    margin: 0 auto;
    min-height: 100dvh;       /* or a fixed height like 860px */
    border-radius: 20px;      /* optional: rounded to feel like a device */
    box-shadow: 0 0 60px rgba(0, 0, 0, 0.08);
    overflow: hidden;
    position: relative;
  }

  body {
    background-color: #F0EDE8; /* warm neutral, slightly darker than app bg */
  }
}
```

### Key Details

- **Max-width: 430px** — standard modern phone width
- **All screens** must render inside this container, including onboarding, pulse check, chat, life map, and home
- **The tab bar** (when visible) should be fixed to the bottom of the container, not the browser viewport
- **The session header** (when visible) should be fixed to the top of the container
- **Bottom sheets and modals** should be constrained to the container width
- **Background color** outside the container should be a calm neutral — slightly darker/warmer than the app background to create a subtle "device" effect

### Important

This is a wrapper-level change. Do NOT rewrite individual screen layouts. Wrap the existing app root in this container and let everything inside it behave as if it's on a 430px-wide mobile viewport.

### Acceptance Criteria

- [ ] On desktop (>480px), app renders in a centered 430px container with subtle shadow
- [ ] On mobile (≤480px), app fills the full viewport with no visible container
- [ ] All screens (onboarding, chat, home, life map, history) render inside the container
- [ ] Tab bar and session header are fixed within the container, not the browser window
- [ ] Background outside the container is a warm neutral color
- [ ] No horizontal scrolling or overflow issues within the container

---

## Patch 9: Fix Bottom Sheet / Tab Bar Z-Index Overlap

**Priority:** P2
**Screen:** Profile/settings bottom sheet, and any future bottom sheets

### Problem

When a bottom sheet opens (e.g., the profile/account sheet showing the user's email), it renders behind or at the same z-index as the tab bar and FAB. The result is overlapping UI elements that are both unreadable and untappable.

### Fix

Establish a global z-index hierarchy:

```
z-index layers (lowest to highest):
  1   - Page content (chat messages, cards, etc.)
  10  - Tab bar
  15  - FAB
  20  - Session header
  50  - Bottom sheets
  60  - Bottom sheet backdrop/overlay
  100 - Modals and confirmation dialogs
  150 - Toast notifications
```

When a bottom sheet is open:
- It renders above the tab bar (z-index 50)
- A semi-transparent backdrop covers everything below it (z-index 60 for backdrop, but visually the backdrop sits between the sheet and the content)
- The tab bar and FAB are NOT visible through the backdrop
- Tapping the backdrop dismisses the bottom sheet

### Acceptance Criteria

- [ ] Bottom sheets render cleanly above the tab bar
- [ ] No overlapping text or buttons between bottom sheets and tab bar
- [ ] Backdrop dims content behind the bottom sheet
- [ ] Tapping backdrop dismisses the sheet
- [ ] FAB is not visible when a bottom sheet is open

---

## Implementation Order

For maximum impact with minimum risk of regressions, implement in this order:

1. **Patch 8** (phone container) — do this first because it constrains the viewport and may resolve some layout issues automatically
2. **Patch 3** (tab bar state machine) — large behavioral change, best done early
3. **Patch 1** (spider chart) — visual fix, self-contained
4. **Patch 2** (pulse check data injection) — critical functionality fix
5. **Patch 4** (markdown rendering) — small, isolated fix
6. **Patch 5** (bottom-anchor chat) — layout fix, low risk
7. **Patch 6** (pulse check contrast) — CSS-only, low risk
8. **Patch 7** (input bar simplification) — medium complexity, touches voice flow
9. **Patch 9** (z-index hierarchy) — may be partially resolved by Patch 3 hiding the tab bar

---

## Out of Scope for R4.a

The following items from the R4 test checklist are NOT addressed in this spec and will be covered in subsequent rounds:

- Close the Day session (Milestone 1)
- Open the Day session (Milestone 2)
- Quick Capture + Mid-Day (Milestone 3)
- Ghost session / home screen reliability
- Google Calendar OAuth
- Home card-stack layout
- R3 fix verification (artifact sidebar, emerging patterns, domain preview lines, etc.)

**Next step after R4.1:** Verify R3 fixes are working before layering daily rhythm features on top. Many R3 checklist items were untested in R4 — these need explicit verification in R4.2.