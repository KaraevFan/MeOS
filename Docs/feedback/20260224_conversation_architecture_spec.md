# Conversation Architecture Spec

**Date:** February 24, 2026
**Status:** Draft — ready for implementation planning
**Context:** Emerged from Playtest 7 findings. The orb's routing behavior exposed a deeper architectural question: what happens when the user just wants to talk to Sage outside of a structured flow?

---

## The Problem

MeOS currently treats conversations as discrete, typed sessions: Open the Day, Close the Day, Quick Capture, Weekly Check-In, Life Mapping. Each is a separate container with its own entry point, arc, and artifact output.

This creates three issues:

1. **The orb has no good default.** It's the most prominent UI element, but its behavior depends on time-of-day and session state. If you've already opened your day, tapping the orb routes you back into Open the Day — potentially overwriting your day plan or creating a duplicate session.

2. **There's no "just talk to Sage" option.** Every conversation must be a typed session. But users will have moments — "I'm stressed about tomorrow," "I just had an idea," "can we revisit my priorities?" — that don't map to any structured flow. Currently there's no home for these conversations.

3. **Structured flows feel rigid.** If a user enters Open the Day but actually wants to talk about something else, there's no graceful way to pivot. The session type is set at creation and the system prompt is locked to that arc.

---

## The Core Principle

**The conversation with Sage is always open. Structured flows are modes the conversation can enter and exit.**

Sage is always there. Open the Day and Close the Day are *skills* Sage can run — with a specific arc, structured beats, and an artifact at the end. But the default state isn't silence or a mode-selection screen. The default state is an open, context-rich conversation where Sage knows who you are, what your day looks like, and what you've been working on.

This maps directly to the existing design principle: "Sage IS the desktop." Users don't open separate module UIs — they talk to Sage, and Sage surfaces the right context, tools, and structured cards.

---

## Architecture: Two Layers

### Layer 1: Open Conversation (the base)

Always available. The universal mode. Sage has full context loaded:

- Current life map
- Today's day plan (if one exists)
- Last evening's journal entry
- Recent captured thoughts
- Active patterns and priorities
- Calendar events (when integrated)
- Session history summaries

In open conversation, Sage can:

- **Just talk.** "I'm anxious about the investor meeting" → coaching conversation. No artifact required. No structured arc. Just a thoughtful exchange.
- **Handle lightweight requests.** "Add 'call dentist' to my day" → Sage updates the day plan or stores a capture. Quick, no ceremony.
- **Triage into a structured flow.** "I want to redo my plan for today" → Sage enters day plan revision mode within the same conversation.
- **Surface something proactively.** "You mentioned wanting to start sketching on Saturday. Still on your radar?" → gentle continuity nudge.
- **Flex across domains.** User can talk about life map topics, day plan logistics, weekly reflection themes, or anything else — Sage routes contextually.

**Key property:** Open conversations do not require an artifact output. They may produce one (a capture, a day plan revision, an insight worth storing), but they don't have to. The conversation itself has value.

### Layer 2: Structured Sessions (modes within conversation)

Structured sessions are predefined conversational arcs with:

- **A specific entry trigger** (button, time-based suggestion, user request)
- **A defined sequence of beats** (e.g., Open the Day: Grounding → Highlight → Landscape → Coaching Moment → Send-off)
- **A terminal artifact** (day plan, journal entry, life map update, session summary)
- **A clear completion signal** (artifact generation marks the end of the structured arc)

Current structured session types:

| Session Type | Arc | Artifact | Duration |
|---|---|---|---|
| Open the Day | Energy check → Highlight → Landscape → Coaching → Send-off | Day Plan | ~2-3 min |
| Close the Day | Reflection prompt → Exploration → Acknowledgment → Close | Journal Entry | ~2-3 min |
| Weekly Check-In | Opening → Review vs. intentions → Pattern surfacing → Energy → Forward-looking | Session Summary + Life Map updates | ~5-10 min |
| Life Mapping | Pulse Check → Domain exploration → Synthesis | Life Map + Synthesis | ~20-30 min |

**How structured sessions relate to open conversation:**

- A structured session can be **entered from** an open conversation. User says "let's do my morning session" or Sage suggests it.
- A structured session can **exit into** an open conversation. After the day plan is set, the user might say "actually, can we talk about something else?" — Sage shifts back to open mode.
- A structured session can be **triggered directly** via explicit UI buttons (the chips, the "Begin morning session" card). In this case, the conversation starts in structured mode without passing through open conversation first.

---

## The Orb: Resolved

The orb becomes **"Talk to Sage"** — always, in every context. It opens an open conversation with full context loaded. Sage handles the contextual intelligence, not the button routing logic.

### What Sage Does on Open

Sage reads the current state and opens with the contextually appropriate prompt:

**No day plan today + morning hours:**
Sage's opening is the first beat of Open the Day — but as a suggestion, not a locked mode.

> "Morning, Tom. Want to set up your day, or is something else on your mind?"

If the user engages with the morning flow, it enters the structured Open the Day arc. If they say "actually I want to talk about something," it stays in open conversation.

**Day plan exists + daytime:**
Sage opens with awareness of the current day state.

> "Hey — your day's in motion. What's up?"

User can talk about anything. If they say "I need to change my plan" or "I finished my main thing," Sage handles it conversationally — no need to re-enter a structured session.

**Evening hours:**
Sage suggests Close the Day — but doesn't force it.

> "Hey Tom. Want to close out the day, or just want to talk?"

Same flexibility: user can do the structured evening flow or just chat.

**Active session in progress:**
Orb resumes the existing session. No new session created.

### The Orb Never Needs Complex Routing

Because the orb always does the same thing (open a conversation with Sage), all the contextual intelligence lives in Sage's opening message and system prompt — not in the button's routing logic. This eliminates the overwrite/conflict risk entirely.

---

## Explicit Triggers Remain

The home screen chips (Open Day / Capture / Close Day) and dedicated buttons ("Begin morning session") still exist as explicit entry points into structured flows. These bypass Sage's contextual suggestion and go directly into the structured arc.

This honors the principle: **opinionated about defaults, permissive about access.**

- The orb is the opinionated default — it reads context and does the smart thing.
- The chips are permissive access — you can always manually start any session type.

### Edge Case: Structured Flow After Completion

If a user taps "Open Day" after already completing their morning session, Sage should acknowledge the existing plan rather than starting from scratch:

> "You already set your intention today: 'Schedule at least one user test.' Want to revise it, add something, or start fresh?"

This prevents data overwriting while giving the user full control.

---

## Session Data Model

Open conversations should be stored as a session type so they get the same transcript storage, summary generation, and history tracking as structured sessions.

```
session_type: enum (
  'life_mapping',
  'weekly_checkin',
  'open_day',
  'close_day',
  'open_conversation'   // NEW — the universal type
)
```

### Properties of Open Conversation Sessions

- **Transcript:** Stored in full, same as other session types.
- **Summary:** AI-generated post-session summary, same pipeline.
- **Artifact:** Optional. May produce captures, day plan edits, or nothing.
- **Completion:** Ends when the user exits or when conversation goes idle (configurable timeout, e.g., 30 min of no messages). No terminal artifact required.
- **History:** Appears in History view like other sessions, with summary and themes.
- **Structured flow transitions:** If an open conversation transitions into a structured flow (e.g., user says "let's do my evening reflection"), the session type can either:
  - **Option A:** Stay as `open_conversation` with a metadata flag noting that a structured arc was completed within it.
  - **Option B:** Spawn a new session of the structured type, linked to the open conversation.
  - **Recommendation:** Option A is simpler and avoids session proliferation. The artifact (journal entry, day plan) gets created regardless — the session type is just metadata.

---

## System Prompt Implications

### Open Conversation System Prompt

The open conversation prompt needs to be a superset — Sage should have all the context of every structured flow available, but without a locked arc. Key elements:

```
You are Sage, an AI life partner built into MeOS. The user has opened a 
conversation with you. You are not in a specific structured session (morning, 
evening, check-in). This is an open conversation.

You have full context:
- The user's life map (injected below)
- Today's day plan, if one exists (injected below)
- Last evening's journal entry (injected below)
- Recent captured thoughts (injected below)
- Session history summaries (injected below)
- Calendar events for today (injected below)
- Active patterns (injected below)

Your role:
- Be available for whatever the user needs right now
- If it's morning and no day plan exists, gently suggest opening the day — 
  but don't force it
- If it's evening, you can suggest closing the day — but don't force it
- If the user asks to modify their day plan, revise priorities, or do 
  something that maps to a structured flow, you can enter that mode naturally 
  within this conversation
- If the user just wants to talk, be present. Not everything needs to 
  produce an artifact.

You can produce structured outputs (day plan cards, journal entries, captures) 
if the conversation naturally leads there, but they are never required.

Same personality rules apply: warm, curious, concise, challenges with care.
```

### Structured Session Prompts

Existing structured session prompts (Open the Day, Close the Day, etc.) remain unchanged. They are used when the user explicitly triggers a structured flow via a button or chip.

### Context-Aware Opening

When Sage opens a conversation (via orb or any entry point), the opening message should be generated with awareness of:

1. **Time of day** — morning, midday, evening
2. **Existing day plan status** — none, in progress, completed
3. **Last session recency** — did they just finish something? Is this a cold open?
4. **Pending items** — uncompleted priorities, unresolved threads, due check-ins

This is a lightweight prompt prefix, not a full LLM call for routing. Sage's first message should feel natural and contextual, not like a menu.

---

## Protecting the Ritual Quality

### The Risk

If users can always "just chat," some will never do the structured morning or evening sessions. The ritual quality — focused, short, clear arc, satisfying artifact — could erode.

### The Mitigation

**Make structured flows the path of least resistance within open conversation.**

- When context strongly suggests a structured flow (morning + no day plan), Sage's opening in open conversation should *be* the first beat of that flow. The user enters the structured arc without even realizing they "chose" it — it just felt like natural conversation.
- Only if the user actively redirects ("actually, I want to talk about something else") does Sage shift to open mode.
- The explicit buttons and chips remain as direct entry points for users who prefer clear structure.

**Never make open conversation feel like the "better" option.**

- Open conversations don't get the satisfying completion card that structured sessions get. The ritual completion moment (day plan locked, journal generated, "rest well") is exclusive to structured flows.
- The home screen reflects structured session completion, not open conversation activity. "Morning session complete · 8:37 AM" is a visible marker of the ritual. Open conversations don't get that badge.

**Track the ratio.**

- Analytics: what percentage of orb taps lead to structured flow completion vs. open conversation? If structured flow completion drops over time, that's a signal the open conversation is cannibalizing the rituals — and the prompt or UX needs adjustment.

---

## Implementation Sequence

### Phase 1: Orb + Open Conversation (Ship First)

1. Add `open_conversation` session type to the schema
2. Build the open conversation system prompt (context-rich, no locked arc)
3. Change orb behavior: always opens open conversation
4. Sage's opening message is context-aware (time of day, day plan status)
5. Open conversations appear in History with summaries

### Phase 2: Fluid Transitions (Fast Follow)

1. Allow open conversation to transition into structured flows mid-session
2. Sage detects when the conversation has entered a structured arc and follows that arc's beats
3. Artifact generation works the same regardless of whether the session started as open or structured
4. Session metadata tracks which structured arcs were completed within an open conversation

### Phase 3: Smart Defaults (Optimization)

1. Learn from user behavior: does this user always do the morning ritual? Auto-suggest with higher confidence.
2. Time-of-day thresholds become user-configurable ("I'm a night owl, don't suggest Close the Day at 6pm")
3. Sage's opening gets more personalized over time based on patterns

---

## Summary

| Concept | Before | After |
|---|---|---|
| Orb behavior | Routes to Open the Day (static) | Opens conversation with Sage (universal) |
| "Just talk to Sage" | Not possible — must pick a session type | Always available as default mode |
| Structured sessions | Standalone containers | Modes within conversation |
| Session overwrite risk | Real — re-entering Open Day could duplicate/overwrite | Eliminated — Sage handles revisions conversationally |
| Conversation base layer | None | Open Conversation (context-rich, artifact-optional) |
| Entry points | Orb → Open Day, Chips → specific flows | Orb → Open Conversation, Chips → direct to structured flows |