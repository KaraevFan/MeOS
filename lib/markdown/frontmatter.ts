import type {
  DomainFileFrontmatter,
  OverviewFileFrontmatter,
  LifePlanFileFrontmatter,
  CheckInFileFrontmatter,
  SageContextFrontmatter,
  PatternsFrontmatter,
} from '@/types/markdown-files'

function now(): string {
  return new Date().toISOString()
}

function bumpVersion(existing: number | undefined): number {
  return (existing ?? 0) + 1
}

export function generateDomainFrontmatter(
  existing: Partial<DomainFileFrontmatter> | null,
  updates: Partial<DomainFileFrontmatter>
): DomainFileFrontmatter {
  return {
    domain: updates.domain ?? existing?.domain ?? '',
    status: updates.status ?? existing?.status ?? 'stable',
    score: updates.score ?? existing?.score,
    last_updated: now(),
    updated_by: updates.updated_by ?? 'sage',
    version: bumpVersion(existing?.version),
    schema_version: 1,
  }
}

export function generateOverviewFrontmatter(
  existing: Partial<OverviewFileFrontmatter> | null,
  updates: Partial<OverviewFileFrontmatter>
): OverviewFileFrontmatter {
  return {
    type: 'life-map-overview',
    user_id: updates.user_id ?? existing?.user_id,
    last_updated: now(),
    updated_by: updates.updated_by ?? 'sage',
    version: bumpVersion(existing?.version),
    schema_version: 1,
    domains_mapped: updates.domains_mapped ?? existing?.domains_mapped ?? 0,
  }
}

export function generateLifePlanFrontmatter(
  existing: Partial<LifePlanFileFrontmatter> | null,
  updates: Partial<LifePlanFileFrontmatter>
): LifePlanFileFrontmatter {
  return {
    type: 'life-plan',
    quarter: updates.quarter ?? existing?.quarter ?? getCurrentQuarter(),
    quarter_theme: updates.quarter_theme ?? existing?.quarter_theme,
    north_star_domain: updates.north_star_domain ?? existing?.north_star_domain,
    status: updates.status ?? existing?.status ?? 'active',
    created_at: existing?.created_at ?? now(),
    last_updated: now(),
    updated_by: updates.updated_by ?? 'sage',
    version: bumpVersion(existing?.version),
    schema_version: 1,
  }
}

export function generateCheckInFrontmatter(
  metadata: Partial<CheckInFileFrontmatter>
): CheckInFileFrontmatter {
  return {
    type: metadata.type ?? 'weekly-check-in',
    date: metadata.date ?? new Date().toISOString().split('T')[0],
    duration_minutes: metadata.duration_minutes,
    domains_discussed: metadata.domains_discussed ?? [],
    mood: metadata.mood,
    pulse_scores: metadata.pulse_scores,
    version: 1,
    schema_version: 1,
  }
}

export function generateSageContextFrontmatter(
  existing: Partial<SageContextFrontmatter> | null,
  updates: Partial<SageContextFrontmatter>
): SageContextFrontmatter {
  return {
    user_name: updates.user_name ?? existing?.user_name,
    member_since: updates.member_since ?? existing?.member_since,
    total_sessions: updates.total_sessions ?? existing?.total_sessions ?? 0,
    last_session: updates.last_session ?? existing?.last_session,
    life_map_completion: updates.life_map_completion ?? existing?.life_map_completion,
  }
}

export function generatePatternsFrontmatter(
  existing: Partial<PatternsFrontmatter> | null,
  updates: Partial<PatternsFrontmatter>
): PatternsFrontmatter {
  return {
    last_updated: now(),
    active_count: updates.active_count ?? existing?.active_count ?? 0,
    version: bumpVersion(existing?.version),
  }
}

/** Returns current quarter string, e.g., "2026-Q1" */
function getCurrentQuarter(): string {
  const d = new Date()
  const q = Math.ceil((d.getMonth() + 1) / 3)
  return `${d.getFullYear()}-Q${q}`
}
