/**
 * One-time migration script: Converts relational data to markdown files in Supabase Storage.
 *
 * Usage:
 *   npx tsx scripts/migrate-to-markdown.ts                    # Migrate all users
 *   npx tsx scripts/migrate-to-markdown.ts --user <uuid>      # Migrate single user
 *   npx tsx scripts/migrate-to-markdown.ts --dry-run           # Log without writing
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 */

import { createClient } from '@supabase/supabase-js'
import matter from 'gray-matter'

// ============================================
// Types (inline to avoid import path issues)
// ============================================

interface MigrationResult {
  userId: string
  status: 'migrated' | 'skipped' | 'failed' | 'deferred'
  filesWritten: number
  errors: string[]
}

interface LifeMapRow {
  id: string
  user_id: string
  narrative_summary: string | null
  primary_compounding_engine: string | null
  quarterly_priorities: string[] | null
  key_tensions: string[] | null
  anti_goals: string[] | null
  failure_modes: string[] | null
  identity_statements: string[] | null
  created_at: string
  updated_at: string
}

interface DomainRow {
  id: string
  life_map_id: string
  domain_name: string
  current_state: string | null
  whats_working: string[] | null
  whats_not_working: string[] | null
  desires: string[] | null
  tensions: string[] | null
  stated_intentions: string[] | null
  status: string | null
  updated_at: string
}

interface SessionRow {
  id: string
  session_type: string
  status: string
  ai_summary: string | null
  sentiment: string | null
  key_themes: string[] | null
  commitments_made: string[] | null
  energy_level: number | null
  domains_explored: string[] | null
  created_at: string
  completed_at: string | null
}

interface PatternRow {
  description: string | null
  pattern_type: string
  related_domain: string | null
  is_active: boolean
}

interface UserRow {
  id: string
  email: string | null
  created_at: string
  sage_persona_notes: string | null
}

interface PulseRating {
  domain_name: string
  rating_numeric: number
  is_baseline: boolean
}

// ============================================
// Domain name to filename mapping
// ============================================

const DOMAIN_FILE_MAP: Record<string, string> = {
  'Career / Work': 'career',
  'Relationships': 'relationships',
  'Health / Body': 'health',
  'Finances': 'finances',
  'Learning / Growth': 'learning',
  'Creative Pursuits': 'creative-pursuits',
  'Play / Fun / Adventure': 'play',
  'Meaning / Purpose': 'meaning',
}

const STORAGE_BUCKET = 'user-files'

// ============================================
// Config
// ============================================

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const SINGLE_USER = args.includes('--user') ? args[args.indexOf('--user') + 1] : null

if (SINGLE_USER && !/^[0-9a-f-]{36}$/i.test(SINGLE_USER)) {
  console.error('Invalid UUID format for --user flag')
  process.exit(1)
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ============================================
// File generation helpers
// ============================================

function buildMarkdownFile(frontmatter: Record<string, unknown>, content: string): string {
  return matter.stringify(content, frontmatter)
}

function formatArrayAsBullets(items: string[] | null | undefined): string {
  if (!items?.length) return ''
  return items.map((item) => `- ${item}`).join('\n')
}

function formatArrayAsNumbered(items: string[] | null | undefined): string {
  if (!items?.length) return ''
  return items.map((item, i) => `${i + 1}. ${item}`).join('\n')
}

function generateOverviewContent(lifeMap: LifeMapRow): string {
  const sections: string[] = ['# Life Map Overview']

  if (lifeMap.narrative_summary) {
    sections.push(`\n## Narrative Summary\n${lifeMap.narrative_summary}`)
  }

  if (lifeMap.primary_compounding_engine) {
    sections.push(`\n## Your North Star\n**${lifeMap.primary_compounding_engine}**`)
  }

  if (lifeMap.quarterly_priorities?.length) {
    sections.push(`\n## This Quarter's Focus\n${formatArrayAsNumbered(lifeMap.quarterly_priorities)}`)
  }

  if (lifeMap.key_tensions?.length) {
    sections.push(`\n## Tensions to Watch\n${formatArrayAsBullets(lifeMap.key_tensions)}`)
  }

  if (lifeMap.anti_goals?.length) {
    sections.push(`\n## Boundaries\n${formatArrayAsBullets(lifeMap.anti_goals)}`)
  }

  if (lifeMap.identity_statements?.length) {
    sections.push(`\n## Identity Statements\n${formatArrayAsBullets(lifeMap.identity_statements)}`)
  }

  if (lifeMap.failure_modes?.length) {
    sections.push(`\n## Failure Modes\n${formatArrayAsBullets(lifeMap.failure_modes)}`)
  }

  return sections.join('\n')
}

function generateDomainContent(domain: DomainRow): string {
  const displayName = domain.domain_name
  const sections: string[] = [`# ${displayName}`]

  if (domain.current_state) {
    sections.push(`\n## Current State\n${domain.current_state}`)
  }

  if (domain.whats_working?.length) {
    sections.push(`\n## What's Working\n${formatArrayAsBullets(domain.whats_working)}`)
  }

  if (domain.whats_not_working?.length) {
    sections.push(`\n## What's Not Working\n${formatArrayAsBullets(domain.whats_not_working)}`)
  }

  if (domain.desires?.length) {
    sections.push(`\n## Desires\n${formatArrayAsBullets(domain.desires)}`)
  }

  if (domain.tensions?.length) {
    const tensionText = domain.tensions.length === 1
      ? domain.tensions[0]
      : formatArrayAsBullets(domain.tensions)
    sections.push(`\n## Key Tension\n${tensionText}`)
  }

  if (domain.stated_intentions?.length) {
    const intentionText = domain.stated_intentions.length === 1
      ? domain.stated_intentions[0]
      : formatArrayAsBullets(domain.stated_intentions)
    sections.push(`\n## Stated Intention\n${intentionText}`)
  }

  return sections.join('\n')
}

function generateLifePlanContent(lifeMap: LifeMapRow): string {
  const sections: string[] = ['# Life Plan']

  if (lifeMap.primary_compounding_engine) {
    sections.push(`\n## Quarter Theme\n${lifeMap.primary_compounding_engine}`)
  }

  if (lifeMap.quarterly_priorities?.length) {
    sections.push('\n## Active Commitments')
    for (const priority of lifeMap.quarterly_priorities) {
      sections.push(`\n### ${priority}\n**Status:** in_progress\n\n#### Next Steps\n- [ ] Define first action *(upcoming)*`)
    }
  }

  sections.push('\n## Things to Protect\n*To be defined during next check-in.*')

  if (lifeMap.anti_goals?.length) {
    sections.push(`\n## Boundaries\n${formatArrayAsBullets(lifeMap.anti_goals)}`)
  }

  return sections.join('\n')
}

function generateSageContextContent(
  user: UserRow,
  patterns: PatternRow[],
  sessionCount: number,
  lastSession: string | null,
  domainCount: number
): string {
  const userName = user.email?.split('@')[0] ?? 'User'
  const sections: string[] = [`# Sage's Working Model`]

  sections.push(`\n## Who ${userName} Is\n*Context model built from conversations. Updated as Sage learns more.*`)

  if (user.sage_persona_notes) {
    sections.push(`\n## Communication Notes\n${user.sage_persona_notes}`)
  }

  const activePatterns = patterns.filter((p) => p.is_active)
  if (activePatterns.length) {
    sections.push('\n## Active Patterns')
    for (const pattern of activePatterns) {
      if (pattern.description) {
        const domain = pattern.related_domain ? ` *(${pattern.related_domain})*` : ''
        sections.push(`- ${pattern.description}${domain}`)
      }
    }
  }

  return sections.join('\n')

  // Note: frontmatter contains structured fields (userName, sessionCount, etc.)
}

function generateCheckInContent(session: SessionRow): string {
  const date = session.completed_at
    ? new Date(session.completed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown date'

  const typeLabel = session.session_type === 'weekly_checkin' ? 'Weekly Check-in' : 'Life Mapping Session'
  const sections: string[] = [`# ${typeLabel} — ${date}`]

  if (session.ai_summary) {
    sections.push(`\n## Summary\n${session.ai_summary}`)
  }

  if (session.key_themes?.length) {
    sections.push(`\n## Key Themes\n${formatArrayAsBullets(session.key_themes)}`)
  }

  if (session.commitments_made?.length) {
    sections.push(`\n## Commitments Made\n${formatArrayAsBullets(session.commitments_made)}`)
  }

  if (session.sentiment) {
    sections.push(`\n## Mood & Energy\n- Sentiment: ${session.sentiment}`)
    if (session.energy_level) {
      sections.push(`- Energy level: ${session.energy_level}/5`)
    }
  }

  return sections.join('\n')
}

function generatePatternsContent(patterns: PatternRow[]): string {
  const sections: string[] = ['# Observed Patterns']

  const active = patterns.filter((p) => p.is_active)
  const inactive = patterns.filter((p) => !p.is_active)

  if (active.length) {
    sections.push('\n## Active Patterns')
    for (const p of active) {
      const domain = p.related_domain ? ` *(${p.related_domain})*` : ''
      sections.push(`- **${p.pattern_type}:** ${p.description ?? 'No description'}${domain}`)
    }
  }

  if (inactive.length) {
    sections.push('\n## Past Patterns')
    for (const p of inactive) {
      sections.push(`- **${p.pattern_type}:** ${p.description ?? 'No description'}`)
    }
  }

  return sections.join('\n')
}

// ============================================
// File writing
// ============================================

async function writeStorageFile(
  userId: string,
  path: string,
  frontmatter: Record<string, unknown>,
  content: string
): Promise<boolean> {
  const fullPath = `users/${userId}/${path}`
  const fileContent = buildMarkdownFile(frontmatter, content)

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would write: ${fullPath} (${fileContent.length} bytes)`)
    return true
  }

  const blob = new Blob([fileContent], { type: 'text/markdown' })
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fullPath, blob, { upsert: true, contentType: 'text/markdown' })

  if (error) {
    console.error(`  [ERROR] Failed to write ${fullPath}: ${error.message}`)
    return false
  }

  return true
}

async function writeFileIndex(
  userId: string,
  filePath: string,
  fileType: string,
  frontmatter: Record<string, unknown>,
  domainName?: string
): Promise<void> {
  if (DRY_RUN) return

  await supabase.from('file_index').upsert(
    {
      user_id: userId,
      file_path: filePath,
      file_type: fileType,
      domain_name: domainName ?? null,
      status: (frontmatter.status as string) ?? null,
      quarter: (frontmatter.quarter as string) ?? null,
      last_updated: new Date().toISOString(),
      version: (frontmatter.version as number) ?? 1,
      frontmatter,
    },
    { onConflict: 'user_id,file_path' }
  )
}

// ============================================
// Per-user migration
// ============================================

async function migrateUser(userId: string): Promise<MigrationResult> {
  const result: MigrationResult = { userId, status: 'migrated', filesWritten: 0, errors: [] }

  // Check migration status
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (!user) {
    return { ...result, status: 'failed', errors: ['User not found'] }
  }

  if (user.markdown_migration_status === 'migrated' && !args.includes('--force')) {
    console.log(`  Skipping ${userId} — already migrated`)
    return { ...result, status: 'skipped' }
  }

  // Check for active session
  const { data: activeSessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')

  if (activeSessions?.length) {
    console.log(`  Deferring ${userId} — active session in progress`)
    if (!DRY_RUN) {
      await supabase.from('users').update({ markdown_migration_status: 'deferred' }).eq('id', userId)
    }
    return { ...result, status: 'deferred' }
  }

  // Fetch all relational data
  const { data: lifeMap } = await supabase
    .from('life_maps')
    .select('*')
    .eq('user_id', userId)
    .eq('is_current', true)
    .single()

  const domains: DomainRow[] = lifeMap
    ? ((await supabase.from('life_map_domains').select('*').eq('life_map_id', lifeMap.id)).data ?? [])
    : []

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })

  const { data: patterns } = await supabase
    .from('patterns')
    .select('*')
    .eq('user_id', userId)

  const { data: pulseRatings } = await supabase
    .from('pulse_check_ratings')
    .select('*')
    .eq('user_id', userId)
    .eq('is_baseline', true)

  // Build pulse score map
  const pulseScores: Record<string, number> = {}
  for (const rating of (pulseRatings ?? []) as PulseRating[]) {
    pulseScores[rating.domain_name] = rating.rating_numeric
  }

  // Generate all files in memory, then write in parallel
  const writePromises: Promise<boolean>[] = []
  const indexPromises: Promise<void>[] = []
  const now = new Date().toISOString()

  // 1. Overview file
  if (lifeMap) {
    const overviewFm = {
      type: 'life-map-overview',
      user_id: userId,
      last_updated: lifeMap.updated_at ?? now,
      updated_by: 'system',
      version: 1,
      schema_version: 1,
      domains_mapped: domains.length,
    }
    const overviewContent = generateOverviewContent(lifeMap as LifeMapRow)
    writePromises.push(writeStorageFile(userId, 'life-map/_overview.md', overviewFm, overviewContent))
    indexPromises.push(writeFileIndex(userId, 'life-map/_overview.md', 'overview', overviewFm))
  }

  // 2. Domain files
  for (const domain of domains) {
    const filename = DOMAIN_FILE_MAP[domain.domain_name]
    if (!filename) {
      result.errors.push(`Unknown domain name: ${domain.domain_name}`)
      continue
    }

    const domainFm = {
      domain: filename,
      status: domain.status ?? 'stable',
      score: pulseScores[domain.domain_name] ?? undefined,
      last_updated: domain.updated_at ?? now,
      updated_by: 'system' as const,
      version: 1,
      schema_version: 1,
    }
    const domainContent = generateDomainContent(domain)
    const path = `life-map/${filename}.md`
    writePromises.push(writeStorageFile(userId, path, domainFm, domainContent))
    indexPromises.push(writeFileIndex(userId, path, 'domain', domainFm, filename))
  }

  // 3. Life plan (generated from synthesis data)
  if (lifeMap && (lifeMap as LifeMapRow).quarterly_priorities?.length) {
    const quarter = getCurrentQuarter()
    const planFm = {
      type: 'life-plan',
      quarter,
      quarter_theme: (lifeMap as LifeMapRow).primary_compounding_engine ?? undefined,
      status: 'active',
      created_at: now,
      last_updated: now,
      updated_by: 'system' as const,
      version: 1,
      schema_version: 1,
    }
    const planContent = generateLifePlanContent(lifeMap as LifeMapRow)
    writePromises.push(writeStorageFile(userId, 'life-plan/current.md', planFm, planContent))
    indexPromises.push(writeFileIndex(userId, 'life-plan/current.md', 'life-plan', planFm))
  }

  // 4. Sage context
  const sessionCount = (sessions ?? []).length
  const lastSession = sessions?.[0]?.completed_at ?? null
  const contextFm = {
    user_name: (user as UserRow).email?.split('@')[0] ?? 'User',
    member_since: (user as UserRow).created_at,
    total_sessions: sessionCount,
    last_session: lastSession ?? undefined,
    life_map_completion: `${domains.length}/8 domains`,
  }
  const contextContent = generateSageContextContent(
    user as UserRow,
    (patterns ?? []) as PatternRow[],
    sessionCount,
    lastSession,
    domains.length
  )
  writePromises.push(writeStorageFile(userId, 'sage/context.md', contextFm, contextContent))
  indexPromises.push(writeFileIndex(userId, 'sage/context.md', 'sage-context', contextFm))

  // 5. Patterns file
  if (patterns?.length) {
    const patternsFm = {
      last_updated: now,
      active_count: patterns.filter((p: PatternRow) => p.is_active).length,
      version: 1,
    }
    const patternsContent = generatePatternsContent(patterns as PatternRow[])
    writePromises.push(writeStorageFile(userId, 'sage/patterns.md', patternsFm, patternsContent))
    indexPromises.push(writeFileIndex(userId, 'sage/patterns.md', 'sage-patterns', patternsFm))
  }

  // 6. Check-in files (from completed sessions with summaries)
  for (const session of (sessions ?? []) as SessionRow[]) {
    if (!session.ai_summary) continue

    const completedDate = session.completed_at
      ? new Date(session.completed_at).toISOString().split('T')[0]
      : new Date(session.created_at).toISOString().split('T')[0]
    const typeSlug = session.session_type === 'weekly_checkin' ? 'weekly' : session.session_type
    const filename = `${completedDate}-${typeSlug}.md`

    const checkinFm = {
      type: session.session_type === 'weekly_checkin' ? 'weekly-check-in' : 'life-mapping',
      date: completedDate,
      domains_discussed: session.domains_explored ?? [],
      mood: session.energy_level ?? undefined,
      version: 1,
      schema_version: 1,
    }
    const checkinContent = generateCheckInContent(session)
    writePromises.push(writeStorageFile(userId, `check-ins/${filename}`, checkinFm, checkinContent))
    indexPromises.push(writeFileIndex(userId, `check-ins/${filename}`, 'check-in', checkinFm))
  }

  // Execute all writes in parallel
  const writeResults = await Promise.allSettled(writePromises)
  let successCount = 0
  for (const wr of writeResults) {
    if (wr.status === 'fulfilled' && wr.value) {
      successCount++
    } else if (wr.status === 'rejected') {
      result.errors.push(String(wr.reason))
    }
  }
  result.filesWritten = successCount

  // Execute index writes in parallel (best effort)
  await Promise.allSettled(indexPromises)

  // Mark migration status
  if (!DRY_RUN) {
    const migrationStatus = result.errors.length ? 'failed' : 'migrated'
    await supabase.from('users').update({
      markdown_migration_status: migrationStatus,
      markdown_migrated_at: migrationStatus === 'migrated' ? now : null,
    }).eq('id', userId)
    result.status = migrationStatus as 'migrated' | 'failed'
  }

  return result
}

// ============================================
// Main
// ============================================

function getCurrentQuarter(): string {
  const d = new Date()
  const q = Math.ceil((d.getMonth() + 1) / 3)
  return `${d.getFullYear()}-Q${q}`
}

async function main() {
  console.log(`\n=== MeOS Markdown Migration ===`)
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Target: ${SINGLE_USER ?? 'all users'}\n`)

  // Pre-migration verification queries
  console.log('--- Pre-migration verification ---')

  // Run queries to check for unmapped data
  const { data: desiresCheck } = await supabase
    .from('life_map_domains')
    .select('desires')
    .not('desires', 'is', null)
    .limit(1)

  console.log(`Domains with desires data: ${desiresCheck?.length ? 'YES — will be migrated' : 'None'}`)

  const { data: failureCheck } = await supabase
    .from('life_maps')
    .select('failure_modes')
    .not('failure_modes', 'is', null)
    .limit(1)

  console.log(`Life maps with failure_modes data: ${failureCheck?.length ? 'YES — will be migrated' : 'None'}`)

  const { data: identityCheck } = await supabase
    .from('life_maps')
    .select('identity_statements')
    .not('identity_statements', 'is', null)
    .limit(1)

  console.log(`Life maps with identity_statements data: ${identityCheck?.length ? 'YES — will be migrated' : 'None'}`)

  console.log('--- Starting migration ---\n')

  // Get users to migrate
  let users: { id: string }[]
  if (SINGLE_USER) {
    users = [{ id: SINGLE_USER }]
  } else {
    const { data } = await supabase.from('users').select('id')
    users = data ?? []
  }

  console.log(`Found ${users.length} users to migrate\n`)

  const results: MigrationResult[] = []

  for (const user of users) {
    console.log(`Migrating user ${user.id}...`)
    const result = await migrateUser(user.id)
    results.push(result)
    console.log(`  ${result.status}: ${result.filesWritten} files written${result.errors.length ? `, ${result.errors.length} errors` : ''}`)
    if (result.errors.length) {
      for (const err of result.errors) {
        console.log(`    ERROR: ${err}`)
      }
    }
  }

  // Summary
  console.log('\n=== Migration Summary ===')
  console.log(`Total users: ${results.length}`)
  console.log(`Migrated: ${results.filter((r) => r.status === 'migrated').length}`)
  console.log(`Skipped: ${results.filter((r) => r.status === 'skipped').length}`)
  console.log(`Deferred: ${results.filter((r) => r.status === 'deferred').length}`)
  console.log(`Failed: ${results.filter((r) => r.status === 'failed').length}`)
  console.log(`Total files written: ${results.reduce((sum, r) => sum + r.filesWritten, 0)}`)
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
