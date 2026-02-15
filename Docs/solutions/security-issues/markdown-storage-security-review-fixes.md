---
title: "Markdown Storage Layer: 17 Security, Performance & Quality Fixes from Code Review"
category: security-issues
tags:
  - security
  - performance
  - deny-by-default
  - rls
  - prompt-injection
  - n-plus-one
  - supabase-storage
  - file-validation
  - yaml-sanitization
module: markdown-data-architecture
symptom: "Code review of new markdown-native storage layer identified fail-open permission checks, unvalidated AI-sourced file types, missing RLS write policies, sequential N+1 file reads, and information leakage in error messages"
root_cause: "New storage abstraction layer lacked comprehensive security hardening: inverted access control logic, missing input validation, incomplete RLS, performance anti-patterns, and insufficient sanitization"
date_solved: "2026-02-14"
severity: critical
finding_count: 17
affected_files: 9
pr: "https://github.com/KaraevFan/MeOS/pull/2"
---

# Markdown Storage Layer: Security & Performance Hardening

## Problem Statement

After building a markdown-native data architecture (storing user life data as `.md` files in Supabase Storage instead of relational tables), a code review with 8 parallel agents identified **17 findings** across security, performance, and quality:

- **5 P1 Critical**: Fail-open write permissions, unvalidated file types from AI output, missing RLS write policies, sequential N+1 reads for check-ins, sequential reads of all 8 domains to find 2 flagged ones
- **6 P2 Important**: Unnecessary `listFiles()` calls, redundant read-before-write, blocking index updates, missing prefix validation, unsanitized YAML values
- **6 P3 Nice-to-have**: Full-content existence checks, aggressive retry delays, unlimited path depth, high rate limit, path leakage in errors, missing migration safety check

## Root Cause

The architectural shift to markdown-native storage lacked comprehensive security hardening:

1. **Inverted access control** — `isWritePermitted()` returned `true` for unknown session types (should deny)
2. **Missing input validation** — `parseFileUpdateBlock()` accepted arbitrary file types from AI output
3. **Incomplete RLS** — `file_index` table had SELECT-only policies, causing silent write failures
4. **Performance anti-patterns** — Sequential loops where parallel reads were possible, unnecessary full-file downloads
5. **Information leakage** — Raw file paths exposed in error messages

## Solution

### Security Fixes

**1. Deny-by-default write permissions** (`lib/markdown/file-write-handler.ts`)

```typescript
// BEFORE: Unknown session types get full access
if (!allowedPrefixes) {
  return true  // DANGEROUS
}

// AFTER: Unknown session types denied
if (!allowedPrefixes) {
  console.warn(`[FileWriteHandler] Unknown session type "${sessionType}" -- write denied`)
  return false
}
```

**2. Validate file types against allowlist** (`lib/ai/parser.ts`)

```typescript
import { FILE_TYPES } from '@/lib/markdown/constants'
const VALID_FILE_TYPES: Set<string> = new Set(Object.values(FILE_TYPES))

function parseFileUpdateBlock(openTag: string, body: string): FileUpdateData | null {
  const fileType = match[1]

  // Reject unknown file types (prevents prompt injection)
  if (!VALID_FILE_TYPES.has(fileType)) {
    console.warn(`[Parser] Rejected unknown FILE_UPDATE type: "${fileType}"`)
    return null
  }
  // ...
}
```

**3. Add write RLS policies** (`supabase/migrations/004_file_index.sql`)

```sql
-- Added INSERT/UPDATE/DELETE policies (was SELECT-only)
CREATE POLICY "users_insert_own_index" ON file_index
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_index" ON file_index
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_delete_own_index" ON file_index
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
```

**4. Limit path depth in regex** (`lib/markdown/constants.ts`)

```typescript
// BEFORE: Unlimited nesting
export const SAFE_PATH_REGEX = /^[a-z0-9\-_/]+\.md$/

// AFTER: Max 3 directory levels
export const SAFE_PATH_REGEX = /^[a-z0-9\-_]+(?:\/[a-z0-9\-_]+){0,2}\.md$/
```

**5. Remove paths from error messages** (`lib/markdown/user-file-system.ts`)

```typescript
// BEFORE: Leaks file path
throw new Error(`[UserFileSystem] Path traversal rejected: ${path}`)

// AFTER: Generic message (path logged server-side only)
throw new Error('[UserFileSystem] Path traversal rejected')
```

**6. YAML sanitization for AI-sourced values** (`lib/markdown/frontmatter.ts`)

```typescript
function sanitizeYamlValue(value: string | undefined | null): string | undefined {
  if (value == null) return undefined
  return value.replace(/[\x00]/g, '').trim()
}
```

**7. Validate `listFiles()` prefix** (`lib/markdown/user-file-system.ts`)

```typescript
async listFiles(prefix: string): Promise<string[]> {
  if (prefix.includes('..')) {
    throw new Error(`[UserFileSystem] Path traversal rejected: ${prefix}`)
  }
  const isAllowed = ALLOWED_PATH_PREFIXES.some((allowed) => prefix.startsWith(allowed))
  if (!isAllowed) {
    throw new Error(`[UserFileSystem] Prefix outside allowed paths: ${prefix}`)
  }
  // ...
}
```

### Performance Fixes

**1. Parallelize check-in reads** (`lib/ai/context.ts`)

```typescript
// BEFORE: Sequential loop
for (const filename of checkInFilenames.value) {
  const checkIn = await ufs.readCheckIn(filename).catch(() => null)
}

// AFTER: Parallel reads
const checkInResults = await Promise.allSettled(
  checkInFilenames.value.map((filename) => ufs.readCheckIn(filename))
)
```

**2. Query file_index for flagged domains** (`lib/ai/context.ts`)

```typescript
// BEFORE: Read all 8 domain files, check status of each
const domainFiles = await ufs.listFiles('life-map/')
for (const filePath of domainFiles) {
  const domain = await ufs.readDomain(filename)
  if (domain.frontmatter.status === 'needs_attention') { ... }
}

// AFTER: Single DB query, read only flagged files
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

**3. Fire-and-forget index updates** (`lib/markdown/user-file-system.ts`)

```typescript
// BEFORE: Blocking
await this.updateFileIndex(path, FILE_TYPES.DOMAIN, frontmatter, domainFilename)

// AFTER: Non-blocking (best-effort)
this.updateFileIndex(path, FILE_TYPES.DOMAIN, frontmatter, domainFilename)
```

**4. Skip read-before-write** (`lib/markdown/user-file-system.ts`)

```typescript
// Added optional parameter to avoid redundant reads
async writeDomain(
  domainFilename: string,
  content: string,
  overrides?: Partial<DomainFileFrontmatter>,
  existingFrontmatter?: Partial<DomainFileFrontmatter> | null  // NEW
): Promise<void> {
  const existing = existingFrontmatter !== undefined
    ? existingFrontmatter
    : (await this.readDomain(domainFilename))?.frontmatter ?? null
  // ...
}
```

**5. Metadata-only file existence check**

```typescript
// BEFORE: Downloads full file content
async fileExists(path: string): Promise<boolean> {
  const result = await this.readFile(path)
  return result !== null
}

// AFTER: Metadata listing only
async fileExists(path: string): Promise<boolean> {
  const { data } = await this.supabase.storage
    .from(STORAGE_BUCKET)
    .list(fullPrefix, { search: filename, limit: 1 })
  return (data?.length ?? 0) > 0
}
```

**6. Use known domain constants** (`app/(main)/life-map/page.tsx`)

```typescript
// BEFORE: listFiles() call + filter
const domainFiles = await ufs.listFiles('life-map/')
domainFiles.filter((f) => !f.includes('_overview'))

// AFTER: Iterate known constants
const knownDomainFilenames = Object.values(DOMAIN_FILE_MAP)
```

### Quality Fixes

- Reduced `MAX_FILE_UPDATE_BLOCKS_PER_MESSAGE` from 15 to 10
- Reduced retry delays from 1s+3s to 200ms+800ms
- Added user existence verification in migration script `--user` flag

## Prevention Strategies

### 1. Permission checks must deny by default

**Rule**: Every permission function must explicitly enumerate allowed cases. Unknown inputs must be denied, never permitted.

**Review checklist**:
- [ ] No `return true` in default/fallback branches of permission functions
- [ ] Unknown session types, roles, or identifiers are rejected
- [ ] Allowlist approach (not blocklist)

### 2. Validate all AI-sourced identifiers

**Rule**: Any value extracted from AI output (file types, domain names, paths) must be validated against a known allowlist before use.

**Review checklist**:
- [ ] AI output parsed values checked against `Set` or enum of valid values
- [ ] Invalid values rejected with logging, not silently passed through

### 3. Every table needs complete RLS

**Rule**: Every Supabase table must have RLS enabled with policies for all operations the app performs (SELECT, INSERT, UPDATE, DELETE).

**Review checklist**:
- [ ] All tables have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- [ ] Policies exist for every operation type the app uses
- [ ] `WITH CHECK` constraints on INSERT/UPDATE match `USING` constraints

### 4. Batch all independent async reads

**Rule**: Never use sequential `for` loops with `await` for independent reads. Use `Promise.allSettled()` for parallel execution with graceful failure.

**Review checklist**:
- [ ] No `for` loops containing `await` for independent operations
- [ ] `Promise.allSettled()` used (not `Promise.all()`) when partial failure is acceptable
- [ ] Query file_index metadata before reading full files when filtering

### 5. Never leak internal paths in errors

**Rule**: Error messages shown to users or logged with user-visible context must not include file paths, database identifiers, or implementation details.

**Review checklist**:
- [ ] Error messages are generic (e.g., "Invalid path format" not "Invalid path: /users/abc/...")
- [ ] Detailed context logged server-side only via `console.error()`

## Files Changed

| File | Changes |
|------|---------|
| `lib/markdown/file-write-handler.ts` | Deny-by-default for unknown session types |
| `lib/ai/parser.ts` | Validate fileType against FILE_TYPES allowlist |
| `lib/ai/context.ts` | Parallel check-in reads, file_index query for flagged domains |
| `lib/markdown/user-file-system.ts` | Skip read-before-write, metadata-only fileExists, prefix validation, path hygiene, reduced retry delays, fire-and-forget index updates |
| `lib/markdown/constants.ts` | Path regex depth limit, reduced rate limit |
| `lib/markdown/frontmatter.ts` | YAML sanitization for AI-sourced values |
| `supabase/migrations/004_file_index.sql` | INSERT/UPDATE/DELETE RLS policies |
| `app/(main)/life-map/page.tsx` | Known domain list instead of listFiles |
| `scripts/migrate-to-markdown.ts` | User existence verification |

## Related Documentation

- **Implementation plan**: `Docs/plans/2026-02-14-feat-markdown-data-architecture-plan.md`
- **Brainstorm**: `Docs/brainstorms/2026-02-14-markdown-data-architecture-brainstorm.md`
- **Design proposal**: `Docs/feedback/20260214_Data_architecture_as_markdown_proposal.md`
- **PR**: https://github.com/KaraevFan/MeOS/pull/2
