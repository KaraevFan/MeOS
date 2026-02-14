# MeOS Architectural Audit Report

**Date:** 2026-02-13
**Scope:** Full codebase audit for agentic evolution readiness
**Status:** Sprint 1 MVP complete, evaluating path to Phase 1 (tool use)

---

## Verdict: EXTEND — with 3 targeted refactors

The codebase is well-structured MVP code with clean separation of concerns. The agentic layers can be added incrementally without a rewrite. However, **three specific refactors are prerequisites** before adding tool use, and ignoring them will create compounding debt that eventually forces a rewrite. The architecture is ~75% ready for Phase 1.

---

## Architecture Fit Scores

| Area | Rating | Summary |
|------|--------|---------|
| **Database Schema** | Needs Work | Solid foundation, missing indexes and future tables. Additive changes only. |
| **API / Chat Endpoint** | Needs Work | Clean but single-shot streaming. Must be restructured for tool use loops. |
| **Conversation Engine** | Ready | Parser is extensible, prompts are modular. Cleanest part of the codebase. |
| **Frontend** | Ready | Modular component structure. Approval cards are a natural extension. |
| **Code Quality** | Needs Work | Silent failures, no AbortController, client-side persistence is fragile. |

---

## 1. Schema Gap Analysis

### What Exists (7 tables)

`users`, `life_maps`, `life_map_domains`, `sessions`, `messages`, `patterns`, `push_subscriptions` — all with RLS policies, cascade deletes, and proper FK relationships.

**Current schema strengths:**
- Complete RLS on all tables with `auth.uid()` checks
- Proper FK cascades for user deletion
- CHECK constraints on enums (session_type, status, domain_status)
- `updated_at` triggers on mutable tables

### What's Missing for Phase 1

**New tables needed:**

```sql
-- Intentions: structured commitments extracted from conversations
CREATE TABLE intentions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain_id uuid REFERENCES life_map_domains(id) ON DELETE SET NULL,
  description text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('one_time', 'recurring', 'habit')),
  frequency text,  -- 'daily', 'weekly', 'custom'
  constraints jsonb,  -- time bounds, conditions
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'abandoned')),
  source_session_id uuid REFERENCES sessions(id),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- Agent actions: audit trail of what tools Sage invoked
CREATE TABLE agent_actions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  tool_input jsonb NOT NULL,
  tool_output jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed', 'failed')),
  requires_approval boolean DEFAULT false,
  approved_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- User preferences: learned + explicit settings
CREATE TABLE user_preferences (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  timezone text DEFAULT 'UTC',
  notification_frequency text DEFAULT 'weekly',
  checkin_day text DEFAULT 'sunday',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Schema Issues to Fix Now

**1. No indexes on any FK column.** Every query does a full table scan.

```sql
CREATE INDEX idx_sessions_user_status ON sessions(user_id, status);
CREATE INDEX idx_sessions_user_type ON sessions(user_id, session_type);
CREATE INDEX idx_messages_session ON messages(session_id, created_at);
CREATE INDEX idx_life_maps_user_current ON life_maps(user_id) WHERE is_current = true;
CREATE INDEX idx_patterns_user_active ON patterns(user_id) WHERE is_active = true;
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX idx_life_map_domains_map ON life_map_domains(life_map_id);
```

**2. Missing unique constraint on `push_subscriptions`.** The code does `.upsert(..., { onConflict: 'user_id,endpoint' })` but no unique constraint exists. Upsert silently creates duplicates.

```sql
ALTER TABLE push_subscriptions
  ADD CONSTRAINT push_subscriptions_user_endpoint_unique UNIQUE (user_id, endpoint);
```

**3. `messages.role` only allows `'user' | 'assistant'`.** Tool use requires `'tool'` role messages.

```sql
ALTER TABLE messages DROP CONSTRAINT messages_role_check;
ALTER TABLE messages ADD CONSTRAINT messages_role_check
  CHECK (role IN ('user', 'assistant', 'tool'));
```

**4. `text[]` columns limit future queryability.** Multiple columns on `life_maps`, `life_map_domains`, and `sessions` use `text[]` arrays (quarterly_priorities, whats_working, commitments_made, etc.). These work for MVP but can't be efficiently indexed, searched, or enriched with metadata. Convert critical fields (like `commitments_made`) to dedicated tables when building the intentions system.

**5. `life_maps.is_current` boolean is fragile.** No unique constraint prevents multiple "current" maps per user. Race conditions possible.

```sql
CREATE UNIQUE INDEX idx_life_maps_one_current_per_user
  ON life_maps(user_id) WHERE is_current = true;
```

### Life Map as "Brain Layer" Assessment

The relational model (life_maps -> domains -> intentions) is the right structure for agentic queries. An orchestrator can efficiently query "all active intentions in domains with status needs_attention" — something flat markdown files can't do. **This is the moat.** The missing piece is the `intentions` table to bridge "what Sage knows" with "what Sage can do."

---

## 2. API Architecture

### Current Architecture (single-shot streaming)

```
Client -> POST /api/chat -> buildContext() -> Claude stream -> SSE chunks -> Client saves to DB
```

**4 API routes exist:**

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/chat` | POST | Claude streaming conversations | Required |
| `/api/transcribe` | POST | Whisper speech-to-text | Required |
| `/api/push/subscribe` | POST | Push notification subscription | Required |
| `/auth/callback` | GET | Supabase OAuth callback | N/A |

### Why the Chat Route Breaks with Tool Use

Claude's tool use requires a **loop**: Claude responds with a `tool_use` block -> server executes the tool -> sends `tool_result` back to Claude -> Claude continues responding. The current code does one call and streams the result. There's no loop.

Specifically in `app/api/chat/route.ts:57-65`:

```typescript
const messageStream = anthropic.messages.stream({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1024,
  system: systemPrompt,
  messages: messages.map((m) => ({ role: m.role, content: m.content })),
  // No `tools` parameter
  // No stop_reason check
  // No continuation after tool execution
})
```

### Required Refactor: Tool Use Loop

```
Client -> POST /api/chat
  -> Build context + tool definitions
  -> Claude stream (may return text OR tool_use blocks)
  -> If tool_use: execute tool server-side -> send tool_result -> Claude continues
  -> If requires_approval: stream approval request to client -> wait -> continue
  -> Stream final text to client
  -> Save messages server-side (not client-side)
```

The current streaming infrastructure (SSE, ReadableStream) is fine — it just needs the inner loop logic. The Anthropic SDK's `stream()` method already supports `stop_reason: 'tool_use'` detection.

### Other API Observations

- **No rate limiting** on any endpoint. Must add before production.
- **No request timeout.** If Claude hangs, the stream stays open forever.
- **Auth pattern is solid** — PKCE via `@supabase/ssr`, middleware-enforced redirects, all routes check `getUser()`.
- **Clean route placement.** New endpoints for intentions, agent actions, approval queue fit naturally into `/api/intentions/`, `/api/agent/`, etc.
- **No CORS headers explicitly set.** OK for same-origin PWA, but should be explicit.
- **No request size limits.** Messages array and audio blobs accepted without bounds.
- **Context building queries are sequential** (`lib/ai/context.ts`). Five DB queries run one after another for weekly check-in context. Should use `Promise.all()` for the independent ones.
- **No token counting.** Context injection has no measurement — relies on Claude's 200K window being large enough.

### Client-Side Persistence Problem

All message persistence happens in `chat-view.tsx` after streaming:

```typescript
// Save assistant message to DB (fire-and-forget)
await supabase.from('messages').insert({
  session_id: sessionId,
  role: 'assistant',
  content: accumulated,
  has_structured_block: hasBlock,
})
```

If this insert fails, the message appears in the UI but is lost on refresh. For tool use, persistence **must** move server-side — tool_use and tool_result messages are invisible to the client and must be saved by the API.

---

## 3. Conversation Engine

### Parser (`lib/ai/parser.ts`) — Excellent

The `BLOCK_TAGS` array + `parseBlockContent()` switch is exactly the right abstraction for extensibility. Adding a new block type is mechanical:

1. Add to `BLOCK_TAGS`: `{ open: '[TOOL_REQUEST]', close: '[/TOOL_REQUEST]', type: 'tool_request' }`
2. Add type to `StructuredBlock` union in `types/chat.ts`
3. Add parser function + switch case
4. Add rendering component in chat UI

**Design decision for tool use:** With Claude tool use, Sage wouldn't output `[TOOL_REQUEST]` text blocks — Claude's API returns structured `tool_use` content blocks in JSON. The custom tag parser is great for **display blocks** (domain cards, approval cards) but tool execution flows through the API-level tool use protocol, not text parsing.

**Recommendation:** Keep the tag-based parser for display blocks. Handle tool use at the API level. They complement each other.

**Parser robustness:**
- Missing closing tag -> fails gracefully (returns as plain text)
- Invalid status enum -> defaults to `'stable'`
- Invalid energy level -> defaults to `null`
- Multiple blocks in one message -> only first block parsed (limitation, but acceptable)
- Has unit tests in `lib/ai/parser.test.ts` (189 lines, good coverage)

**Streaming parser** (`parseStreamingChunk()`) detects pending vs completed blocks, enabling `BuildingCardPlaceholder` UI during block generation.

### Prompt Architecture (`lib/ai/prompts.ts`) — Clean

Two functions: `getLifeMappingPrompt()` and `getWeeklyCheckinPrompt()`. Modular, return strings.

To add tools, no prompt restructuring needed — tool definitions are a separate parameter in the Claude API:

```typescript
anthropic.messages.stream({
  system: systemPrompt,
  messages: [...],
  tools: getToolDefinitions(),  // Separate from prompts
})
```

**Observations:**
- Prompts are ~1,200 tokens (life mapping) and ~800-1,200 + context (check-in)
- 8 life domains hardcoded in prompt text — should be sourced from constants
- Opening messages hardcoded in `chat-view.tsx`, not in prompts
- No monthly/quarterly review prompts (mentioned in vision, not yet needed)
- No pattern extraction block type — patterns only injected as context, never created from sessions

### Context Building (`lib/ai/context.ts`) — Functional

- Life mapping: returns static prompt (no DB queries, correct — no context exists yet)
- Weekly check-in: queries life map, domains, last 5 session summaries, patterns, last commitment
- Clean boundary: context is "what Sage knows" (read-only data), tools will be "what Sage can do" (separate parameter)
- **No token counting** — works today but will matter when injecting tool results and longer histories

---

## 4. Frontend Architecture

### Chat UI — Modular and Extensible

```
chat-view.tsx (orchestrator, 460 lines)
  |-- message-bubble.tsx (renderer, routes to card by block type)
  |-- domain-card.tsx (domain display with edit button)
  |-- synthesis-card.tsx (session-end summary)
  |-- quick-reply-buttons.tsx (domain suggestions)
  |-- chat-input.tsx (text + voice input)
  |-- typing-indicator.tsx (3-dot animation)
  |-- building-card-placeholder.tsx (pending block loader)
  |-- error-message.tsx (error + retry UI)
```

**Could the chat UI support inline approval cards?** Yes, with minor modifications. The `MessageBubble` -> `parseMessage()` -> render-by-block-type pattern is designed for this:

```tsx
// In message-bubble.tsx — add a case
if (parsed.block?.type === 'approval_request') {
  return <ApprovalCard data={parsed.block.data} onApprove={...} onReject={...} />
}
```

The challenge is two-way communication — approval needs a separate API call + result flowing back as a new message. This fits naturally alongside how domain corrections already work.

### State Management — Simple, Sufficient

All local `useState` in `ChatView`. No global state library. Data flows via props.

For Phase 2 (background orchestrator pushing notifications), options are:
- Supabase Realtime subscriptions (already available via `@supabase/supabase-js`)
- Service worker `postMessage` -> React state update

Both are additive. No state management rewrite needed.

### Service Worker & PWA — Functional

- Cache strategy: network-first for API/Supabase, cache-first for static assets
- Push notification handling works: receives JSON, shows browser notification, click navigates to chat
- Manifest configured for standalone PWA with warm amber theming
- For Phase 2: extend notification click handler for different action types

### Voice Recording — Functional with Minor Gaps

- MediaRecorder with MIME type detection (webm -> mp4 -> unspecified fallback)
- Permission handling with user-friendly error messages
- Auto-send after transcription (no review step — intentional for voice-first UX)
- **Gap:** Doesn't release microphone tracks on component unmount (`stream.getTracks().forEach(t => t.stop())` missing)

### Life Map View — Complete for MVP

- Server component fetches data, passes to client components
- All 8 domains always rendered (explored show data, unexplored show placeholder)
- Collapsible domain detail cards with status indicators
- Synthesis section shows narrative + priorities
- Static view only — edits happen via chat

---

## 5. Code Quality & Robustness

### Critical Issues

**1. No AbortController on streaming fetch** (`chat-view.tsx:184`)

If the user navigates away mid-stream, the fetch continues in the background. With tool use adding multiple round-trips per conversation turn, this becomes a serious resource leak.

**2. Client-side persistence is fire-and-forget** (`chat-view.tsx:251-256`)

Assistant messages saved to DB after streaming, but failures are silently caught. Message appears in UI but lost on refresh. For agentic actions, persistence must be server-side and reliable.

**3. No stream cleanup on error** (`chat-view.tsx:204-231`)

The `reader` is never cancelled on error. The `finally` block only sets `isStreaming(false)` but doesn't call `reader.cancel()`.

**4. Sessions never time out**

If a user closes mid-conversation, the session stays `active` forever. No cron or cleanup exists. This pollutes "active session" queries on return.

**5. `hasBlock` detection via string includes** (`chat-view.tsx:234-236`)

```typescript
const hasBlock = accumulated.includes('[DOMAIN_SUMMARY]') ||
  accumulated.includes('[LIFE_MAP_SYNTHESIS]') ||
  accumulated.includes('[SESSION_SUMMARY]')
```

If Claude mentions these tags in plain text, it's a false positive. Should use the parser's actual block result instead.

### Medium Issues

**6. Context queries are sequential** (`context.ts:18-63`). Five DB queries for weekly check-in run one after another. Should use `Promise.all()`.

**7. Voice recorder doesn't release microphone on unmount.** Stops MediaRecorder but doesn't stop the underlying audio tracks. Mic stays active until tab closes.

**8. No retry/timeout on Claude API call** (`route.ts:57`). If Claude's API hangs, the stream stays open with no timeout.

**9. `.single()` error handling inconsistent.** Some files check for `PGRST116` (no rows), others don't. If multiple "current" life maps exist, `.single()` throws unhandled.

**10. No error boundaries.** If any component throws, the entire app crashes. Missing `<ErrorBoundary>` at layout level.

**11. Session type mismatch.** `types/chat.ts` defines `SessionType = 'life_mapping' | 'weekly_checkin'` but `types/database.ts` includes `'monthly_review' | 'quarterly_review'` too. `buildConversationContext()` only handles 2 types.

### Testing

- **1 test file exists:** `lib/ai/parser.test.ts` (189 lines) — good coverage of parser
- **No component tests, no API route tests, no integration tests**
- `vitest` installed but configured for `node` environment only (no `jsdom` for React)
- No E2E framework (Playwright, Cypress)

### Dependencies

Lean and appropriate:
- `@anthropic-ai/sdk ^0.39.0` — Claude integration
- `@supabase/ssr ^0.5.2` + `@supabase/supabase-js ^2.49.1` — correct packages (not deprecated helpers)
- `next ^15.1.0`, `react ^19.0.0` — current
- `vitest ^4.0.18` — test framework (underutilized)

No unnecessary dependencies. No known security issues.

---

## 6. Critical Path Items — Fix Before Adding Tool Use

Ranked by priority:

### 1. Restructure `/api/chat` for tool use loop

**Why first:** Everything depends on this. Tool use is a fundamentally different interaction pattern than single-shot streaming.

**What to do:** Refactor the streaming handler to detect `stop_reason: 'tool_use'`, execute tools server-side, inject `tool_result`, and continue the stream. Move message persistence server-side.

**Files:** `app/api/chat/route.ts` (rewrite inner loop), new `lib/ai/tools.ts` (tool registry + execution)

### 2. Add AbortController + stream cleanup

**Why second:** Without this, the tool use loop will leak connections on every interrupted conversation.

**What to do:** Create AbortController in `ChatView`, pass signal to fetch, cancel on unmount and error. Add `reader.cancel()` in error/cleanup paths.

**Files:** `components/chat/chat-view.tsx` (sendMessage function)

### 3. Move message persistence server-side

**Why third:** Tool use generates messages the client doesn't see (tool_use + tool_result). These must be saved server-side. This also fixes the fire-and-forget reliability issue.

**What to do:** Have `/api/chat` save both user and assistant messages to DB. Return message IDs in the SSE stream. Client uses IDs for optimistic updates.

**Files:** `app/api/chat/route.ts` (add DB writes), `components/chat/chat-view.tsx` (remove DB writes)

### 4. Add `messages.role = 'tool'` to schema + create `agent_actions` table

**Why fourth:** Can't store tool use messages without updating the CHECK constraint. Can't audit tool executions without the table.

**Files:** New migration file

### 5. Add indexes to all FK columns

**Why fifth:** Tool use means more DB queries per conversation turn. Without indexes, this multiplies the already-missing-index problem.

**Files:** New migration file

---

## 7. Recommended Refactors

| # | Refactor | File(s) | Effort | When |
|---|----------|---------|--------|------|
| 1 | Restructure chat route for tool use loop | `app/api/chat/route.ts` | Large | Before Phase 1 |
| 2 | Add AbortController to streaming | `components/chat/chat-view.tsx` | Small | Before Phase 1 |
| 3 | Move message persistence server-side | `route.ts` + `chat-view.tsx` | Medium | Before Phase 1 |
| 4 | Create `intentions`, `agent_actions`, `user_preferences` tables | New migration | Medium | Before Phase 1 |
| 5 | Add DB indexes | New migration | Small | Immediately |
| 6 | Add unique constraint on `push_subscriptions(user_id, endpoint)` | New migration | Tiny | Immediately |
| 7 | Parallelize context queries with `Promise.all()` | `lib/ai/context.ts` | Small | Before Phase 1 |
| 8 | Update `messages.role` CHECK to include `'tool'` | Migration | Tiny | Before Phase 1 |
| 9 | Add session timeout/abandonment cron | New API route or Supabase function | Small | Phase 1 |
| 10 | Fix voice recorder mic release on unmount | `lib/voice/recorder.ts` | Tiny | Anytime |
| 11 | Add `StructuredBlock` types for `tool_request` and `approval_request` | `types/chat.ts` + `parser.ts` | Small | Phase 1 |
| 12 | Replace `hasBlock` string matching with parser result | `chat-view.tsx:234-236` | Tiny | Anytime |

---

## 8. OpenClaw Integration Assessment

### Compatibility: Medium Effort

**Could MeOS expose a skill interface?** Yes. An OpenClaw skill is a folder with `SKILL.md` + tool definitions. MeOS would expose:

```
meos-skill/
  SKILL.md                    -- "Access user's life map, intentions, and patterns"
  tools/
    get_life_map.ts           -- Returns current life map + domains
    get_active_intentions.ts  -- Returns active intentions
    check_alignment.ts        -- Given a proposed action, check if it aligns with life map
    create_intention.ts       -- Create a new intention
```

This maps cleanly to the relational schema. The Life Map's structured data (domains with status, intentions with action types, patterns with occurrence counts) is far richer than OpenClaw's flat markdown memory.

### MCP Server (Phase 3)

To expose the Life Map via Model Context Protocol:

1. Create an MCP server that exposes tools: `get_life_map()`, `get_active_intentions()`, `check_intention_alignment(action)`
2. Each tool is a Supabase query behind an auth layer
3. The MCP server needs its own auth (API key per user, not Supabase session cookies)

**What needs to change:**
- Extract Supabase queries from `lib/supabase/life-map.ts` and `sessions.ts` into a service layer that doesn't depend on the HTTP request context
- Add an API key auth mechanism for external MCP clients
- Create the MCP server (separate package or Next.js API routes with MCP protocol)

**Estimated effort:** 2-3 weeks for a basic MCP server with 3-4 tools.

### Architecture Comparison with OpenClaw

| Layer | OpenClaw | MeOS | Overlap |
|-------|----------|------|---------|
| Session Management | Gateway (WebSocket) | Next.js SSE + Supabase sessions | Different approach, same function |
| Platform Adapters | Channel (WhatsApp/Telegram/etc.) | Single PWA | MeOS is single-channel |
| LLM Integration | Pluggable providers | Claude only | MeOS is simpler — Claude-native |
| Memory | Flat markdown (SOUL.md + logs) | Relational (Postgres) | **MeOS is fundamentally richer** |
| Proactive Behavior | Heartbeat (cron) | Push notifications (manual trigger) | MeOS needs Phase 2 orchestrator to match |
| Skills | Folder + SKILL.md + tools | Structured blocks in prompts | MeOS can adopt OpenClaw's format |
| Tool Use | Native function calling | Not yet implemented | Phase 1 will close this gap |

**Key insight:** MeOS's architecture is closer to a **vertical application** than OpenClaw's **horizontal platform**. OpenClaw is a framework; MeOS is a product. The integration path is MeOS-as-a-skill-inside-OpenClaw, not MeOS-adopting-OpenClaw's-architecture. The relational Life Map data model is the moat — preserve it, expose it via MCP, and let OpenClaw agents consume it as context.

---

## Summary

The codebase is solid MVP work. The architecture supports incremental evolution into an agentic system. The three critical refactors (tool use loop in the chat endpoint, server-side persistence, AbortController) are scoped and non-destructive. The parser, component structure, and prompt architecture are well-designed for extension. The database needs indexes immediately and new tables for Phase 1, but the relational model is the right foundation for an AI "brain layer." No rewrite needed.
