---
status: complete
priority: p2
issue_id: "079"
tags: [code-review, security, error-handling, calendar]
dependencies: []
---

# 079 — Calendar connect error response reveals environment variable names

## Problem Statement

In `app/api/calendar/connect/route.ts`, the 503 error response says: "Calendar integration is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." This reveals internal environment variable names to the client, which is an information disclosure issue. Attackers can use this to understand the server's configuration structure and target specific variables.

## Findings

- **File:** `app/api/calendar/connect/route.ts` — 503 error response body includes literal env var names `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- **Impact:** Information disclosure — exposes internal configuration naming to clients
- **OWASP:** Security Misconfiguration (A05:2021)

## Proposed Solutions

### Option A: Generic client error + server-side logging (Recommended)
Change the client-facing error message to a generic one like "Calendar integration is not available." and keep the detailed message (including env var names) in a `console.error` or `console.warn` for server-side debugging.
- **Pros:** No information leak; operators can still diagnose via server logs
- **Cons:** Slightly less helpful for local development (mitigated by server logs)
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] Error message does not reveal env var names
- [ ] Error still returns 503 status
- [ ] Logging can still include the detailed message server-side

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
