# MVP Gap Analysis & Design Decisions

Date: 2026-02-10
Status: Approved

This document captures architectural gaps identified in the original MVP spec (MVP_PRD.md, UX_design.md) and the design decisions made to address them. These decisions supplement the original specs — when they conflict, this document takes precedence.

---

## Summary of Decisions

| Gap | Decision |
|-----|----------|
| Session persistence | Auto-save every 60 seconds |
| Streaming responses | Yes — stream text, render cards on closing tag |
| Post-session processing | Parse Sage's inline structured output (Option C), upgrade later |
| Quick-reply buttons | Frontend tracks explored domains, shows remaining |
| Domain card editing | Conversational correction — tap card, type correction, Sage responds |
| Check-in reminders | Push notifications with email fallback |
| Message storage | New `messages` table, drop `full_transcript` from sessions |
| Session lifecycle | Hybrid — synthesis detection, wrap-up button, 24h auto-close |
| Error recovery | Retry button on failed messages |
| Session tracking | Add `status` + `completed_at` to sessions table |

---

## 1. Updated Data Model

### `sessions` table — modified from original spec

- Remove `full_transcript` (reconstruct from messages when needed)
- Add `status: enum (active | completed | abandoned)` — default `active`
- Add `completed_at: timestamp (nullable)` — set when synthesis detected or user wraps up
- Add `domains_explored: text[]` — frontend writes this as domains complete, used for quick-reply buttons on session recovery

### `messages` table — new

```
message_id: uuid (PK)
session_id: uuid (FK -> sessions)
role: enum (user | assistant)
content: text
has_structured_block: boolean
created_at: timestamp
```

### `life_maps` table — clarification

One active life map per user. Add `is_current: boolean (default true)`. When a full re-mapping happens, the old map gets `is_current = false` rather than being overwritten — preserves history.

### `push_subscriptions` table — new

```
subscription_id: uuid (PK)
user_id: uuid (FK)
endpoint: text
keys: jsonb (p256dh + auth keys)
created_at: timestamp
```

All other tables remain as specified in MVP_PRD.md.

---

## 2. Streaming + Structured Output Parsing

The chat API route streams Claude's response using Server-Sent Events (SSE). The frontend handles three rendering states as tokens arrive:

**Plain text** — Tokens render immediately into the current assistant message bubble, character by character.

**Inside a structured block** — When the parser detects an opening tag like `[DOMAIN_SUMMARY]`, it stops rendering plain text and begins accumulating tokens into a buffer. A subtle "building card..." placeholder appears in the chat. Tokens are NOT shown as raw text during this phase.

**Block complete** — When the closing tag (e.g., `[/DOMAIN_SUMMARY]`) is detected, the buffered content is parsed into key-value pairs and rendered as a styled domain card component. The frontend also updates its internal list of explored domains (for quick-reply buttons).

**Malformed output handling:** If the stream ends without a closing tag, or the content between tags doesn't parse cleanly, fall back to rendering the raw text as a plain message. Never crash, never lose content.

**Auto-save integration:** Assistant messages are written to the `messages` table once the stream completes (not during). User messages are written immediately when sent. The 60-second auto-save interval is a safety net for the edge case where a very long streaming response is interrupted — in practice, most messages persist naturally.

---

## 3. Session Lifecycle + Persistence

### Starting a session

User taps "Talk to Sage" or "Start check-in." Frontend checks for an existing `active` session of that type. If one exists (from a previous interruption), resume it: load messages from DB, rebuild chat view, restore explored domains list, continue the conversation. If none exists, create a new `sessions` row with `status: active`.

### During a session

- User messages saved to `messages` table immediately on send
- Assistant messages saved once streaming completes
- `sessions.updated_at` touched with each message (heartbeat for detecting stale sessions)

### Completing a session (3 paths)

**Path 1 — Synthesis detected:** Parser sees `[LIFE_MAP_SYNTHESIS]` or `[SESSION_SUMMARY]` closing tag. Session automatically marked `completed`, `completed_at` set. Parsed structured data written to `life_maps` / `life_map_domains` / `sessions` tables. Quick-reply buttons replaced with a "View Life Map" action.

**Path 2 — User taps "Wrap up":** Sends a system-level message to Claude: "The user wants to wrap up. Please synthesize what you've covered so far." Sage generates the synthesis block, which triggers Path 1.

**Path 3 — Abandoned (24h timeout):** A scheduled job (Supabase cron or Vercel cron) finds `active` sessions where `updated_at` is older than 24 hours. Marks them `abandoned`. No post-processing — the messages are preserved and the user can view them in History, but no life map updates are generated.

---

## 4. Quick-Reply Buttons + Domain Card Corrections

### Quick-reply buttons

The frontend maintains a `domainsExplored` set in component state, initialized from the `sessions.domains_explored` column on session load (supports recovery). When a `[DOMAIN_SUMMARY]` block is parsed, its domain name is added to the set and persisted back to the session row.

After each domain card renders, the frontend displays pill-shaped buttons for each remaining domain from the fixed list of 8, plus a "Wrap up" button. Tapping a domain button sends it as the user's message (e.g., "Let's explore Health / Body"). Tapping "Wrap up" triggers the synthesis path from Section 3.

Buttons only appear after domain cards — not after every Sage message. The trigger is purely the presence of a newly rendered domain card.

### Domain card corrections

Tapping a domain card scrolls to the text input and pre-fills a prompt like "About my Career / Work card — " with the cursor ready. The user types their correction naturally. Sage responds conversationally and outputs an updated `[DOMAIN_SUMMARY]` block for that domain.

The frontend handles this by keying domain cards by domain name. When a second `[DOMAIN_SUMMARY]` for the same domain arrives, the life map data updates to the latest version. Both cards remain visible in the chat scroll (showing the conversation history), but only the latest version feeds into the life map view and synthesis.

---

## 5. Notifications + Check-In Reminders

### Push notifications (primary)

On first app load after onboarding, request notification permission via the browser's Push API. If granted, register a service worker and store the push subscription endpoint in the `push_subscriptions` table.

A Supabase scheduled function (cron) runs daily, checks which users have a check-in due (7 days after last completed check-in session), and sends a push notification via the Web Push protocol. The notification opens directly into the chat view with check-in mode.

### Email fallback

If push permission is denied or the subscription doesn't exist, fall back to email. Same cron job checks for users without active push subscriptions and sends a reminder email via Supabase's built-in email or a simple integration like Resend.

Users who have push enabled do NOT also get email — one or the other, not both.

### Check-in scheduling

For MVP, the cadence is fixed at weekly (7 days from last completed check-in). No user-configurable schedule. The Home screen shows "Next check-in: [date]" with a "Start now" button that works anytime.

---

## 6. Error Recovery

### Message retry

When a Claude API call fails (timeout, rate limit, 500), the assistant message bubble shows an error state: "Sage couldn't respond. Tap to retry."

Tapping retry re-sends the same API request with the full conversation context. The failed message is replaced with the successful response. No new user message is created — it's a transparent retry of the same turn.

If retry fails 3 times, show: "Sage is having trouble right now. Your conversation is saved — come back and pick up where you left off." This leverages the session recovery mechanism from Section 3.
