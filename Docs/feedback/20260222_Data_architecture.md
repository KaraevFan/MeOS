# MeOS Data Architecture Fix Spec

> For Claude Code implementation
> Priority: P0 fixes first, then P1s
> Reference: `/Users/tomoyukikano/Desktop/Projects/Kairn/Docs/generated/20260222_data_architecture_audit.md` for full context

---

## Context: The Three-Layer Model

MeOS artifacts operate in three layers with distinct update cadences:

- **Layer 1 — Life Map (quarterly):** Identity, values, domain states, long-term aspirations. The "constitution." Updated through life mapping and quarterly reviews. Should feel stable and weighty.
- **Layer 2 — Life Plan (weekly):** Active priorities, projects, recurring commitments, open threads. The "operating plan." Updated through weekly reflections. Feeds daily planning.
- **Layer 3 — Daily Plan (daily):** Today's intention, tasks, mood, captures. Ephemeral. Created in morning session, optionally enriched by evening session.

**The core problem:** Layer 2 doesn't exist as a distinct artifact. `life-plan/current.md` conflates quarterly commitments (Layer 1) with weekly status (Layer 2). Morning briefs pull from quarterly commitments instead of weekly priorities. Daily priorities stored in `day_plans` JSONB are invisible to the next day's morning brief and to weekly reflections.

---

## Ticket 1: Daily Priority Carry-Forward (P0)

### Problem
When a user skips Close Day, uncompleted priorities from `day_plans.priorities` (JSONB) don't carry forward. Tomorrow's `open_day` reads `day-plans/{yesterday}.md` (markdown narrative) and `captures/{yesterday}-*.md`, but NOT the structured priority list or open threads from the `day_plans` table.

### Fix
Add `day_plans` table read to the `open_day` context injection pipeline.

### Implementation

1. **In the context injection function for `open_day` sessions** (likely in `fetchAndInjectFileContext()` or equivalent), add a query:

```sql
SELECT priorities, open_threads, energy_level, intention
FROM day_plans
WHERE user_id = $1
  AND date = (CURRENT_DATE AT TIME ZONE $2) - INTERVAL '1 day'
LIMIT 1;
```

2. **Parse `priorities` JSONB** and filter to uncompleted items:

```typescript
const uncompleted = yesterday.priorities?.filter(p => !p.completed) ?? [];
const unresolvedThreads = yesterday.open_threads?.filter(t => !t.resolved) ?? [];
```

3. **Inject as a structured section** in the open_day context, AFTER the existing yesterday's-plan markdown injection:

```
## CARRY FORWARD FROM YESTERDAY

### Uncompleted Priorities
{{for each uncompleted priority}}
- [ ] {{priority.text}} (set yesterday, not completed)
{{end}}

### Unresolved Open Threads
{{for each unresolved thread}}
- {{thread.text}} (from {{thread.source || 'yesterday'}})
{{end}}

Note: These items were on yesterday's plan but weren't completed. Surface them naturally in the morning brief — the user should decide whether to carry them forward, defer, or drop them. Don't guilt them about it.
```

4. **Update the open_day system prompt** to acknowledge carry-forward data. Add an instruction like:

```
If there are uncompleted priorities or unresolved threads from yesterday, mention them
naturally during the briefing. Frame them as "still on your plate" rather than "you didn't
finish these." Let the user decide what to carry forward vs. drop. If they crossed things
off or the items are stale, acknowledge that and move on.
```

### Acceptance Criteria
- If user completes 1 of 3 priorities on Monday and skips Close Day, Tuesday's morning brief surfaces the 2 uncompleted priorities
- If user completes all priorities, morning brief acknowledges clean slate
- If there are no yesterday day_plans (first day, or gap), the carry-forward section is simply omitted — no error, no empty section
- Carry-forward items are presented as options, not obligations

---

## Ticket 2: Weekly Planning Artifact (P0)

### Problem
There is no weekly-scoped planning artifact. `life-plan/current.md` holds quarterly commitments but no "this week's priorities." Morning briefs reference broad quarterly commitments instead of focused weekly goals. The weekly check-in produces a retrospective summary (`check-ins/{date}-weekly.md`) but no forward-looking weekly plan.

### Design Decision
Create a new `life-plan/weekly.md` artifact that is:
- **Written by:** `weekly_checkin` session (as a final output alongside the check-in summary)
- **Read by:** `open_day` session (as the primary source for morning brief priorities)
- **Lifecycle:** Regenerated each weekly check-in. The previous week's file is overwritten, not versioned (the check-in summary in `check-ins/` preserves the historical record).

### Schema

**File path:** `life-plan/weekly.md`
**Type ID:** `weekly-plan`

**Frontmatter:**
```yaml
---
type: weekly-plan
week_of: "2026-02-23"           # Monday of the week this plan covers
created_from_session: "uuid"     # The weekly_checkin session that produced this
priorities:
  - text: "Ship calendar integration for MeOS"
    domain: "career"
    commitment_ref: "### Build and validate MeOS MVP"  # Links to quarterly commitment
    status: "active"
  - text: "Schedule dentist appointment"
    domain: "health"
    commitment_ref: null           # Not tied to a quarterly commitment
    status: "active"
  - text: "Plan weekend hike with friends"
    domain: "relationships"
    commitment_ref: null
    status: "active"
active_projects:
  - name: "MeOS MVP"
    status: "in_progress"
    next_milestone: "External demo ready"
  - name: "RSU rebalancing"
    status: "completed"
recurring_this_week:
  - "Sunday money check-in"
  - "Wednesday gym session"
carried_threads:
  - text: "Start learning to sketch"
    source: "morning capture, Feb 22"
    action: "explore"              # explore | act | defer | drop
---
```

**Content (markdown body):**
```markdown
## This Week's Focus

{{Sage's narrative framing of the week — 2-3 sentences connecting priorities
to the broader life plan. E.g., "This week is about building momentum on MeOS
while keeping the basics running. You've cleared the RSU rebalancing, so
finances are in maintenance mode. The real unlock is getting calendar integration
shipped so you can demo to friends next week."}}

## Priorities

1. **Ship calendar integration for MeOS** — Connected to: Build and validate MeOS MVP
2. **Schedule dentist appointment** — You've been putting this off
3. **Plan weekend hike with friends** — Relationships need some active investment

## Active Projects

- **MeOS MVP** — In progress. Next milestone: external demo ready
- **RSU rebalancing** — ✅ Completed this week

## Open Threads

- Start learning to sketch (captured Sunday morning — worth exploring this week?)

## Recurring

- Sunday money check-in
- Wednesday gym session
```

### Implementation

1. **Register the new file type** in the UserFileSystem / file type registry:
   - Type ID: `weekly-plan`
   - Path pattern: `life-plan/weekly.md`
   - Frontmatter schema: `WeeklyPlanFrontmatterSchema` (define using the schema above)
   - Layer: 2

2. **Add write permission** for `weekly_checkin` sessions to write `life-plan/weekly.md`:
   - Update the session write permissions matrix to include `life-plan/weekly.md` for `weekly_checkin`
   - The `weekly_checkin` prompt already has write access to `life-plan/` so this may already be permitted, but verify

3. **Update the `weekly_checkin` system prompt** to produce this artifact as a final output:

   Add to the weekly check-in prompt instructions:
   ```
   At the end of the weekly check-in, after summarizing the week and updating
   commitment statuses, produce a WEEKLY PLAN for the coming week.

   The weekly plan should include:
   - Top 3-5 priorities for the week (drawn from quarterly commitments + new items that emerged)
   - Active projects with current status and next milestone
   - Any recurring commitments for the week
   - Open threads carried forward (unresolved items from this week that deserve attention)

   Write this as a [WEEKLY_PLAN] structured block that will be saved to life-plan/weekly.md.
   Frame priorities as choices — the user has limited time and energy, so help them focus
   rather than listing everything.

   Important: The weekly plan is a FORWARD-LOOKING document. It's "what matters next week,"
   not a summary of last week (that's what the check-in summary is for).
   ```

4. **Update `open_day` context injection** to read `life-plan/weekly.md`:
   - Add `life-plan/weekly.md` to the file list in `fetchAndInjectFileContext()` for `open_day` sessions
   - This should be injected BEFORE or INSTEAD OF the full `life-plan/current.md` quarterly commitments (or alongside it with clear labeling)
   - The morning brief should anchor on weekly priorities, not quarterly commitments
   - If `life-plan/weekly.md` doesn't exist yet (user hasn't done a weekly check-in), fall back to `life-plan/current.md` as currently

5. **Update the open_day system prompt** to reference weekly priorities:
   ```
   When briefing the user on their day, anchor on their WEEKLY PRIORITIES
   (from life-plan/weekly.md) rather than their quarterly commitments.
   The weekly plan tells you what they decided to focus on this week.
   Help them pick 1-3 things from the weekly priorities that make sense for TODAY,
   given their energy, calendar, and what happened yesterday.

   If no weekly plan exists yet (they haven't done a weekly check-in), fall back
   to the quarterly commitments in life-plan/current.md.
   ```

6. **Add `life-plan/weekly.md` read to the weekly_checkin context injection** too — so the next weekly check-in can reference what was planned last week vs. what actually happened. This closes the loop.

### Acceptance Criteria
- After a weekly check-in, `life-plan/weekly.md` exists with valid frontmatter and content
- The next morning's `open_day` brief references the weekly priorities, not just quarterly commitments
- If no weekly plan exists, morning brief gracefully falls back to quarterly commitments
- Weekly priorities connect to quarterly commitments where relevant (via `commitment_ref`)
- The weekly plan includes carried threads from the previous week's unresolved items

---

## Ticket 3: Weekly Reflection Home Screen Trigger (P1)

### Problem
The Home screen doesn't prompt users to do their weekly reflection. On the user's reflection day (default: Sunday), the Home screen should feature the weekly reflection as the primary action.

### Implementation

1. **Determine if today is the user's reflection day:**
   - Check `users.next_checkin_at` or use a default (Sunday)
   - Also check: has the user already completed a `weekly_checkin` session this week?

2. **On the Home screen, when it's reflection day AND no weekly check-in has been completed this week:**
   - Show a hero card above or replacing the "Day Plan Set" card:
     ```
     ┌─────────────────────────────────────┐
     │  🔄  WEEKLY REFLECTION              │
     │                                     │
     │  It's Sunday — time to look back    │
     │  on the week and set priorities     │
     │  for the next one.                  │
     │                                     │
     │  [Start Weekly Reflection]          │
     │                                     │
     │  ~10 min · Reviews your week        │
     └─────────────────────────────────────┘
     ```
   - The "Start Weekly Reflection" button should initiate a `weekly_checkin` session type

3. **The three ritual buttons (Open Day / Capture / Close Day) should still be accessible** — the weekly reflection card is additive, not replacing them. Users might want to do their morning session first, then the weekly reflection. Or vice versa.

4. **After the weekly reflection is complete**, the hero card should update to show the new weekly plan:
   ```
   ┌─────────────────────────────────────┐
   │  ✅  WEEKLY PLAN SET                │
   │                                     │
   │  This week's focus:                 │
   │  1. Ship calendar integration       │
   │  2. Schedule dentist appointment    │
   │  3. Plan weekend hike               │
   │                                     │
   │  [View Full Plan]                   │
   └─────────────────────────────────────┘
   ```

5. **If the user opens the app on Monday and hasn't done a weekly reflection**, show a gentler nudge:
   ```
   ┌─────────────────────────────────────┐
   │  You haven't set your weekly plan   │
   │  yet. [Do it now] or [Skip]         │
   └─────────────────────────────────────┘
   ```
   After Monday, stop showing the nudge. Don't guilt them. The morning brief will fall back to quarterly commitments.

### Acceptance Criteria
- On Sunday (or user's configured reflection day), the Home screen shows the weekly reflection card prominently
- The card correctly detects whether a weekly check-in has already been completed this week
- After completing a weekly reflection, the card updates to show the weekly plan summary
- On Monday, a gentle nudge appears if the reflection wasn't done. By Tuesday, the nudge disappears
- The weekly reflection card doesn't block access to Open Day / Capture / Close Day

---

## Ticket 4: Feed Daily Plan Data into Weekly Check-in (P1)

### Problem
The `weekly_checkin` context injection reads `daily-logs/*.md` (journal narratives) but ignores:
- `day-plans/*.md` files (morning intentions, focus blocks)
- `day_plans.priorities` JSONB (what was planned vs. completed each day)
- `day_plans.open_threads` JSONB (unresolved threads)

This means the weekly reflection has narrative data but not operational data — it can't close the loop on "what did you plan vs. what actually happened."

### Implementation

1. **Query the `day_plans` table for all entries since the last weekly check-in:**

```sql
SELECT date, intention, energy_level, priorities, open_threads, evening_reflection
FROM day_plans
WHERE user_id = $1
  AND date >= $2  -- last check-in date
  AND date <= CURRENT_DATE AT TIME ZONE $3
ORDER BY date ASC;
```

2. **Compute a lightweight summary:**

```typescript
const weekSummary = {
  daysPlanned: dayPlans.length,
  totalPriorities: dayPlans.reduce((sum, d) => sum + (d.priorities?.length || 0), 0),
  completedPriorities: dayPlans.reduce((sum, d) =>
    sum + (d.priorities?.filter(p => p.completed)?.length || 0), 0),
  intentions: dayPlans.map(d => ({ date: d.date, intention: d.intention })),
  unresolvedThreads: dayPlans
    .flatMap(d => (d.open_threads || []).filter(t => !t.resolved))
    .filter(unique), // deduplicate
  avgEnergy: average(dayPlans.map(d => d.energy_level).filter(Boolean)),
};
```

3. **Inject as a structured section** in the weekly check-in context:

```
## WEEK IN NUMBERS ({{start_date}} — {{end_date}})

Days with morning sessions: {{daysPlanned}} / 7
Priorities set: {{totalPriorities}} | Completed: {{completedPriorities}} ({{completionRate}}%)
Average energy: {{avgEnergy}}/5

### Daily Intentions This Week
{{for each day}}
- **{{day.date}}**: "{{day.intention}}" {{if completed}}✅{{else}}—{{end}}
{{end}}

### Unresolved Threads (carried across multiple days)
{{for each thread}}
- {{thread.text}} (first appeared: {{thread.date}})
{{end}}

Use this operational data alongside the daily journals to give the user a complete
picture of their week. Note patterns: are they completing priorities? Is energy
trending? Are the same threads lingering unresolved?
```

4. **Also read `day-plans/*.md` markdown files** for the week and inject the content (or summaries) so Sage has the narrative context of each morning's briefing alongside the structured data.

### Acceptance Criteria
- Weekly check-in context includes operational data from `day_plans` table
- Sage can reference specific daily intentions and completion rates during the reflection
- Unresolved threads that persisted across multiple days are surfaced
- Energy trends are visible to Sage for pattern detection
- If there are no day_plans records (user didn't use morning sessions), this section is simply omitted

---

## Ticket 5: Protect Life Map Writes with User Confirmation (P1)

### Problem
Two session types can write to `life-map/` files in ways that bypass user confirmation:
1. `ad_hoc_explore` — casual "let's talk about career" conversations can silently update domain files
2. `weekly_checkin` — prompt says it can update domains "if status changed" but doesn't guard against deep content rewrites

### Design Decision
We're NOT removing write permissions from these session types. Users don't distinguish between session types — if they have a breakthrough insight during a casual chat, it should be capturable. But the writes should be **explicit and confirmed**.

### Implementation

**For `ad_hoc_explore` sessions:**

1. Update the system prompt to require user confirmation before Life Map writes:

```
If during this conversation you identify an insight that would meaningfully update
the user's Life Map (e.g., a shift in how they think about a domain, a new tension,
a resolved goal), DO NOT silently update the Life Map.

Instead:
1. Surface the insight explicitly: "This sounds like a real shift in how you think
   about [domain]. Your Life Map currently says [X] — should I update it to reflect [Y]?"
2. Wait for the user to confirm
3. Only then emit the [LIFE_MAP_UPDATE] structured block

If the insight is minor or you're not sure it's a real shift, capture it in
sage/context.md instead. It will surface naturally during the next weekly or
quarterly review.
```

**For `weekly_checkin` sessions:**

2. Add a guard to the system prompt limiting the scope of Life Map writes:

```
During weekly check-ins, you may update life-map domain files, but ONLY:
- The `status` field (e.g., thriving → stable → needs_attention)
- The `score` field (1-5 rating)
- Brief additions to the "what's changed recently" section

Do NOT rewrite the core domain content (current state narrative, core tensions,
long-term desires) during a weekly check-in. Those deeper rewrites should happen
during a life_mapping session or quarterly review.

If you notice something that warrants a deeper domain rewrite, note it in
sage/context.md and flag it: "Worth exploring [domain] in depth next time."
```

### Acceptance Criteria
- Ad hoc conversations surface Life Map change proposals explicitly before writing
- User must confirm before any Life Map mutation happens in ad hoc sessions
- Weekly check-ins are limited to status/score updates on domain files
- Deeper content changes are deferred to life_mapping or quarterly_review sessions
- Observations that don't meet the write threshold are captured in sage/context.md

---

## Ticket 6: Fix Google Calendar OAuth Error (P1)

### Problem
Clicking "Connect" on the Google Calendar widget on the Home screen produces: `Access blocked: Authorization Error — Missing required parameter: client_id — Error 400: invalid_request`

### Likely Cause
The OAuth authorization URL is being constructed without the `client_id` parameter. This usually means:
1. The `GOOGLE_CLIENT_ID` environment variable is not set in the production/deployed environment, OR
2. The code that builds the Google OAuth URL is not reading the env var correctly

### Investigation Steps

1. **Check the API route that handles the calendar connect flow** — likely something like `app/api/auth/google-calendar/route.ts` or `app/api/integrations/google/route.ts`

2. **Verify the OAuth URL construction:**
```typescript
// It should look something like:
const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!); // Is this set?
authUrl.searchParams.set('redirect_uri', process.env.GOOGLE_REDIRECT_URI!);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.readonly');
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');
```

3. **Check environment variables** in the deployment (Vercel, or wherever this is hosted):
   - `GOOGLE_CLIENT_ID` — must be set
   - `GOOGLE_CLIENT_SECRET` — must be set
   - `GOOGLE_REDIRECT_URI` — must point to the correct callback URL for the deployed domain

4. **Check Google Cloud Console:**
   - The OAuth consent screen must be configured
   - The OAuth 2.0 Client ID must have the correct authorized redirect URIs matching your deployed domain
   - If the app is in "Testing" mode, only test users can authorize

### Acceptance Criteria
- Clicking "Connect" on the Google Calendar widget opens Google's OAuth consent screen (not an error)
- After authorization, calendar events are fetched and displayed
- Token refresh works correctly for returning users

---

## Implementation Order

| Order | Ticket | Effort | Impact |
|-------|--------|--------|--------|
| 1 | Ticket 1: Daily Priority Carry-Forward | Small (1-2 hrs) | Fixes the most visible daily UX gap |
| 2 | Ticket 6: Fix Calendar OAuth | Small (30 min) | Unblocks calendar integration testing |
| 3 | Ticket 2: Weekly Planning Artifact | Medium (3-4 hrs) | The architectural fix that makes Layer 2 real |
| 4 | Ticket 3: Weekly Reflection Home Trigger | Medium (2-3 hrs) | Makes the weekly loop discoverable |
| 5 | Ticket 4: Daily Data → Weekly Check-in | Medium (2-3 hrs) | Closes the upward data flow loop |
| 6 | Ticket 5: Life Map Write Guards | Small (1 hr) | Prompt-only changes, no code |

---

## Anti-Patterns to Avoid

- **Don't break the existing carry-forward for captures.** The current flow where `captures/{yesterday}-*.md` surfaces in morning briefs is working well. The new `day_plans` carry-forward is additive.
- **Don't make the weekly plan mandatory.** If a user never does a weekly check-in, the morning brief should gracefully fall back to quarterly commitments. No errors, no empty states.
- **Don't version weekly plans.** The check-in summaries in `check-ins/` already serve as the historical record. `life-plan/weekly.md` is a living document that gets overwritten each week.
- **Don't inject too much context into prompts.** The "Week in Numbers" summary for the weekly check-in should be concise — raw JSONB dumps will waste tokens and confuse the model.
- **Don't guilt users about missed rituals.** Carry-forward items are options, not obligations. Missed weekly reflections get a gentle one-day nudge, then silence.