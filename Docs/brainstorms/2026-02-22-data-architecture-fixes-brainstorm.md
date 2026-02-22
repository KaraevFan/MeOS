---
date: 2026-02-22
topic: data-architecture-fixes
---

# Data Architecture Fixes — Design Decisions

## What We're Building

Six fixes to the MeOS data architecture that close gaps between the three artifact layers (Life Map / Life Plan / Daily Plan). The core issues: Layer 2 (weekly planning) doesn't exist as a distinct artifact, daily priority data doesn't carry forward, and some session types can silently mutate the Life Map without user confirmation.

Full implementation spec: `Docs/feedback/20260222_Data_architecture.md`
Audit that produced the spec: `Docs/generated/20260222_data_architecture_audit.md`

## Key Decisions

### 1. Weekly plan block format: Use `[FILE_UPDATE type="weekly-plan"]`
**Rationale:** Consistent with the existing FILE_UPDATE pipeline. The parser, file-write-handler, and permission system all key off the `[FILE_UPDATE type="..." name="..."]` format. Adding `weekly-plan` as a new type keeps the architecture clean — no new parser branches or handler paths needed.

### 2. Weekly plan frontmatter: Middle ground — simple priorities list + metadata
**Rationale:** Frontmatter gets `type`, `week_of`, `created_from_session`, and a simple priorities list (text + domain) for the home screen card. Full detail (projects, threads, recurring items) stays in the markdown body. This matches the existing pattern where Sage writes content and the system owns metadata, while still enabling the home screen "Weekly Plan Set" card to query priorities without parsing markdown.

### 3. Open Day context injection: Weekly primary, quarterly summary
**Rationale:** When `life-plan/weekly.md` exists, `open_day` injects the full weekly plan plus just the commitment headings from `life-plan/current.md` (not the full narrative). Sage stays aware of all quarterly commitments without burning the full token cost. Falls back to full `current.md` if no weekly plan exists.

### 4. Reflection day: Hardcoded to Sunday for MVP
**Rationale:** YAGNI. No new DB column or user preference needed. Sunday is the sensible default. Add configuration later if someone requests it.

## Open Questions

None remaining — all design questions resolved.

## Tickets (Priority Order)

1. **Ticket 1 (P0):** Daily Priority Carry-Forward — add `day_plans` read to `open_day` context
2. **Ticket 6 (P1):** Fix Google Calendar OAuth — env var / URL construction issue
3. **Ticket 2 (P0):** Weekly Planning Artifact — create `life-plan/weekly.md` with FILE_UPDATE type
4. **Ticket 3 (P1):** Weekly Reflection Home Screen Trigger — Sunday hero card
5. **Ticket 4 (P1):** Feed Daily Plan Data into Weekly Check-in — operational data injection
6. **Ticket 5 (P1):** Life Map Write Guards — prompt-level confirmation gates

## Next Steps

-> `/workflows:plan` for implementation details per ticket
