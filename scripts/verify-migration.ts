/**
 * Post-migration verification: Compares markdown files against relational data.
 *
 * Usage:
 *   npx tsx scripts/verify-migration.ts                    # Verify all migrated users
 *   npx tsx scripts/verify-migration.ts --user <uuid>      # Verify single user
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 */

import { createClient } from '@supabase/supabase-js'
import matter from 'gray-matter'

const STORAGE_BUCKET = 'user-files'

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

const args = process.argv.slice(2)
const SINGLE_USER = args.includes('--user') ? args[args.indexOf('--user') + 1] : null

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface VerificationResult {
  userId: string
  checks: { name: string; passed: boolean; detail: string }[]
  passed: boolean
}

async function readStorageFile(userId: string, path: string): Promise<{ frontmatter: Record<string, unknown>; content: string } | null> {
  const fullPath = `users/${userId}/${path}`
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(fullPath)
  if (error) return null
  const text = await data.text()
  const parsed = matter(text)
  return { frontmatter: parsed.data, content: parsed.content.trim() }
}

async function verifyUser(userId: string): Promise<VerificationResult> {
  const checks: { name: string; passed: boolean; detail: string }[] = []

  // Fetch relational data
  const { data: lifeMap } = await supabase
    .from('life_maps')
    .select('*')
    .eq('user_id', userId)
    .eq('is_current', true)
    .single()

  const domains = lifeMap
    ? ((await supabase.from('life_map_domains').select('*').eq('life_map_id', lifeMap.id)).data ?? [])
    : []

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'completed')

  const sessionsWithSummary = (sessions ?? []).filter((s: { ai_summary: string | null }) => s.ai_summary)

  const { data: user } = await supabase.from('users').select('*').eq('id', userId).single()

  // Check 1: Overview file exists (if life map exists)
  if (lifeMap) {
    const overview = await readStorageFile(userId, 'life-map/_overview.md')
    checks.push({
      name: 'Overview file exists',
      passed: overview !== null,
      detail: overview ? 'Found' : 'Missing',
    })

    if (overview && lifeMap.narrative_summary) {
      checks.push({
        name: 'Overview has narrative',
        passed: overview.content.includes('Narrative Summary'),
        detail: overview.content.includes('Narrative Summary') ? 'Present' : 'Missing narrative section',
      })
    }
  }

  // Check 2: Domain file count matches
  const expectedDomainCount = domains.length
  let actualDomainCount = 0
  for (const domain of domains) {
    const filename = DOMAIN_FILE_MAP[domain.domain_name as string]
    if (!filename) continue
    const file = await readStorageFile(userId, `life-map/${filename}.md`)
    if (file) actualDomainCount++
  }
  checks.push({
    name: 'Domain file count',
    passed: actualDomainCount === expectedDomainCount,
    detail: `Expected: ${expectedDomainCount}, Found: ${actualDomainCount}`,
  })

  // Check 3: Life plan exists (if synthesis data exists)
  if (lifeMap?.quarterly_priorities?.length) {
    const plan = await readStorageFile(userId, 'life-plan/current.md')
    checks.push({
      name: 'Life plan exists',
      passed: plan !== null,
      detail: plan ? 'Found' : 'Missing',
    })
  }

  // Check 4: Sage context exists
  const context = await readStorageFile(userId, 'sage/context.md')
  checks.push({
    name: 'Sage context exists',
    passed: context !== null,
    detail: context ? 'Found' : 'Missing',
  })

  if (context && user) {
    const expectedName = user.email?.split('@')[0] ?? 'User'
    checks.push({
      name: 'Sage context has user_name',
      passed: context.frontmatter.user_name === expectedName,
      detail: `Expected: ${expectedName}, Got: ${context.frontmatter.user_name}`,
    })
  }

  // Check 5: Check-in count matches sessions with summaries
  let checkinFileCount = 0
  for (const session of sessionsWithSummary) {
    const completedDate = session.completed_at
      ? new Date(session.completed_at).toISOString().split('T')[0]
      : new Date(session.created_at).toISOString().split('T')[0]
    const typeSlug = session.session_type === 'weekly_checkin' ? 'weekly' : session.session_type
    const file = await readStorageFile(userId, `check-ins/${completedDate}-${typeSlug}.md`)
    if (file) checkinFileCount++
  }
  checks.push({
    name: 'Check-in file count',
    passed: checkinFileCount === sessionsWithSummary.length,
    detail: `Expected: ${sessionsWithSummary.length}, Found: ${checkinFileCount}`,
  })

  // Check 6: Migration status is marked
  checks.push({
    name: 'Migration status set',
    passed: user?.markdown_migration_status === 'migrated',
    detail: `Status: ${user?.markdown_migration_status ?? 'not set'}`,
  })

  return {
    userId,
    checks,
    passed: checks.every((c) => c.passed),
  }
}

async function main() {
  console.log('\n=== MeOS Migration Verification ===\n')

  let users: { id: string }[]
  if (SINGLE_USER) {
    users = [{ id: SINGLE_USER }]
  } else {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('markdown_migration_status', 'migrated')
    users = data ?? []
  }

  console.log(`Verifying ${users.length} users\n`)

  let totalPassed = 0
  let totalFailed = 0

  for (const user of users) {
    const result = await verifyUser(user.id)
    const status = result.passed ? 'PASS' : 'FAIL'
    console.log(`User ${user.id}: ${status}`)

    for (const check of result.checks) {
      const icon = check.passed ? '  ✓' : '  ✗'
      console.log(`${icon} ${check.name}: ${check.detail}`)
    }
    console.log()

    if (result.passed) totalPassed++
    else totalFailed++
  }

  console.log('=== Summary ===')
  console.log(`Passed: ${totalPassed}`)
  console.log(`Failed: ${totalFailed}`)

  if (totalFailed > 0) process.exit(1)
}

main().catch((err) => {
  console.error('Verification failed:', err)
  process.exit(1)
})
