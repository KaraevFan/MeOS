# MeOS UX Architecture: Audit, Flows & Gap Analysis

**Prepared for:** Tom (Founder, MeOS)

**Date:** February 16, 2026

**Status:** Working document — intended as the design foundation for Sprint 2+

---

# Phase 1: How to Think About Designing the UX for This Product

Before mapping flows or flagging gaps, I want to lay out the mental models I'm using. MeOS is an AI-native product, and that makes the design challenge fundamentally different from a traditional app. Here's why, and how I'd approach it.

## Why AI-Native Product Design Is Different

**Traditional apps have deterministic flows.** You tap a button, a screen appears, the state changes predictably. You can wireframe every screen, every transition, every edge case. The designer controls the experience end-to-end.

**MeOS doesn't work like that.** The conversation IS the product, and conversations are non-deterministic. Sage might go deep on career in 90 seconds or spend 6 minutes there. The user might skip 5 domains or cover all 8. They might cry about their marriage or breeze through every topic. The "flow" is emergent, not scripted.

This means the traditional design toolkit — screen-by-screen wireframes, pixel-perfect specs — is necessary but not sufficient. You need a higher-altitude design layer that governs the *dynamics* of the experience.

## The Three Design Layers for MeOS

**Layer 1: Structural UX (the skeleton)** — Screens, navigation, information architecture, visual hierarchy. Traditional design. You have a decent first pass: four tabs, warm palette, voice button as hero.

**Layer 2: Conversational UX (the soul)** — The arc, pacing, and emotional shape of Sage's conversations. This is where most of the experience actually lives. You can't wireframe a conversation — but you CAN design the *structure* of a conversation: mini-arcs, phase transitions, escalation patterns, closure rituals. Closer to screenplay structure than UI design.

**Layer 3: System UX (the intelligence)** — How the system behaves over time. Session state awareness, context injection, progressive disclosure, pattern surfacing. This creates the "this thing knows me" feeling.

Most of what's built lives in Layers 1-2. Layer 3 — the system intelligence across sessions — is where the biggest gaps are.

## Frameworks Applied

**1. The Golden Path + Escape Hatches** — The ideal journey from first touch to retained user, with graceful exits at every step. AI products need well-designed escape hatches because the AI can't always predict what the user needs.

**2. Loop Taxonomy (adapted Hook Model)**

- **Core Loop** — the repeated unit of value (conversation → structured output → life map update)
- **Retention Loop** — what brings users back (weekly check-in cadence)
- **Progression Loop** — how the experience deepens (pattern detection, trust ladder)
- **Recovery Loop** — what happens when users fall off (UNDESIGNED — critical gap)

**3. State Machine Thinking** — The user isn't navigating *screens* — they're moving through *states*. The `detectSessionState` function is the right instinct but needs significant expansion.

**4. Emotional Arc Design** — Every session should have a designed emotional arc. Rising tension → recognition → catharsis → warm closure. Needs to be explicitly mapped.

**5. "Minimum Viable Memory" Principle** — What's the minimum context Sage needs to feel like it knows you? The markdown file system is a good architectural answer. The design question: which pieces surface visibly vs. operate invisibly?

---

# Phase 2: Current-State Audit

## 2.1 — Current-State Flow Map

### Flow 1: First-Time Onboarding (Life Mapping)

```
ENTRY: App launch (unauthenticated)
  │
  ├─→ Auth screen (Google OAuth / Magic Link)
  │     │
  │     └─→ [SCREEN 1] Sage Intro + Name Collection
  │           │
  │           └─→ [SCREEN 2] Intent Selection (5 situation-based options)
  │                 │
  │                 └─→ [SCREEN 3] Trust-Building Mini-Conversation (2-3 exchanges)
  │                       │
  │                       └─→ [SCREEN 4] Pulse Check (8 domains, 1-5 scale)
  │                             │
  │                             └─→ [SCREEN 5] Radar Chart + Sage Commentary
  │                                   │
  │                                   └─→ [CHAT VIEW] Life Mapping Session
  │                                         Phase 1b: Opening warm-up (~2 min)
  │                                         Phase 2: Domain exploration (15-25 min)
  │                                         Phase 3: Synthesis (3-5 min)
  │                                         Phase 4: Life Plan (optional)
  │                                         │
  │                                         └─→ Session complete → HOME SCREEN
```

**Observations:** Trust-building mini-conversation is unbuilt. Radar chart → chat transition has a 406 bug (hard blocker). Session completion → home screen transition is unspecified — needs a closing ritual.

### Flow 2: Returning User — Check-In Due

```
ENTRY: App launch / push notification
  │
  ├─→ [HOME SCREEN] with prominent check-in prompt
  │     │
  │     ├─→ [Start check-in] → CHECK-IN SESSION → Session complete → HOME (updated)
  │     ├─→ [Talk to Sage] → ??? (ad hoc — UNDEFINED)
  │     └─→ [Life Map / History tabs] → read-only views
```

**Observations:** "Start check-in" vs "Talk to Sage" are undifferentiated. Push notification → app → chat transition isn't built. No post-check-in affirming moment.

### Flow 3: Returning User — Between Check-Ins

```
ENTRY: App launch (no check-in due)
  │
  └─→ [HOME SCREEN] with "Talk to Sage" as primary CTA
        │
        └─→ [Talk to Sage] → ??? (LARGELY UNDEFINED)
```

**Key observation:** The "between check-ins" state is the MOST COMMON state for a retained user, and it's the LEAST DESIGNED.

### Flow 4: Interrupted / Abandoned Session

```
ENTRY: User closed app mid-conversation
  │
  └─→ [CHAT VIEW] loads prior messages
        "Want to pick up where we left off, or start fresh?"
        [Continue] [Start fresh]
        │
        └─→ "Start fresh" → ??? (What happens to partial data?)
```

### Flow 5: Life Map Editing

```
ENTRY: Life Map tab → domain card → "Edit" affordance
  │
  └─→ ??? (Entirely unspecified)
```

---

## 2.2 — Loop Inventory

### Loop 1: Core Conversation Loop ✅ (exists, functional)

User speaks → Sage responds → structured output → domain card renders → user sees value → continues.

**Cycle:** Real-time | **Reinforcement:** Visible progress | **Status:** Working — strongest loop.

### Loop 2: Weekly Check-In Loop ⚠️ (partially built)

Mapping complete → scheduled +7 days → [notification?] → user opens → Sage references context → life map updated → next check-in scheduled.

**Cycle:** 7 days | **Reinforcement:** "Feeling known" | **Status:** Conversation works, trigger mechanism broken (no push), habit formation mechanics undesigned.

### Loop 3: Micro-Commitment Loop ⚠️ (designed, not verified)

End of check-in → "One thing for next week" → stored → next check-in opens with "How'd that go?" → reflect → course-correct.

**Cycle:** 7 days (nested in Loop 2) | **Reinforcement:** Accountability without judgment | **Status:** In prompts, depends on context injection reliability.

### Loop 4: Pattern Detection Loop ❌ (table exists, logic doesn't)

Session themes compared across sessions → pattern detected → Sage surfaces it → user gains insight.

**Cycle:** 3+ weeks | **Reinforcement:** "The system sees what I can't" | **Status:** No automated detection. Fragile prompt-based approach only.

### Loop 5: Domain Drift Loop ❌ (conceptual only)

Pulse check baseline → weekly re-ratings → significant change detected → targeted conversation.

**Cycle:** Variable | **Reinforcement:** Proactive intelligence | **Status:** Requires re-rating mechanism (not built).

### Loop 6: Trust Ladder / Progression Loop ❌ (designed, not built)

User trusts reflection → Sage suggests action → user approves → success → user grants more autonomy.

**Cycle:** Weeks to months | **Reinforcement:** Increasing capability = increasing value | **Status:** Phase 1 tool use spec'd for Weeks 4-5.

### Loop 7: Recovery Loop ❌ (not designed at all)

Missed check-in → gentle ping → missed again → warmer nudge → user goes quiet → Sage goes quiet → re-engagement hook → warm welcome back.

**Cycle:** 1-4+ weeks | **Reinforcement:** No guilt, warm return | **Status:** Mentioned in retention doc, no implementation or spec.

---

## 2.3 — Gap Analysis

### CRITICAL (blocks user testing or core value delivery)

**GAP 1: No session completion ritual**

When a session ends, the transition to "done" is abrupt. No celebratory moment, no clear "we're done" signal, no preview of what's next. The end of the first life mapping session is the single most important emotional moment in the product.

→ **Fix:** 3-step closing: (1) Synthesis reveal with visual weight, (2) "Your life map is ready — view it?" CTA, (3) Warm close from Sage with next check-in date.

**GAP 2: "Talk to Sage" mode is undefined**

Between check-ins, the primary CTA leads to an undefined experience. No session type, no system prompt, no clarity on what gets saved.

→ **Fix:** Create `ad_hoc` session type. Sage greets with Life Map context, triages the user's intent, and routes appropriately.

**GAP 3: Post-onboarding cliff**

After life mapping, next event is 7 days away. Nothing to do. Highest-risk churn moment — 60-80% of users will never return.

→ **Fix:** Day 1 follow-up notification with specific callback to session content. Home screen reflection prompt. One more touch before Day 7.

**GAP 4: Push notifications non-functional**

VAPID keys not configured. Without external triggers, the retention loop doesn't close. For ADHD-adjacent users, relying on memory is guaranteed failure.

→ **Fix:** P0 engineering task. Design notification copy that feels like a person reaching out, not a system reminder.

### IMPORTANT (degrades experience or blocks scale)

**GAP 5: No domain editing UX** — Edit affordance exists with no spec. Users can't correct inaccuracies.

→ **Fix:** Inline quick-edit (MVP) + "Talk to Sage about this" for deeper changes.

**GAP 6: No session type indication** — User doesn't know what kind of conversation they're in or how long it should take.

→ **Fix:** Session label + duration estimate in chat header.

**GAP 7: No change-over-time in Life Map** — Current state only, no trajectories or changelogs.

→ **Fix:** Trend arrows on domain cards + "What changed" section.

**GAP 8: No conversation closure mechanism** — When is a check-in or ad hoc session "done"?

→ **Fix:** Designed closing sequences in all session type prompts.

**GAP 9: History view is a dead end** — Read-only archive with no actions.

→ **Fix:** "Talk to Sage about this" action on history entries.

### NICE-TO-HAVE (polish, delight, future-proofing)

**GAP 10:** Onboarding skip/resume

**GAP 11:** Deep dive mode for check-ins

**GAP 12:** Data export / "my data" view

**GAP 13:** Voice-only mode (TTS)

**GAP 14:** Milestone celebrations

---

## 2.4 — The Golden Path (First 30 Days)

### Day 0: First Touch (20-30 minutes)

Auth → 5-screen onboarding → Life Mapping Session → Domain cards accumulate → Synthesis reveal → Session closing ritual → Life Map view ("wow" moment) → "One thing" commitment → Sage closes warmly.

→ **USER FEELS:** "That was worth 20 minutes. This thing gets me."

→ **Success metric:** 70%+ completion rate. "Gets me" signal.

### Day 1: The Follow-Up Touch

Push notification: "I've been thinking about what you shared. [Specific detail]. How does that land today?"

→ **USER FEELS:** "This thing is thinking about me even when I'm not using it."

→ **Success metric:** 40%+ open rate, 20%+ engagement.

### Day 7: First Weekly Check-In (5-10 min)

Notification quotes their commitment back → Check-in session → Review against intentions → Energy check → "One thing for next week" → Warm close.

→ **USER FEELS:** "It remembered. It's holding me accountable without being annoying."

→ **Success metric:** 50%+ of life mapping completers do the first check-in.

### Day 14: Second Check-In (the "it deepens" moment)

Sage references both prior sessions. If pattern emerging, names it gently.

→ **USER FEELS:** "It's seeing something I wasn't seeing."

### Day 21-28: Pattern Territory

Reliable pattern surfacing. Cross-domain connections. Domain trajectory visible.

→ **USER FEELS:** "This is getting more valuable over time. I don't want to stop."

### Day 30: The Retention Test

User has rich Life Map, 4 check-in summaries, visible trajectories, micro-commitment habit, and at least one "this thing sees me" moment.

The question: **do they feel like they'd lose something if they stopped?** If yes → PMF for the core loop.

---

## Priority Action List

| # | Gap | Severity | Effort | Action |
| --- | --- | --- | --- | --- |
| 1 | Session completion ritual | Critical | Small | Design 3-step closing flow |
| 2 | "Talk to Sage" undefined | Critical | Medium | Create ad_hoc session type + prompt |
| 3 | Post-onboarding cliff | Critical | Medium | Day 1 follow-up notification + bridge |
| 4 | Push notifications broken | Critical | Small | VAPID keys + notification copy |
| 5 | Domain editing UX | Important | Medium | Inline quick-edit MVP |
| 6 | Session type indication | Important | Small | Label + duration in chat header |
| 7 | No change-over-time | Important | Medium | Trend arrows + "What changed" |
| 8 | No closure mechanism | Important | Small | Closing sequences in all prompts |
| 9 | History is dead end | Important | Small | "Talk to Sage about this" action |

---

## Final Thought: What MeOS Actually Is

**MeOS isn't an app with conversations. It's a relationship with an interface.**

The screens, the tabs, the domain cards — they're all secondary to the *relationship* the user builds with Sage over time. The Life Map isn't a dashboard; it's a shared artifact. The check-in isn't a feature; it's a ritual. The home screen isn't a landing page; it's the entryway to an ongoing conversation.

This means the single most important design decision isn't about screens or flows. It's about **Sage's personality and conversational consistency across every touchpoint.** If Sage feels different in onboarding vs. check-ins vs. ad hoc chats vs. home screen copy vs. push notifications, the relationship breaks.

The thing that will make or break this product is whether the first 10 users feel like Sage *knows* them after 3 weeks. Everything else follows from that.