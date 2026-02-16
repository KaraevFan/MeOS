# Design: Steering Doc System

**Date:** 2026-02-16
**Status:** Approved

## Problem

Ideas and direction changes are scattered across feedback files, brainstorms, plan docs, and inline PRD updates. No single place tracks what's next, what's queued, or what strategic decisions were made. Claude Code sessions start without knowing current priorities.

## Solution

A single `Docs/STEERING.md` file that serves as the lightweight roadmap overlay. Origin docs (MVP_PRD, vision, UX_design) remain the source of truth for deep reference. STEERING.md tracks sequencing and decisions only.

## Structure

Five sections:

1. **Current Focus** — what we're working on NOW (max 3 items)
2. **Up Next** — queued work, roughly ordered (next 1-2 weeks)
3. **Backlog** — ideas organized by epic, checklist format
4. **Shipped** — completed work, reverse chronological
5. **Decisions Log** — key strategic pivots with date and rationale

## Backlog Epics

1. Onboarding & First Session
2. Retention & Re-engagement
3. Conversational UX (prompts, Sage behavior, session arcs, emotional pacing)
4. POS Modules (daily journal, quick capture, day planner)
5. System Intelligence (cross-session patterns, trust ladder, sentiment)
6. Tool Use & Agents (calendar, email, web research, task decomposition)
7. Design & Polish (visual refinements, accessibility, animation)
8. Infrastructure (security, data architecture, performance)

## CLAUDE.md Integration

Add a 3-line section pointing to STEERING.md. Claude Code reads it at session start, updates it when shipping or capturing ideas.

## Update Protocol

- **Session start** — read for context
- **After shipping** — move to Shipped, promote from Up Next
- **New idea** — add to appropriate Backlog epic
- **Strategic decision** — add to Decisions Log with date
- **Periodic grooming** — reorder when priorities shift

## Audience

Both the founder (strategic clarity) and Claude Code (session context). Written in plain language that serves both.
