---
review_agents:
  - kieran-typescript-reviewer
  - security-sentinel
  - performance-oracle
  - architecture-strategist
  - code-simplicity-reviewer
---

## Review Context

MeOS is a Next.js 14 App Router app (TypeScript strict mode). Key review considerations:
- Server vs client component boundaries (`'use client'` only when needed)
- No `any` types — use `unknown` + type guards
- Supabase RLS on all tables — never trust client-side auth
- Tailwind utility classes only, `cn()` helper for conditional classes
- Voice/audio flows use MediaRecorder API
- Markdown-native data architecture (files in Supabase Storage)
- Mobile-first PWA, 44px minimum touch targets
