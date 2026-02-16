# MeOS Playtest Feedback — Feb 15, 2026

End-to-end test of fresh onboarding experience. This document captures all bugs, UX issues, and design changes to implement.

---

## 1. CRITICAL: Redesign Onboarding Pulse Check

### Why we're changing it

The current pulse check presents all 8 domains as a grid of rating buttons in a single scrollable card. This feels like a **survey form / intake questionnaire**, not the warm opening ritual the product needs. It triggers the exact "fill out this form" energy our target user (productivity tool bouncers, ADHD) has bounced off before. It contradicts our core design principle: "conversation IS the product."

### What to build

A new multi-step onboarding flow replacing the current single-card pulse check. An inspiration implementation has been generated and is available at:

**`/Users/tomoyukikano/Desktop/Projects/Kairn/inspiration/onboarding_pulse_check_experience.zip`**

Read that code for the interaction pattern and visual approach. Adapt it to fit our existing data model and design system (respect our colors and typography — `--color-primary: #D4A574`, `--color-bg: #FAF7F2`, dark warm gray text, Satoshi typeface). The flow should integrate with the existing pulse check data model and feed into the conversation the same way the current grid does.

### The new flow (4 screens):

**Screen 1: Sage Intro**
- Centered, minimal. Small Sage avatar/icon at top.
- "Hey — I'm Sage."
- "I'm going to help you build a map of where you are in life right now."
- Single "Let's go" CTA button in amber/gold

**Screen 2: Intent Selection — "What brought you here?"**
- Single question, full screen
- Heading: "What brought you here today?"
- Subtext: "No wrong answers — just helps me know where to start."
- 3-4 large tappable pill buttons stacked vertically:
  - "Feeling scattered — need more focus"
  - "Going through a transition"
  - "Want more clarity on what matters"
  - "Just curious"
- Tapping one selects it (amber highlight) and auto-advances after ~300ms
- Store the selection — Sage should reference it in the opening conversation

**Screen 3: Domain Pulse Check — one domain per screen, 8 total**
- One domain per full screen (NOT a grid)
- Progress indicator top-right: "1 of 8", "2 of 8", etc.
- Back arrow top-left
- Domain name as large, bold centered heading
- Horizontal row of 5 tappable circles on a connecting line (~48px touch targets)
- Left end labeled "Rough", right end labeled "Thriving" (small caps)
- "tap to rate" hint text that disappears after first selection
- On tap: selected circle fills with amber/gold, gentle scale animation, corresponding label fades in below (Rough / Struggling / Okay / Good / Thriving)
- Auto-advances to next domain after ~400ms delay
- Smooth crossfade or slide-left transition between domains
- First screen only shows italic instruction: "Quick gut check — don't overthink these." (fades after first card)
- Domain order: Career, Relationships, Health & Body, Finances, Learning & Growth, Creative Pursuits, Play & Adventure, Meaning & Purpose

**Screen 4: Summary — Radar Chart + CTA**
- Heading: "Here's your life snapshot"
- Radar/spider chart with 8 axes, filled with semi-transparent amber (#D4A574 at ~30% opacity), amber border line
- Chart animates drawing outward from center on appear
- Domain labels around perimeter
- Sage line below in warm italic: "I can see some patterns already. Ready to explore?"
- Large amber CTA: "Start Conversation"
- Small "Edit ratings" text link below for going back
- On "Start Conversation": transition to chat view where Sage's first message references the pulse check data (same as current behavior)

---

## 2. BUG: Voice Transcription Failure

Pressing the mic button does not transcribe audio or pass it to the conversation. Expected behavior: tap to record → tap to stop → audio transcribed → appears as user message. Currently nothing happens after recording.

---

## 3. BUG: Life Map Domain Cards Not Rendering Inline in Chat

Domain summary cards are supposed to appear inline in the conversation after Sage completes a domain exploration. Currently they don't render in the chat — the user has to navigate to the Life Map tab to see them. This breaks the core UX of "visible progress accumulating in real time" during the conversation. The domain cards appearing inline is the dopamine hit that shows value building as the user talks. Prioritize fixing this.

---

## 4. BUG: Stated Intentions Markdown Not Rendering

In the Life Map domain cards, the Stated Intentions section shows raw markdown artifacts:
- `s - **Immediate (next 2 weeks):**` with unrendered bold markers
- `s -` prefix appearing in output

This appears both in the collapsed card preview text (amber colored) and the expanded view. Either the structured output from Sage has a malformed prefix, or the parser isn't stripping it. Fix the parser to handle this correctly and render the markdown properly.

---

## 5. BUG: "I completed the pulse check" as First User Message

After completing the pulse check, the user's first message in chat appears as "I completed the pulse check." — the user shouldn't need to announce this. The system should detect pulse check completion and Sage should automatically begin the conversation referencing the ratings. This is a state machine gap.

---

## 6. UX: Status Label Confusion on Life Map Domain Cards

Finances card shows "Stable" in the top-right corner but "Initial pulse: Struggling" at the bottom. These feel contradictory and confusing. Pick one system:
- Either the pulse rating IS the displayed status
- Or Sage assigns a post-conversation status that replaces the pulse rating
- Don't show both simultaneously

---

## 7. UX: Unexplored Domain Cards Feel Dead

Six of eight domains show only the domain name and "Initial pulse: Good" — a lot of empty, lifeless space. Options:
- Collapse unexplored domains into a smaller section: "Not yet explored: Career, Relationships, Health..." as a compact list
- Or add a subtle CTA on each unexplored card: "Explore with Sage →" that initiates a conversation about that domain
- The current presentation makes the Life Map feel incomplete rather than in-progress

---

## 8. UX: Hide "What I'm Doing" Tab Until Life Plan Exists

The Life Map view has a "Where I Am" / "What I'm Doing" tab toggle, but there's no Life Plan data yet. Hide the second tab until there's content for it. Showing it now sets an expectation the product can't fulfill.

---

## 9. PROMPT TUNING: Sage Message Length

Sage's responses are consistently 4-5 paragraphs. This is too long — it reads as a monologue. Tune the system prompt to:
- Aim for 2-3 paragraphs max per turn
- End with ONE clear question
- Each turn should do 2 of these, not all 4: reflect, reframe, challenge, question
- Shorter messages create better conversational rhythm and will be essential for voice mode

---

## 10. PROMPT TUNING: Domain Transition Warmth

When Sage transitions between domains, it's currently clinical: "Okay, finances mapped. You rated Play as struggling too." A human coach would add a brief emotional beat — a one-line acknowledgment that the previous topic was heavy/meaningful before pivoting. Add this to the system prompt guidance for domain transitions.

---

## Priority Order

1. **Onboarding redesign** (Screen 1-4 flow above) — biggest UX impact
2. **Domain cards not rendering inline in chat** — core experience broken
3. **Voice transcription bug** — blocks voice-first interaction
4. **Stated intentions markdown parsing** — breaks Life Map "wow" moment
5. **Auto-detect pulse check completion** (remove "I completed the pulse check")
6. **Sage message length tuning**
7. **Status label confusion**
8. **Unexplored domain card treatment**
9. **Hide "What I'm Doing" tab**
10. **Domain transition warmth**