---
title: "feat: Retention Sprint — Session Closings, Ad-Hoc Sessions, Push Notifications"
type: feat
date: 2026-02-16
origin: docs/brainstorms/2026-02-16-retention-sprint-brainstorm.md
---

# Retention Sprint: Session Closings, Ad-Hoc Sessions, Push Notifications

## Overview

Three interconnected features that form a complete retention loop: (1) designed session endings with a two-beat closing arc, (2) a new `ad_hoc` session type for between-check-in conversations with Sage, and (3) functional push notifications with a Day 1 bridge and home screen reflection nudges. All re-engagement content (notifications, nudges) is pre-generated at session end while Claude has warm context.

## Problem Statement

After the first life mapping session, MeOS drops the user into a 7-day void. Sessions end abruptly with no emotional closure. The "Talk to Sage" CTA leads to an undefined experience. Push notifications are scaffolded but non-functional. The result: the most common user state (between check-ins) is the least designed, and the highest-churn moment (Day 1-3) has zero mitigation.

## Proposed Solution

Build the retention chain end-to-end: **end well** (closing rituals) → **come back** (push notifications) → **find something meaningful** (ad-hoc sessions + home nudges).

## Technical Approach

### Architecture

```
Session End → Post-Session Processing → Pre-generate all re-engagement content
                                         ├─ Day 1 notification copy (stored)
                                         ├─ Day 3 conditional copy (stored)
                                         ├─ Check-in reminder copy (stored)
                                         └─ 2-3 reflection prompts (stored)

Supabase pg_cron (runs hourly) → Edge Function
  ├─ Check scheduled_notifications table
  ├─ Gate Day 3 on last_active_at
  └─ Send via web-push library

Notification tap → /home (not /chat)
  └─ Home shows reflection nudge
       └─ Tap nudge → /chat?type=ad_hoc&context=<nudge_id>
```

### Implementation Phases

#### Phase 1: Database & Type Foundation

Add `ad_hoc` session type and notification infrastructure to the schema.

**Migration: `007_retention_sprint.sql`**

```sql
-- 1. Add ad_hoc to session_type CHECK constraint
ALTER TABLE sessions DROP CONSTRAINT sessions_session_type_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_session_type_check
  CHECK (session_type IN ('life_mapping', 'weekly_checkin', 'monthly_review', 'quarterly_review', 'ad_hoc'));

-- 2. Scheduled notifications table
CREATE TABLE scheduled_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  notification_type text NOT NULL CHECK (notification_type IN ('day_1', 'day_3', 'checkin_reminder', 'checkin_missed')),
  title text NOT NULL,
  body text NOT NULL,
  url text NOT NULL DEFAULT '/home',
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  cancelled_at timestamptz,
  gate_condition jsonb, -- e.g., {"require_inactive_since": "2026-02-17T00:00:00Z"}
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_scheduled_notifications_pending
  ON scheduled_notifications (scheduled_for)
  WHERE sent_at IS NULL AND cancelled_at IS NULL;

ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications"
  ON scheduled_notifications FOR SELECT USING (auth.uid() = user_id);

-- 3. Reflection prompts table
CREATE TABLE reflection_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  prompt_text text NOT NULL,
  context_hint text, -- brief context for ad-hoc session if tapped
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reflection_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own prompts"
  ON reflection_prompts FOR SELECT USING (auth.uid() = user_id);

-- 4. Add last_active_at to users (for conditional Day 3 gating)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

-- 5. Fix push_subscriptions unique constraint (known bug)
ALTER TABLE push_subscriptions
  ADD CONSTRAINT push_subscriptions_user_endpoint_unique
  UNIQUE (user_id, endpoint);
```

**TypeScript type updates:**

- `types/chat.ts:3` — Add `'ad_hoc'` to `SessionType` union
- `app/api/chat/route.ts:87` — Add `'ad_hoc'` to `VALID_SESSION_TYPES`
- `lib/markdown/constants.ts:47-58` — Add `ad_hoc` write permissions:
  ```typescript
  ad_hoc: [
    'sage/',
  ],
  ```

**Files to modify:**
- `supabase/migrations/007_retention_sprint.sql` (new)
- `types/chat.ts:3`
- `app/api/chat/route.ts:87`
- `lib/markdown/constants.ts:47-58`

**Success criteria:**
- [x] Migration runs clean against Supabase
- [x] TypeScript compiles with `ad_hoc` as valid SessionType
- [x] `SESSION_WRITE_PERMISSIONS['ad_hoc']` returns `['sage/']`

---

#### Phase 2: Session Closing Rituals

The emotional payoff. Two-beat arc: in-chat synthesis → Life Map reveal screen.

**2a. Prompt engineering — closing sequences**

Update system prompts so Sage initiates closure naturally instead of just emitting blocks mid-conversation.

`lib/ai/prompts.ts` — Append to `getLifeMappingPrompt()` (after the "Critical rules" section, ~line 99):

```
## Session Closing Sequence

When the user has explored 2+ domains and the conversation is winding down:
1. Acknowledge: "I feel like I have a good picture now. Want me to put it all together?"
2. Wait for user confirmation before emitting synthesis blocks.
3. After emitting the [FILE_UPDATE type="overview"] and [FILE_UPDATE type="life-plan"] blocks, close with a warm personal message (2-3 sentences). Reference something specific from the conversation. End with: "Your first check-in is in a week. I'll be here."
4. Do NOT ask another question after the closing message. The session is over.
```

`lib/ai/prompts.ts` — Append to `getWeeklyCheckinBasePrompt()` (after "At the end of the session", ~line 220):

```
## Session Closing Sequence

When the check-in feels complete:
1. Summarize: "Good check-in. Here's what I'm taking away..." (2-3 key points)
2. Emit the [FILE_UPDATE] blocks (life-plan, any changed domains, check-in summary).
3. Close with a warm one-liner and the next check-in date. Example: "See you next [day]. Take care of yourself this week."
4. Do NOT ask another question after the closing message. The session is done.
```

**2b. Client-side closing flow**

After `completeSession()` fires (in `chat-view.tsx:710-731`), instead of doing nothing:

1. Set a `sessionCompleted` state flag
2. Show a **"Session Complete" card** inline in chat — not a new screen, but a rich card component:
   - Warm copy: "Your life map has been updated"
   - CTA button: "View your Life Map" → navigates to `/life-map`
   - For check-ins: "Check-in saved" with next check-in date
3. Disable the message input (session is over, can't send more messages)
4. On the Life Map page, detect `?from=session` query param to show a brief warm close from Sage (stored in session metadata or state)

**New component: `components/chat/session-complete-card.tsx`**

```typescript
interface SessionCompleteCardProps {
  sessionType: SessionType
  nextCheckinDate: string | null
}
```

- For `life_mapping`: "Your life map is ready" + "View Life Map" button → `/life-map?from=session`
- For `weekly_checkin`: "Check-in saved" + next check-in date + "View Home" button → `/home`
- Warm design: cream background, subtle border, Sage-voice copy

**Modifications to `components/chat/chat-view.tsx`:**
- Add `sessionCompleted` state (boolean, default false)
- After `completeSession()` succeeds (lines 714, 728), set `sessionCompleted = true`
- When `sessionCompleted`, append a `SessionCompleteCard` to the message list
- Disable input/voice button when `sessionCompleted`

**Files to modify:**
- `lib/ai/prompts.ts:31-181` (life mapping closing sequence)
- `lib/ai/prompts.ts:184-252` (check-in closing sequence)
- `components/chat/session-complete-card.tsx` (new)
- `components/chat/chat-view.tsx` (session complete state + card rendering + input disable)
- `app/(main)/life-map/page.tsx` (optional: detect `?from=session` for warm close moment)

**Success criteria:**
- [x] Sage naturally initiates closing before emitting synthesis blocks
- [x] Session complete card appears inline after session ends
- [x] Message input is disabled after session completion
- [x] "View Life Map" CTA navigates correctly
- [x] Check-in complete shows next check-in date

---

#### Phase 3: Ad-Hoc "Talk to Sage" Sessions

A defined experience for the `mapping_complete` state.

**3a. Ad-hoc system prompt**

New function in `lib/ai/prompts.ts`:

```typescript
export function getAdHocPrompt(): string {
  return `You are Sage, an AI life partner built into MeOS. The user is coming to you between scheduled check-ins for an informal conversation.

Your personality: [same as life mapping — warm, empathetic, opinionated, challenges with curiosity]

## Response Format Rules
[same 2-3 sentence rules as other prompts]

## Opening Move
Look at the user's life context below. Find something specific — a commitment they're working on, a tension they named, a domain that needs attention — and open with it:
"Hey [name]. I've been thinking about [specific thing from their context]. How's that going?"

If nothing specific stands out, fall back to: "Good to see you, [name]. What's on your mind?"

## Conversation Style
- Follow the user's lead. This isn't a structured session — let them drive.
- If they bring up something that maps to a life domain, explore it naturally but don't force domain updates.
- Keep it shorter than a mapping session. 5-10 minutes is ideal.
- No formal synthesis or closing ritual. Just a warm wrap-up:
  "Thanks for sharing that. I'll keep it in mind for our next check-in."

## What You Can Update
- You may update your working model: [FILE_UPDATE type="sage-context"]
- You may note patterns: [FILE_UPDATE type="sage-patterns"]
- Do NOT emit domain updates, overview updates, life-plan updates, or check-in summaries. Those belong to structured sessions only.

${FILE_UPDATE_FORMAT}`
}
```

**3b. Context injection for ad-hoc**

`lib/ai/context.ts:119-140` — Update `buildConversationContext()`:

```typescript
export async function buildConversationContext(
  sessionType: SessionType,
  userId: string
): Promise<string> {
  let basePrompt: string
  if (sessionType === 'life_mapping') {
    basePrompt = getLifeMappingPrompt()
  } else if (sessionType === 'ad_hoc') {
    basePrompt = getAdHocPrompt()
  } else {
    basePrompt = getWeeklyCheckinBasePrompt()
  }
  // ... rest unchanged
}
```

**3c. Session state + chat routing**

`lib/supabase/session-state.ts` — The `mapping_complete` state already covers the between-check-ins case. No change needed to detection logic.

`app/(main)/chat/page.tsx` — Handle `?type=ad_hoc` query param:

```typescript
// If explicit ad_hoc type, use it
// If mapping_complete state with no explicit type, default to ad_hoc
const sessionType = searchParams.type === 'weekly_checkin'
  ? 'weekly_checkin'
  : searchParams.type === 'ad_hoc'
    ? 'ad_hoc'
    : stateResult.state === 'mapping_complete'
      ? 'ad_hoc'
      : 'life_mapping'
```

`components/chat/chat-view.tsx` — Update `getSageOpening()` to handle `ad_hoc`:
- For `mapping_complete` state with `ad_hoc` session type: Sage's opening is context-aware (from injected life context). The system prompt already instructs Sage to open with a specific thread.
- Remove the hardcoded quick replies for `mapping_complete` state (lines 69-76) since Sage now opens with a context-aware nudge.

**3d. Home screen + nav updates**

`app/(main)/home/page.tsx:136` — The `TalkToSageOrb` already links to `/chat`. Update to `/chat?type=ad_hoc` so it correctly creates an ad-hoc session.

**Optional: Context-preloaded ad-hoc from reflection nudge**

If the user taps a home screen reflection prompt, navigate to `/chat?type=ad_hoc&context=<prompt_id>`. The chat page can load the prompt text and prepend it to the conversation context.

**Files to modify:**
- `lib/ai/prompts.ts` (new `getAdHocPrompt()`)
- `lib/ai/context.ts:119-140` (add ad_hoc branch)
- `app/(main)/chat/page.tsx` (ad_hoc routing logic)
- `components/chat/chat-view.tsx` (opening message for ad_hoc, remove hardcoded quick replies for mapping_complete)
- `app/(main)/home/page.tsx:136` (update Talk to Sage link)

**Success criteria:**
- [x] Tapping "Talk to Sage" on home creates an `ad_hoc` session
- [x] Sage opens with a context-aware nudge referencing Life Map content
- [x] Ad-hoc sessions can write to `sage/context.md` and `sage/patterns.md` only
- [x] Ad-hoc sessions do NOT emit domain/overview/life-plan/check-in blocks
- [x] Lighter wrap-up, no formal synthesis card

---

#### Phase 4: Post-Session Content Generation

Generate all re-engagement content at session end while Claude context is warm.

**4a. New API route: `app/api/session/generate-reengagement/route.ts`**

Called after `completeSession()` from the client. Sends a single Claude request with the full session context to generate:

```typescript
interface ReengagementContent {
  reflectionPrompts: string[]         // 2-3 prompts for home screen
  day1Notification: { title: string; body: string }
  day3Notification: { title: string; body: string }
  checkinReminder: { title: string; body: string }
}
```

**System prompt for this call:**

```
You just finished a [session_type] session with [user_name]. Based on the conversation, generate re-engagement content.

Output as JSON:
{
  "reflectionPrompts": ["prompt1", "prompt2", "prompt3"],
  "day1Notification": { "title": "Sage", "body": "..." },
  "day3Notification": { "title": "Sage", "body": "..." },
  "checkinReminder": { "title": "Sage", "body": "..." }
}

Rules:
- Reflection prompts: warm "something to sit with" — NOT action items. Draw from specific session content.
- Day 1 notification: personal, references something specific. "I've been thinking about what you shared about [topic]..."
- Day 3 notification: lighter, less specific. "No rush. Your life map is here whenever you want it."
- Check-in reminder: references a specific commitment or priority. "Ready to check in on [commitment]?"
- All content should sound like Sage — warm, personal, not like a system notification.
```

Uses `claude-haiku-4-5-20251001` for this (cheaper, fast, doesn't need deep reasoning).

**4b. Client-side: trigger generation after session complete**

In `chat-view.tsx`, after `completeSession()` succeeds and the session complete card is shown, fire-and-forget:

```typescript
fetch('/api/session/generate-reengagement', {
  method: 'POST',
  body: JSON.stringify({
    sessionId,
    sessionType,
    // Include last few messages for context
    recentMessages: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
  }),
}).catch(() => console.error('Failed to generate re-engagement content'))
```

**4c. Server-side: store content and schedule notifications**

The API route:
1. Calls Claude Haiku with session context
2. Parses JSON response
3. Inserts `reflection_prompts` rows (2-3 per session)
4. Inserts `scheduled_notifications` rows:
   - `day_1`: `scheduled_for = now + 24h`, `url = '/home'`
   - `day_3`: `scheduled_for = now + 72h`, `url = '/home'`, `gate_condition = { "require_inactive_since": "<session_completed_at>" }`
   - `checkin_reminder`: `scheduled_for = now + 7 days - 12h` (reminder before check-in is due), `url = '/home'`

**Files to create:**
- `app/api/session/generate-reengagement/route.ts` (new)

**Files to modify:**
- `components/chat/chat-view.tsx` (fire-and-forget call after session complete)

**Success criteria:**
- [x] After session ends, re-engagement content is generated and stored
- [x] Reflection prompts appear in `reflection_prompts` table
- [x] Notifications appear in `scheduled_notifications` table with correct scheduling
- [x] Day 3 notification has gate condition for inactivity check
- [x] Uses Haiku model (cost-efficient)

---

#### Phase 5: Push Notification Infrastructure

Make the scaffolded push system actually send notifications.

**5a. VAPID key generation**

```bash
npx web-push generate-vapid-keys
```

Store as environment variables:
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — client-side (already referenced in `lib/notifications/push.ts:20`)
- `VAPID_PRIVATE_KEY` — server-side only (Edge Function)
- `VAPID_SUBJECT` — `mailto:` URI for VAPID (required by spec)

**5b. Rewrite Edge Function: `supabase/functions/send-notifications/index.ts`**

Rename from `check-in-reminder` to `send-notifications` (broader scope now).

```typescript
// Pseudocode — actual implementation uses web-push library for Deno
import webpush from 'npm:web-push'

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
)

// 1. Query scheduled_notifications WHERE scheduled_for <= now AND sent_at IS NULL AND cancelled_at IS NULL
// 2. For each notification:
//    a. Check gate_condition (if day_3, verify user.last_active_at < gate threshold)
//    b. Look up push_subscriptions for user
//    c. Send via webpush.sendNotification()
//    d. Mark sent_at = now()
//    e. On failure (expired subscription): delete subscription row
```

**5c. Cron schedule**

Add to `supabase/config.toml` or via Supabase dashboard:

```toml
[functions.send-notifications]
schedule = "0 * * * *"  # Every hour
```

**5d. Update service worker default URL**

`public/sw.js:66` — Change default notification URL from `/chat?type=weekly_checkin` to `/home`:

```javascript
data: { url: data.url || '/home' },
```

`public/sw.js:75` — Same for notification click:

```javascript
const url = event.notification.data?.url || '/home'
```

**5e. Track last_active_at**

Add middleware or layout-level tracking to update `users.last_active_at` on page loads.

`app/(main)/layout.tsx` — Add a client component that fires on mount:

```typescript
// components/activity-tracker.tsx
'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function ActivityTracker() {
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('users').update({ last_active_at: new Date().toISOString() }).eq('id', user.id)
      }
    })
  }, [])
  return null
}
```

Render in the main layout. Fire-and-forget — don't await, don't block rendering.

**Files to create:**
- `supabase/functions/send-notifications/index.ts` (new, replaces check-in-reminder)
- `components/activity-tracker.tsx` (new)

**Files to modify:**
- `public/sw.js:66,75` (default URL → `/home`)
- `app/(main)/layout.tsx` (add ActivityTracker)
- `.env.local` / Supabase dashboard (VAPID keys)

**Success criteria:**
- [ ] VAPID keys generated and configured (requires `npx web-push generate-vapid-keys` + env vars)
- [x] Edge Function sends actual web push notifications
- [ ] Cron runs hourly, processes pending notifications (requires Supabase dashboard config)
- [x] Day 3 notifications gated on `last_active_at`
- [x] Expired subscriptions cleaned up on send failure
- [x] Service worker navigates to `/home` on notification click
- [x] `last_active_at` updates on app usage

---

#### Phase 6: Home Screen Reflection Nudge

Surface pre-computed reflection prompts on the home screen.

**6a. Data loading**

`lib/supabase/home-data.ts` — Add to `getHomeData()`:

```typescript
// Fetch latest unused reflection prompt
const { data: nudge } = await supabase
  .from('reflection_prompts')
  .select('id, prompt_text, context_hint')
  .eq('user_id', userId)
  .is('used_at', null)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()
```

Add to `HomeData` interface:
```typescript
reflectionNudge: { id: string; text: string; contextHint: string | null } | null
```

**6b. Home screen UI**

`app/(main)/home/page.tsx` — Between the Sage contextual line and the north star card, show a reflection nudge card if available:

```tsx
{homeData.reflectionNudge && (
  <ReflectionNudgeCard
    nudge={homeData.reflectionNudge}
  />
)}
```

**New component: `components/home/reflection-nudge-card.tsx`**

- Warm design: slightly elevated card with cream/sage background
- Copy: "Something to sit with:" + the prompt text
- Tap → navigates to `/chat?type=ad_hoc&nudge=<nudge_id>`
- On tap, mark `used_at = now()` on the reflection_prompts row

**6c. Chat preloading from nudge**

`app/(main)/chat/page.tsx` — If `?nudge=<id>` param present:
1. Load the reflection prompt text
2. Pass to `ChatView` as `contextNudge` prop
3. Include in the system prompt: "The user is responding to this reflection prompt: '[prompt text]'. Open by acknowledging it."

**Files to modify:**
- `lib/supabase/home-data.ts` (load nudge)
- `app/(main)/home/page.tsx` (render nudge card)
- `components/home/reflection-nudge-card.tsx` (new)
- `app/(main)/chat/page.tsx` (nudge preloading)
- `components/chat/chat-view.tsx` (contextNudge prop handling)

**Success criteria:**
- [x] Home screen shows reflection prompt when one exists
- [x] Tapping nudge navigates to ad-hoc chat with context
- [x] Used nudges are marked and not shown again
- [x] Nudge card follows warm design system (cream, sage accents)

---

## Acceptance Criteria

### Functional Requirements

- [x] Life mapping sessions end with Sage-initiated closing + session complete card + Life Map CTA
- [x] Weekly check-ins end with summary + next check-in date + session complete card
- [x] Message input disabled after session completion
- [x] "Talk to Sage" creates `ad_hoc` sessions with context-aware opening
- [x] Ad-hoc sessions write only to `sage/context.md` and `sage/patterns.md`
- [ ] Push notifications actually deliver to subscribed users (requires VAPID keys + cron)
- [x] Day 1 notification fires ~24hrs after first life mapping
- [x] Day 3 notification fires only if user hasn't returned
- [x] Check-in reminder fires ~12hrs before check-in is due
- [x] Notification tap → home screen
- [x] Home screen shows reflection prompt between sessions
- [x] Tapping reflection prompt → ad-hoc session with context

### Non-Functional Requirements

- [x] Re-engagement content generation uses Haiku (cost-efficient)
- [x] No cold-start inference for notifications (all pre-generated)
- [x] Fire-and-forget for non-critical writes (activity tracking, content generation)
- [x] Push subscription cleanup on expired endpoints

### Quality Gates

- [x] `npm run type-check` passes with new `ad_hoc` session type
- [x] `npm run build` succeeds
- [ ] Migration runs clean on Supabase (requires `npx supabase db push`)
- [ ] Manual test: complete life mapping → verify closing ritual + content generation
- [ ] Manual test: return next day → verify home nudge + ad-hoc session
- [ ] Manual test: receive push notification → tap → land on home

## Dependencies & Prerequisites

- VAPID keys must be generated before Phase 5
- Supabase dashboard access for cron schedule configuration
- `web-push` npm package (Edge Function dependency)
- Claude API key with access to `claude-haiku-4-5-20251001` for content generation

## Risk Analysis & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| VAPID key misconfiguration | Push notifications silently fail | Test with a single subscription first, log all push errors |
| Claude Haiku returns malformed JSON | No re-engagement content generated | Wrap in try/catch, fall back to template-based content |
| Edge Function cold starts delay notifications | Notifications arrive late | Hourly cron is acceptable tolerance; notifications aren't time-critical |
| User completes session but content generation fails | No nudges/notifications | Client fire-and-forget is fine — next session will generate new content |
| `ad_hoc` session type breaks existing session queries | Errors on chat/history pages | Query updates are minimal (add to VALID_SESSION_TYPES, history already filters by status not type) |

## References

### Internal References

- Brainstorm: `docs/brainstorms/2026-02-16-retention-sprint-brainstorm.md`
- UX Audit: `Docs/feedback/20260216_MeOS_UX_Architecture.md` (Gaps 1-4, 8)
- Session lifecycle: `lib/supabase/sessions.ts:77-104`
- Session state detection: `lib/supabase/session-state.ts:24-134`
- System prompts: `lib/ai/prompts.ts`
- Context injection: `lib/ai/context.ts:119-140`
- Write permissions: `lib/markdown/constants.ts:47-58`
- Push infrastructure: `lib/notifications/push.ts`, `public/sw.js`, `supabase/functions/check-in-reminder/`
- Home data: `lib/supabase/home-data.ts`
- Chat view (session completion): `components/chat/chat-view.tsx:710-731`
- Session type constraint: `supabase/migrations/001_initial_schema.sql:127`
- Security learnings: `Docs/solutions/security-issues/markdown-storage-security-review-fixes.md`

### Institutional Learnings Applied

- Deny-by-default write permissions for new session types (from security review)
- `Promise.allSettled()` for parallel reads (from performance review)
- Fire-and-forget for non-blocking DB updates (from security review)
- Level-aware markdown extraction for commitment parsing (from heading boundary bug)
