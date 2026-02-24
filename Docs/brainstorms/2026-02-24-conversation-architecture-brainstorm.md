# Conversation Architecture Brainstorm

**Date:** February 24, 2026
**Source:** `Docs/feedback/20260224_conversation_architecture_spec.md`
**Status:** Design decisions captured, ready for planning

---

## What We're Building

Transform MeOS from discrete, typed sessions into a **two-layer conversation architecture**:

1. **Open conversation** (base layer) — always available, context-rich, no locked arc. Users can "just talk to Sage" without choosing a session type.
2. **Structured sessions** (modes within conversation) — Open the Day, Close the Day, Weekly Check-In, etc. can be entered and exited fluidly from within open conversation, OR triggered directly via home screen chips.

The HeroCard becomes a universal "Talk to Sage" entry point. Sage generates a context-aware opening message (time of day, day plan status, recent activity) and handles routing through conversation, not button logic.

---

## Why This Approach

The current architecture forces users to pick a session type before speaking to Sage. This creates three problems identified in Playtest 7:

1. The HeroCard has no good default — its behavior depends on time-of-day and session state, risking overwrites.
2. There's no "just talk" option — every conversation must be a typed session.
3. Structured flows feel rigid — no graceful way to pivot mid-session.

This design resolves all three by making conversation the default and structured flows opt-in modes.

---

## Key Decisions

### 1. Session Type: Evolve `ad_hoc` (not new type)

The existing `ad_hoc` session type is conceptually close to open conversation — no terminal artifact, no auto-completion. Rather than adding a new `open_conversation` type, we evolve `ad_hoc` into the open conversation concept. This avoids session type proliferation and leverages existing infrastructure.

**Action:** Rename `ad_hoc` to `open_conversation` across the codebase (DB migration, TypeScript types, API validation, labels).

### 2. Entry Points: Orb Universal, HeroCard Opinionated

**The orb** (center button in bottom tab bar, `components/ui/bottom-tab-bar.tsx`) stops routing by time-of-day. It always opens an open conversation — "Talk to Sage." Sage handles the contextual intelligence in its opening message, not the button routing logic.

**The HeroCard** (big CTA on home screen) stays time-aware: morning = "Open Your Day," midday = "Quick Capture," evening = "Close Your Day." It's the opinionated shortcut into structured flows.

**SessionChips** (Open Day / Capture / Close Day) remain as direct entry points into structured flows, unchanged.

This gives three layers of intent: orb = "I want to talk," HeroCard = "I'll take the suggestion," chips = "I know exactly what I want."

### 3. Approach: Dynamic Skill Composition (Approach B)

When Sage determines the conversation should enter a structured flow, it emits an `[ENTER_MODE: open_day]` signal. The system detects this and loads the full dedicated skill file (`skills/open-day.md`, `skills/close-day.md`) for subsequent API calls.

This preserves structured arc quality (the same detailed 270-line skill files are used) while allowing fluid transitions from open conversation.

**Technical mechanism:**
- Open conversation loads `skills/open-conversation.md` as its base prompt
- Sage emits `[ENTER_MODE: {type}]` when it detects the conversation should enter a structured arc
- The system stores `active_mode` in session metadata
- On the next API call, `buildConversationContext()` checks `active_mode` and loads the corresponding skill file instead of the open conversation prompt
- When the structured arc completes (terminal artifact detected), the system switches back to open conversation mode

### 4. Transitions: Same Session, Metadata Flags (Option A)

When open conversation transitions into a structured flow, the session type stays the same (ad_hoc / open_conversation). Metadata tracks which structured arcs were completed. This avoids session proliferation and keeps history clean.

**Session metadata structure:**
```json
{
  "active_mode": "open_day" | null,
  "completed_arcs": [
    { "type": "open_day", "completed_at": "2026-02-24T08:30:00Z" }
  ]
}
```

### 5. Post-Arc Completion: Offer Both

After a structured arc completes within open conversation (e.g., day plan generated), show the completion card (same satisfying ritual moment) but include a "Keep talking" option. If the user continues, Sage returns to open conversation mode. If they don't, the session ends naturally.

### 6. Opening Message: LLM-Generated

When the user taps "Talk to Sage," Sage generates the opening message via a Claude call, informed by injected context (time of day, day plan status, recent sessions, pending items). This feels like talking to a real person, not selecting from a menu.

The system prompt includes guidance on what to surface:
- Morning + no day plan → suggest morning session
- Day plan exists → acknowledge current state, ask what's up
- Evening → suggest closing the day
- Active patterns/pending items → surface proactively

### 7. Write Permissions: Full Access

Open conversation gets full write permissions (`day-plans/`, `daily-logs/`, `check-ins/`, `life-map/`, `life-plan/`, `sage/`, `captures/`). Since it can transition into any structured flow, it needs the ability to produce any artifact.

### 8. Quick Capture: Unchanged

The Capture chip continues to open the capture bar on the home screen. It's a fast, no-chat interaction — different from talking to Sage. Both paths coexist.

### 10. Mode Exit: Natural Handling

No explicit `[EXIT_MODE]` signal. If a user pivots mid-structured-arc, Sage handles it naturally. The structured prompt stays loaded, but Sage adapts. Mode formally exits only when the terminal artifact is emitted (arc completed) or the session ends. This avoids over-engineering the transition mechanism.

### 11. History Labels: Show Primary Arc Type

Open conversation sessions display the primary completed arc in History (e.g., "Morning Session" if open_day arc was completed). If no arc was completed, shows "Conversation with Sage."

### 12. Home Screen: Arc-Aware Status

The home screen checks session metadata `completed_arcs`, not just session type, to determine status. Morning flow completed within open conversation shows "Day Plan Set" same as a direct open_day session.

### 13. Beat Tracking: Terminal Artifact Only

No beat-level tracking in metadata. Sage follows the arc guided by the prompt. Completion is detected when the terminal artifact appears. Simpler, no coupling between code and prompt structure.

### 14. Scope: Phase 1 + 2 Together

Build the open conversation base AND fluid transitions into structured flows in a single implementation pass. Since we chose Option A (same session) and Approach B (dynamic skill composition), the transition logic is well-scoped: signal detection + metadata storage + skill file switching on next API call.

Phase 3 (smart defaults, personalization, user-configurable time thresholds) is deferred.

---

## Resolved Questions

1. **Rename or keep `ad_hoc`?** → **Rename to `open_conversation`.** DB migration + update all references. Cleaner long-term, makes codebase match the architecture concept.

2. **Mode exit signal:** → **Natural handling only.** No explicit exit signal. Sage handles pivots naturally within the conversation. The structured prompt stays loaded, but Sage is flexible enough to handle off-topic messages. Mode formally exits only on arc completion or session end.

3. **History display:** → **Show primary arc type.** If morning flow was completed, show "Morning Session" in history, not "Open Conversation." Users remember what they did, not the session container. If no structured arc was completed, show "Conversation with Sage."

4. **Home screen status after in-conversation arc:** → **Yes, same status.** Check session metadata `completed_arcs` for arc completions, not just session type. If morning flow was completed in an open conversation, home screen shows "Day Plan Set" the same way.

5. **Structured arc beat tracking:** → **Terminal artifact only.** Don't track beats in metadata. The prompt guides Sage through the arc naturally. Completion is detected when the terminal artifact appears (day plan, journal, etc.). Simpler and avoids coupling code to prompt structure.

---

## What's NOT in Scope

- Phase 3: Smart defaults, behavior learning, user-configurable time thresholds
- TTS/voice changes
- New structured session types (monthly review, quarterly review)
- Analytics/ratio tracking (mentioned in spec as mitigation strategy)
- Calendar integration
- Proactive Sage nudges outside of opening messages
