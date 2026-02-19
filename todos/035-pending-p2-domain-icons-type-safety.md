---
status: pending
priority: p2
issue_id: "035"
tags: [code-review, typescript, type-safety, life-map-pill]
dependencies: []
---

# 035 — `DOMAIN_ICONS` typed as `Record<string, string>` — use `DomainName`

## Problem Statement

`DOMAIN_ICONS` in `life-map-pill-shelf.tsx:29-38` is typed as `Record<string, string>` instead of `Record<DomainName, string>`. A typo in a domain name silently falls through to the `?? 'Compass'` default with no compiler error. The `getIconForDomain` function also takes `string` instead of `DomainName`, so callers can pass arbitrary strings without type errors.

## Findings

- **File:** `components/chat/life-map-pill-shelf.tsx:29-38`
- **Evidence:**
  ```tsx
  const DOMAIN_ICONS: Record<string, string> = {
    'Career / Work': 'Briefcase',
    'Relationships': 'Heart',
    // ...
  }

  export function getIconForDomain(domain: string): string {
    return DOMAIN_ICONS[domain] ?? 'Compass'
  }
  ```
  If a domain name is misspelled in the map (e.g., `'Career/ Work'` missing a space), TypeScript will not flag it. The fallback silently covers the mistake. Similarly, callers can pass any string to `getIconForDomain` without a type error.
- Reported by: TypeScript reviewer (MEDIUM)

## Proposed Solutions

### Option A — Use `DomainName` type for keys and parameter (Recommended)

```tsx
import type { DomainName } from '@/types/chat'

const DOMAIN_ICONS: Record<DomainName, string> = {
  'Career / Work': 'Briefcase',
  'Relationships': 'Heart',
  // ... all DomainName values must be present (compiler enforces completeness)
}

export function getIconForDomain(domain: DomainName): string {
  return DOMAIN_ICONS[domain]
}
```

**Pros:** Compiler catches misspelled domain names, enforces that every `DomainName` has an icon, callers must pass a valid `DomainName`
**Cons:** If `DomainName` union is extended, a new entry must be added to `DOMAIN_ICONS` (this is a feature, not a bug — it prevents forgetting an icon)
**Effort:** Small
**Risk:** Low

### Option B — Keep `string` key type but add an exhaustiveness check

Use a `satisfies` assertion:

```tsx
const DOMAIN_ICONS = {
  'Career / Work': 'Briefcase',
  // ...
} satisfies Record<DomainName, string>
```

**Pros:** Same compile-time safety, slightly less invasive
**Cons:** `getIconForDomain` would still need its parameter type updated separately
**Effort:** Small
**Risk:** Low

## Recommended Action

Option A — explicit `Record<DomainName, string>` typing. Provides full type safety for both the map and the function signature.

## Technical Details

- **Affected file:** `components/chat/life-map-pill-shelf.tsx` lines 29-38
- **Type source:** `types/chat.ts` — `DomainName` union type
- **PR:** #20

## Acceptance Criteria

- [ ] `DOMAIN_ICONS` typed as `Record<DomainName, string>` (or uses `satisfies`)
- [ ] `getIconForDomain` parameter typed as `DomainName` instead of `string`
- [ ] All `DomainName` values present in the map (compiler enforces)
- [ ] Callers of `getIconForDomain` pass `DomainName` values (fix any type errors at call sites)
- [ ] TypeScript strict check passes
- [ ] ESLint passes

## Work Log

- 2026-02-19: Created from PR #20 R4.2 code review (TypeScript reviewer MEDIUM)
