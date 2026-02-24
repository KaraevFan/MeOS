---
title: "Conversation Architecture: Type Safety & Code Review Fixes"
date: 2026-02-24
category: code-review-fixes
severity: P1
tags:
  - typescript-safety
  - jsonb-data-consistency
  - type-interface-mismatch
  - session-metadata
  - migration-safety
  - code-review
  - structured-arcs
modules:
  - types/chat.ts
  - app/api/chat/route.ts
  - lib/session-labels.ts
  - lib/supabase/home-data.ts
  - lib/markdown/constants.ts
  - components/chat/chat-view.tsx
  - supabase/migrations/019_open_conversation.sql
discovery_method: multi-agent-code-review
---

# Conversation Architecture: Type Safety & Code Review Fixes

## Problem Statement

During a multi-agent code review of the conversation architecture feature (renaming `ad_hoc` to `open_conversation` + adding a two-layer conversation model with structured arcs), **8 issues** were found across P1 and P2 severity. The most critical was a **TypeScript interface field name not matching the JSONB runtime data** already persisted to Postgres.

### Symptoms

- `CompletedArc` interface declared field `type` but all runtime code wrote/read `mode` to JSONB
- `SessionMetadata` interface existed but was never imported — all code used `Record<string, unknown>` casts
- `activeMode` was cast from JSONB string to `StructuredArcType` without runtime validation
- Migration hardcoded a PostgreSQL constraint name that could differ in production
- Redundant `open_conversation_explore` permissions entry identical to `open_conversation`

## Root Cause Analysis

Three interconnected issues:

1. **Dead code interfaces** — Type definitions existed but weren't used, so the type system provided zero protection against JSONB field name mismatches.
2. **Weak contract between storage and consumer code** — Postgres JSONB had `mode` but the TypeScript interface expected `type`. Since interfaces are erased at runtime and consumers bypassed them with `as` casts, the mismatch was invisible.
3. **No runtime validation on untrusted data** — JSONB values were cast to enums without checking they were valid members.

## Working Solutions

### Pattern 1: Interface Field Names Must Match JSONB Column Names

```typescript
// BEFORE (wrong — doesn't match persisted JSONB data)
export interface CompletedArc {
  type: StructuredArcType
  completed_at: string
}

// AFTER (matches actual JSONB structure)
export interface CompletedArc {
  mode: StructuredArcType
  completed_at: string
}
```

Then replace all `as { mode: string }` inline casts with the actual typed interface.

**Audit pattern:** Before defining a TypeScript interface for JSONB data, check the actual database:
```sql
SELECT DISTINCT jsonb_object_keys(metadata) FROM sessions;
```

### Pattern 2: Replace Record<string, unknown> with Explicit Typed Interface

```typescript
// BEFORE (no type safety)
const metadata = session.metadata as Record<string, unknown>

// AFTER (fully typed)
const metadata = session.metadata as SessionMetadata

export interface SessionMetadata {
  active_mode?: StructuredArcType | null
  completed_arcs?: CompletedArc[]
  /** @deprecated Stored as 'ad_hoc_context' in existing JSONB. Rename requires data migration. */
  ad_hoc_context?: string
  pending_completion?: boolean
  onboarding_intent?: string
  onboarding_name?: string
  onboarding_quick_replies?: unknown[]
}
```

**Key:** Remove `[key: string]: unknown` index signatures — they defeat the purpose of typed fields by allowing any property access without compiler errors.

### Pattern 3: Runtime Validation Before Type Casting Enums from JSONB

```typescript
// BEFORE (unsafe — corrupted metadata passes silently)
const activeMode = existingMetadata.active_mode as StructuredArcType

// AFTER (validated enum cast)
const VALID_ARC_MODES: readonly StructuredArcType[] = [
  'open_day', 'close_day', 'weekly_checkin', 'life_mapping'
]

const activeMode: StructuredArcType | null =
  typeof existingMetadata.active_mode === 'string'
  && VALID_ARC_MODES.includes(existingMetadata.active_mode as StructuredArcType)
    ? existingMetadata.active_mode as StructuredArcType
    : null
```

**Why two casts:** The `.includes()` call provides the actual runtime validation. The first `as` is needed for TypeScript's type narrowing within `.includes()`.

### Pattern 4: Query PostgreSQL Schema Dynamically in Migrations

```sql
-- BEFORE (fragile — hardcodes constraint name)
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_session_type_check;

-- AFTER (resilient — queries by definition)
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE rel.relname = 'sessions'
    AND nsp.nspname = 'public'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%session_type%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE sessions DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;
```

### Pattern 5: Remove Dead Code Paths Immediately

- Deleted redundant `open_conversation_explore` permissions (identical to `open_conversation`)
- Simplified `writeSessionType` ternary to just `sessionType`
- Renamed `adHocContext` variable to `openingContext` (JSONB key unchanged — migration needed)
- Fixed hardcoded `'[Start open_day session]'` to template literal `` `[Start ${sessionType} session]` ``

## Prevention Strategies

### Catch Interface/JSONB Mismatches
- **Zod schemas** mirroring TypeScript interfaces for JSONB columns, validated with `.parse()` on read
- **Grep audit:** `grep -r "as Record<string, unknown>" app/` — each hit is a type safety gap
- **Grep audit:** `grep -r "as { mode:" app/` — inline casts indicate the interface isn't being used

### Catch Unsafe Enum Casts
- Create `VALID_*` constants for every enum read from untrusted sources (JSONB, env vars, API responses)
- Use `.includes()` validation before the final `as` cast
- Consider a shared `isStructuredArcType()` type guard function

### Catch Migration Fragility
- `grep -r "DROP CONSTRAINT [a-z_]*" supabase/migrations/*.sql` — flag hardcoded names
- Use the PL/pgSQL `pg_constraint` lookup pattern consistently

### Catch Redundant Code
- Test that no two `SESSION_WRITE_PERMISSIONS` entries have identical arrays
- Audit permission keys against `SessionType` union to prevent drift

## Related Documentation

- `Docs/solutions/code-review-fixes/20260218-daily-rhythm-m3-review-findings.md` — Same PL/pgSQL constraint pattern for `014_midday_nudge.sql`
- `Docs/solutions/code-review-fixes/20260221-multi-agent-review-p1-p2-p3-fixes.md` — Prior multi-agent review with similar type safety findings
- `Docs/solutions/security-issues/markdown-storage-security-review-fixes.md` — Write permission deny-by-default pattern
- `todos/046-pending-p1-energy-level-type-mismatch.md` — Similar JSONB type mismatch pattern
- `todos/050-pending-p2-json-parse-no-validation-ai-output.md` — Related unsafe JSON.parse cast pattern

## Key Takeaways

1. **Interface fields must match JSONB keys exactly** — No aliasing at the interface level
2. **Never use `Record<string, unknown>` when typed interfaces exist** — It's a type safety escape hatch
3. **Validate enum casts with a whitelist constant** — `VALID_ARC_MODES.includes()` is the pattern
4. **Query schema dynamically in migrations** — Use `pg_constraint` not hardcoded names
5. **Dead code removal compounds** — Remove duplicates and stale naming immediately when spotted
