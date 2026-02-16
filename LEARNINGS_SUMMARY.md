# Institutional Learnings: Domain Cards, Chat, Pulse Checks, & History Views

## Search Context

**Feature Areas:**
1. Domain card components and Life Map rendering patterns
2. Chat view modifications and header components
3. Pulse check data queries and trend calculations
4. History view and session context injection

**Documents Scanned:** 4 solution files + CLAUDE.md + design system

**Critical Findings:** 3 high-severity learnings to prevent bugs in these areas

---

## Critical Patterns to Apply Immediately

### 1. Markdown Section Extraction: Heading-Level Boundaries (HIGH SEVERITY)

**File:** `/Users/tomoyukikano/Desktop/Projects/Kairn/docs/solutions/logic-errors/markdown-section-extraction-heading-boundary.md`

**The Gotcha:**
When extracting hierarchical markdown content (like commitments, domain details with sub-sections), the shared helper `extractMarkdownSection()` uses `#{1,3}` regex to find boundaries. This stops at h3 headings, which breaks extraction when your content uses h3 for semantic sub-headings within an h2 section.

**Impact on Your Work:**
- **Domain cards in chat**: If rendering domain details fetched from `life-map/*.md`, use custom extraction with `#{1,2}` boundary regex
- **Life Map rendering**: Any hierarchical content (commitments, nested sections) needs level-aware extraction
- **History view context injection**: When pulling sections from past check-ins, verify the heading structure

**Solution:**
```typescript
// WRONG: Use this only for flat sections (paragraphs, bullet lists)
const section = extractMarkdownSection(content, 'Current State')

// RIGHT: Use this for hierarchical content (h3+ sub-headings inside)
const sectionMatch = content.match(/^##\s+Current State\s*$/m)
if (!sectionMatch || sectionMatch.index === undefined) return []
const afterHeading = content.slice(sectionMatch.index + sectionMatch[0].length)
const nextH1OrH2 = afterHeading.search(/^#{1,2}\s/m)
const section = (nextH1OrH2 === -1 ? afterHeading : afterHeading.slice(0, nextH1OrH2)).trim()
```

**Prevention Checklist for Any New Markdown Parser:**
- [ ] Document heading-level assumptions in JSDoc
- [ ] Test with hierarchical content (h3+ sub-headings)
- [ ] Test the empty case (section missing, section empty)
- [ ] Test LLM output variance (missing fields, alternative formatting)
- [ ] Section at end of file (no following heading)
- [ ] Never assume `extractMarkdownSection` handles sub-headings

---

### 2. Security & Performance in Markdown Data Layer (CRITICAL)

**File:** `/Users/tomoyukikano/Desktop/Projects/Kairn/docs/solutions/security-issues/markdown-storage-security-review-fixes.md`

**The Gotchas:**

#### Permission Checks Must Deny by Default
```typescript
// WRONG: Unknown session types get full access
if (!allowedPrefixes) {
  return true  // DANGEROUS - defaults to allow
}

// RIGHT: Unknown session types denied
if (!allowedPrefixes) {
  console.warn(`[FileWriteHandler] Unknown session type "${sessionType}" -- write denied`)
  return false  // Deny by default
}
```

**Applies to:** If you're modifying `lib/markdown/file-write-handler.ts` to support new session types or if history view adds new write operations.

#### AI-Sourced Values Must Be Validated
Any value extracted from Sage output (file types, domain names, paths) must be validated against a known allowlist:

```typescript
// WRONG: Accept any file type from Sage
const fileType = match[1]  // Could be anything

// RIGHT: Validate against constants
import { FILE_TYPES } from '@/lib/markdown/constants'
const VALID_FILE_TYPES: Set<string> = new Set(Object.values(FILE_TYPES))

if (!VALID_FILE_TYPES.has(fileType)) {
  console.warn(`[Parser] Rejected unknown FILE_UPDATE type: "${fileType}"`)
  return null
}
```

**Applies to:** If chat modifies the Sage prompt output parsing or if new domain card types accept user input.

#### Batch All Independent Async Reads
Never use sequential `for` loops with `await` for independent operations:

```typescript
// WRONG: N+1 pattern, sequential reads
for (const filename of checkInFilenames) {
  const checkIn = await ufs.readCheckIn(filename)
}

// RIGHT: Parallel reads with graceful failure
const checkInResults = await Promise.allSettled(
  checkInFilenames.map((filename) => ufs.readCheckIn(filename))
)
```

**Applies to:** When history view fetches past sessions or when pulse check queries multiple check-in files.

#### Query Metadata Before Full File Reads
When filtering (e.g., "find domains with needs_attention status"):

```typescript
// WRONG: Read all 8 domain files to find 2 flagged ones
const domainFiles = await ufs.listFiles('life-map/')
for (const filePath of domainFiles) {
  const domain = await ufs.readDomain(filename)
  if (domain.frontmatter.status === 'needs_attention') { ... }
}

// RIGHT: Single DB query on file_index, then read only flagged files
const { data: flaggedDomains } = await supabase
  .from('file_index')
  .select('domain_name')
  .eq('user_id', userId)
  .eq('file_type', 'domain')
  .in('status', ['needs_attention', 'in_crisis'])

const flaggedResults = await Promise.allSettled(
  flaggedDomains.map((row) => ufs.readDomain(row.domain_name))
)
```

**Applies to:** Pulse check trend queries, history filtering, or any view that displays status summaries.

---

### 3. RLS & Idempotency in Supabase Operations (CRITICAL)

**File:** `/Users/tomoyukikano/Desktop/Projects/Kairn/docs/solutions/security-issues/rls-auth-data-leak-fix.md`

**The Gotchas:**

#### RLS Policy Naming Doesn't Guarantee Scope
Supabase service role **bypasses RLS entirely** at the connection level. If you write an RLS policy named "Service role access" with `USING (true)`, it actually applies to `authenticated` role instead.

**If you add new tables for pulse checks or history data:**
- [ ] All tables must have RLS enabled
- [ ] Policies must exist for SELECT, INSERT, UPDATE, DELETE
- [ ] `WITH CHECK` constraints on INSERT/UPDATE must match `USING` constraints
- [ ] Test that authenticated users cannot see other users' data

#### API Endpoints Need Idempotency Guards
If history view or pulse check API routes can be called multiple times, add idempotency:

```typescript
// WRONG: Duplicate content on React strict mode or retries
async function generateReengagement(sessionId) {
  const prompts = await createReflectionPrompts(sessionId)  // Called twice = duplicates
}

// RIGHT: Idempotency key prevents duplicates
async function generateReengagement(sessionId, idempotencyKey) {
  const existing = await db.query('idempotency_log', idempotencyKey)
  if (existing) return existing.result

  const result = await createReflectionPrompts(sessionId)
  await db.insert('idempotency_log', { key: idempotencyKey, result })
  return result
}
```

**Applies to:** If you build history view with API fetches or pulse check calculation endpoints.

---

## Architecture Reference: Markdown-Native Data for Context Injection

**From CLAUDE.md:**

Context injection for chat sessions reads from **markdown files**, not DB tables:
1. `sage/context.md` — Sage's working model of the user
2. `life-map/_overview.md` — Life map overview (north star, boundaries, tensions)
3. `life-plan/current.md` — Current life plan (commitments, boundaries)
4. Last 3 `check-ins/*.md` — Recent check-in summaries
5. Domain files for domains with `needs_attention`/`in_crisis` status
6. Pulse check baseline (still from relational DB)

**For history view and pulse check work:**
- Use `UserFileSystem.readCheckIn()` to fetch past sessions
- Query `file_index` metadata before reading full files
- Parallel reads with `Promise.allSettled()`
- Respect heading-level extraction boundaries

---

## Design System Constraints (From SKILL.md)

**Apply to domain cards, chat headers, history list:**

### Color Palette
```
Primary:        #D97706 (bright amber — voice button, domain status indicators)
Background:     #FDFCF8 (warm cream — NOT white)
Sage message:   #F5F0E8 (lighter cream background)
Text:           #3D3832 (dark warm gray — NOT black)
Secondary text: #8A7E74
Borders:        rgba(61, 56, 50, 0.08) (warm tint)

Domain Status Colors:
  thriving:     #7D8E7B (sage green)
  stable:       #D4A574 (warm amber)
  needs_attention: #C17B5D (terracotta)
  in_crisis:    #B05A5A (muted red)
```

### Typography
- Font: Satoshi (primary) or DM Sans (fallback) — NOT Inter, Roboto, system-ui
- Headings: Satoshi Bold (700), tracking tight (-0.02em)
- Body: Satoshi Regular (400), line-height 1.6, 16px base
- Size scale: 13 / 15 / 16 / 20 / 24 / 32px

### Domain Cards (Inline in Chat)
- Full-width, `#FFFFFF` with `shadow-md` (warm tinted), rounded-lg
- Status dot (8px circle) top-right with domain status color
- Structured fields: `--color-text-secondary` labels, `--color-text` values
- Subtle edit icon (pencil) top-right, appears on hover/tap
- Visually distinct from chat bubbles

### Anti-Patterns to Avoid
- Purple or blue gradients (warm palette only)
- Pure white backgrounds on pages (use cream)
- Pure black text (use warm gray)
- Cold gray borders or shadows
- Metric dashboards, progress bars, gamification
- Guilt-inducing streaks, scores, red warning badges
- Dense information layouts — let content breathe
- Clinical layouts — this is a conversation, not a spreadsheet

---

## Vocabulary Mapping: Type Fields → UI Labels

**From CLAUDE.md:**

The `LifeMap` TypeScript type uses legacy field names. The UI displays coaching vocabulary instead. Mapping happens at the **presentation layer** — do NOT rename the type fields:

| Type field | UI label | Where mapped |
|---|---|---|
| `primary_compounding_engine` | "Your north star" | `life-map/page.tsx`, `home/page.tsx` |
| `anti_goals` | "Boundaries" | `life-map/page.tsx`, `home/page.tsx` |
| `key_tensions` | "Tensions to watch" | `life-map/page.tsx` |

**For domain cards and history view:** Apply same mapping pattern when rendering structured data. Keep type fields unchanged, map at presentation.

---

## Commitment Heading Stability (CRITICAL FOR CONTINUITY)

**From CLAUDE.md:**

Commitment `###` headings in `life-plan/current.md` serve as **identity keys across sessions**:

```markdown
## Active Commitments

### Launch side project          <-- This heading is the unique ID
**Why it matters:** Build credibility in AI space
**Status:** in_progress

### Reconnect with close friends
**Why it matters:** Relationships need tending
**Status:** stable
```

**Rule:** Never rename commitment headings. Changing a heading breaks continuity tracking between check-ins. The `extractCommitments()` parser and React key props both rely on heading text stability.

**If modifying commitment parsing or history display:**
- Never auto-capitalize or normalize commitment headings
- Use exact heading text as React key
- Preserve heading text in any edit flows

---

## Code Style & Conventions (From CLAUDE.md)

**When building domain cards, chat modifications, history view:**

- **TypeScript strict mode** — No `any` types, use `unknown` + type guards
- **Named exports** — Not default exports (except Next.js pages/layouts)
- **Server components by default** — Use `'use client'` only for interactivity/hooks/browser APIs
- **Tailwind utilities only** — No custom CSS files
- **Use `cn()` helper** — For conditional class names (clsx + tailwind-merge)
- **Async data fetching in server components** — Not in useEffect
- **Supabase RLS on all tables** — Never trust client-side auth alone

---

## Files to Reference Before Starting

1. **Origin Docs (Source of Truth):**
   - `Docs/vision.md` — Product vision
   - `Docs/MVP_PRD.md` — Complete spec (Sage persona, data model, prompts, flows)
   - `Docs/UX_design.md` — Design philosophy, screen specs, interaction patterns

2. **Key Codebase Files:**
   - `lib/markdown/extract.ts` — Markdown section extraction helpers
   - `lib/markdown/user-file-system.ts` — Core `UserFileSystem` service
   - `lib/markdown/file-write-handler.ts` — File update parsing and permissions
   - `lib/markdown/constants.ts` — Domain file map, path validation
   - `lib/ai/context.ts` — Context injection for sessions
   - `lib/ai/parser.ts` — Sage output parsing with `[FILE_UPDATE]` blocks
   - `.claude/skills/meos-design/SKILL.md` — Design system (READ BEFORE UI WORK)

---

## Summary: Gotchas to Avoid

1. **Heading-level extraction** — Use custom `#{1,2}` boundary for hierarchical content
2. **Permission checks** — Deny unknown cases by default, never allow
3. **AI-sourced values** — Validate against allowlist before use
4. **Async patterns** — Batch independent reads with `Promise.allSettled()`
5. **Metadata queries** — Query `file_index` before reading full files
6. **RLS policies** — Ensure all tables have complete policies for all operations
7. **Idempotency** — Add guards in API routes to prevent duplicates on retries
8. **Commitment headings** — Never rename; they're identity keys across sessions
9. **Design system** — Warm palette only, domain status colors, Satoshi font
10. **Session-scoped writes** — Check `lib/markdown/constants.ts` for path whitelists

---

## Related Learning Documents

- `Docs/plans/2026-02-14-feat-markdown-data-architecture-plan.md` — Phase 3 research
- `Docs/brainstorms/2026-02-14-markdown-data-architecture-brainstorm.md` — Brainstorm notes
- `Docs/feedback/20260214_Data_architecture_as_markdown_proposal.md` — Design proposal

---

**Generated:** 2026-02-16
**Researcher:** Claude Code learnings-researcher agent
**Search Pattern:** Markdown extraction, domain cards, Supabase queries, security patterns, design system
