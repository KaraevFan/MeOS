import { z } from 'zod'

// ============================================
// Domain file frontmatter
// ============================================

export const DomainFileFrontmatterSchema = z.object({
  domain: z.string(),
  status: z.enum(['thriving', 'stable', 'needs_attention', 'in_crisis']).default('stable'),
  score: z.number().min(1).max(5).optional(),
  preview_line: z.string().optional(),
  last_updated: z.string(),
  updated_by: z.enum(['sage', 'system', 'user']).default('sage'),
  version: z.number().int().positive().default(1),
  schema_version: z.number().int().positive().default(1),
})

export type DomainFileFrontmatter = z.infer<typeof DomainFileFrontmatterSchema>

// ============================================
// Overview file frontmatter
// ============================================

export const OverviewFileFrontmatterSchema = z.object({
  type: z.literal('life-map-overview').default('life-map-overview'),
  user_id: z.string().optional(),
  last_updated: z.string(),
  updated_by: z.enum(['sage', 'system', 'user']).default('sage'),
  version: z.number().int().positive().default(1),
  schema_version: z.number().int().positive().default(1),
  domains_mapped: z.number().int().min(0).default(0),
})

export type OverviewFileFrontmatter = z.infer<typeof OverviewFileFrontmatterSchema>

// ============================================
// Life plan file frontmatter
// ============================================

export const LifePlanFileFrontmatterSchema = z.object({
  type: z.literal('life-plan').default('life-plan'),
  quarter: z.string(),
  quarter_theme: z.string().optional(),
  north_star_domain: z.string().optional(),
  status: z.enum(['active', 'archived']).default('active'),
  created_at: z.string(),
  last_updated: z.string(),
  updated_by: z.enum(['sage', 'system', 'user']).default('sage'),
  version: z.number().int().positive().default(1),
  schema_version: z.number().int().positive().default(1),
})

export type LifePlanFileFrontmatter = z.infer<typeof LifePlanFileFrontmatterSchema>

// ============================================
// Check-in file frontmatter
// ============================================

export const CheckInFileFrontmatterSchema = z.object({
  type: z.enum(['weekly-check-in', 'monthly-review', 'quarterly-review']).default('weekly-check-in'),
  date: z.string(),
  duration_minutes: z.number().optional(),
  domains_discussed: z.array(z.string()).default([]),
  mood: z.number().min(1).max(5).optional(),
  pulse_scores: z.record(z.string(), z.number()).optional(),
  version: z.number().int().positive().default(1),
  schema_version: z.number().int().positive().default(1),
})

export type CheckInFileFrontmatter = z.infer<typeof CheckInFileFrontmatterSchema>

// ============================================
// Sage context file frontmatter
// ============================================

export const SageContextFrontmatterSchema = z.object({
  user_name: z.string().optional(),
  member_since: z.string().optional(),
  total_sessions: z.number().int().min(0).default(0),
  last_session: z.string().optional(),
  life_map_completion: z.string().optional(),
})

export type SageContextFrontmatter = z.infer<typeof SageContextFrontmatterSchema>

// ============================================
// Patterns file frontmatter
// ============================================

export const PatternsFrontmatterSchema = z.object({
  last_updated: z.string(),
  active_count: z.number().int().min(0).default(0),
  version: z.number().int().positive().default(1),
})

export type PatternsFrontmatter = z.infer<typeof PatternsFrontmatterSchema>

// ============================================
// Daily log (journal) file frontmatter
// ============================================

export const DailyLogFrontmatterSchema = z.object({
  date: z.string(),
  type: z.literal('daily-journal'),
  energy: z.enum(['high', 'moderate', 'low']).optional(),
  mood_signal: z.string().optional(),
  domains_touched: z.array(z.string()).optional(),
  intention_fulfilled: z.enum(['yes', 'partial', 'no', 'not-applicable']).optional(),
  session_depth: z.enum(['quick-checkin', 'standard', 'deep-processing']).optional(),
  created_at: z.string().optional(),
})

export type DailyLogFrontmatter = z.infer<typeof DailyLogFrontmatterSchema>

// ============================================
// Union type for all frontmatter
// ============================================

export type AnyFrontmatter =
  | DomainFileFrontmatter
  | OverviewFileFrontmatter
  | LifePlanFileFrontmatter
  | CheckInFileFrontmatter
  | SageContextFrontmatter
  | PatternsFrontmatter
  | DailyLogFrontmatter

// ============================================
// Parsed file structure
// ============================================

export interface ParsedMarkdownFile<T = Record<string, unknown>> {
  frontmatter: T
  content: string
}
