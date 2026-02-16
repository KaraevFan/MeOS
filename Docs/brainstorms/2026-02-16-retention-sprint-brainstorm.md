# Retention Sprint: Session Endings, Ad-Hoc Sessions, Push Notifications

**Date:** 2026-02-16
**Status:** Brainstorm
**Origin:** UX Architecture Audit (`Docs/feedback/20260216_MeOS_UX_Architecture.md`)
**Scope:** Gaps 1-4 + 8 from the audit, unified as one retention-focused sprint

---

## What We're Building

Three interconnected features that form a complete retention loop:

1. **Session Closing Rituals** — designed endings for life mapping and check-in sessions
2. **Ad-Hoc "Talk to Sage" Sessions** — a defined experience for between-check-in conversations
3. **Push Notifications + Day 1 Bridge** — external triggers that close the retention loop

These aren't independent features. They're one story: *end well* -> *come back* -> *find something meaningful when you do*.

---

## Why This Approach

The audit identifies 14 gaps. We're tackling the ones that form a connected retention chain because:

- **Session endings** are the last impression. A good ending creates the desire to return.
- **Ad-hoc sessions** fill the "what now?" gap — the most common user state (between check-ins) is currently undefined.
- **Push notifications** are the only external trigger mechanism. Without them, retention depends entirely on user memory.
- **The Day 1-3 cliff** is where 60-80% churn happens. One notification + a warm home screen nudge bridges the gap.

Deprioritized for now: domain editing, session type labels, change-over-time tracking, history actions. These matter later — not before core retention works.

---

## Key Decisions

### 1. Session Closing Ritual: Two-Beat Arc

**Decision:** In-chat synthesis followed by a transitional Life Map reveal.

- **Beat 1:** Sage delivers a rich synthesis message in the chat — this IS the closing of the conversation. Visual weight, warm language, feels like a natural ending.
- **Beat 2:** A "View your Life Map" CTA navigates to a dedicated reveal screen. The "wow" moment lives here — seeing your whole life mapped out for the first time.
- **Warm close:** After the reveal, Sage's voice appears one more time with "Your next check-in is [date]. See you then." — not a system message, Sage speaking.

Applies to both life mapping (more dramatic) and weekly check-ins (lighter touch).

### 2. Ad-Hoc Sessions: Context-Aware Nudge

**Decision:** New `ad_hoc` session type where Sage opens by picking up a thread from the Life Map.

- Sage reads from `sage/context.md` and recent domain files to find something relevant.
- Opening: "Last time you mentioned [specific thing from Life Map]. How's that going?" — proactive, shows memory.
- If nothing specific stands out, falls back to warm check-in: "Good to see you. What's on your mind?"
- Ad-hoc sessions can write to: `sage/context.md`, `sage/patterns.md` (light updates only — no domain file rewrites outside structured sessions).
- Session is shorter-form, more fluid. No formal synthesis at the end — just a warm wrap-up.

### 3. Push Notifications: Full Sage Voice

**Decision:** Notifications sound like Sage, not like a system. References specific content from the user's Life Map.

- **All notification content is generated at session end** — not at send time. Sage has full context warm in memory after a conversation. We ask it to generate follow-up/reminder messages as part of post-session processing, store them, and fire them on schedule. Zero additional inference cost, maximally personal, avoids cold-start context loading for a single sentence.
- **Day 1 notification (~24hrs post-onboarding):** "I've been thinking about what you shared about [domain/topic]. [Specific observation]. How does that land today?"
- **Day 7 check-in reminder:** "It's been a week since we mapped things out. Ready to check in on how [commitment] is going?"
- **Missed check-in (Day 8-9):** "No rush — whenever you're ready, I'm here. [Gentle reference to something from their map]."
- Privacy consideration: full Sage voice means content on lock screen. May need to offer a "preview" setting later — but for MVP, go personal. The intimacy is the product.

### 4. Day 1-3 Bridge: Push + Home Nudge + Conditional Day 3

**Decision:** Day 1 push + passive home nudge + conditional Day 3 touch for users who haven't returned.

- **Day 1 push:** Generated at session end, fired ~24hrs later. Specific to their session content.
- **Deep link:** Notification tap -> **home screen** (not chat). The reflection prompt is waiting there. If the user wants to respond, they tap the prompt, which opens an ad-hoc session with that context pre-loaded. This keeps the notification's promise — Sage "was thinking" about something, and that something is visible when they arrive.
- **Home screen nudge:** When user opens app between sessions, home shows a reflection prompt. Not a CTA to start a session — just "Something to sit with: [insight from their mapping]." Tapping opens an ad-hoc session with that context.
- **Conditional Day 3 push:** If the user opened the app between Day 1-3 (Day 1 notification worked), no Day 3 push. If they haven't opened the app at all, one more touch: something lighter like "No rush. Your life map is here whenever you want it." The users who churned after onboarding and never came back are the ones who most need reaching. Track `last_active_at` to gate this.

### 5. Conversation Closure Mechanism (All Session Types)

**Decision:** Designed closing sequences in system prompts for all session types.

- Sage detects when the conversation has reached a natural endpoint (covered what was needed, user energy is winding down).
- Sage initiates closing: brief summary of what was covered, any commitments made, warm sign-off.
- For life mapping: "I feel like I have a good picture now. Want me to put this all together?"
- For check-ins: "Good check-in. Here's what I'm taking away..." + next check-in date.
- For ad-hoc: "Thanks for sharing that. I'll keep this in mind." — lighter, no formal synthesis.

---

## Resolved Questions

1. **Notification scheduling infrastructure:** Supabase Edge Functions with pg_cron. Keeps everything in the existing stack — cron triggers an Edge Function that checks for due notifications and sends web push via VAPID.

2. **Ad-hoc session write permissions:** Sage context only — `sage/context.md` and `sage/patterns.md`. Domain files stay read-only in ad-hoc sessions. Clear boundary: structured sessions (life mapping, check-ins) own domain data; ad-hoc sessions update Sage's internal model only.

3. **All re-engagement content generation:** Pre-computed at session end. When a session completes, Sage generates (a) 2-3 reflection prompts for the home screen, (b) Day 1 notification copy, (c) Day 3 conditional notification copy, and (d) check-in reminder copy — all in one post-session processing step. Stored in DB. No runtime AI cost for any notification or nudge.

---

## What's NOT in Scope

- Daily nudges / habit tracking (Sprint 1 exclusion still holds)
- TTS / voice responses from Sage
- Pattern detection automation (Loop 4 from audit) — requires multi-session data
- Domain editing UX — users can correct through conversation
- Data export / "my data" view
- Milestone celebrations
