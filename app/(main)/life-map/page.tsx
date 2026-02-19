import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBaselineRatings, getDomainTrends } from '@/lib/supabase/pulse-check'
import type { TrendDirection } from '@/lib/supabase/pulse-check'
import { UserFileSystem } from '@/lib/markdown/user-file-system'
import { FILE_TO_DOMAIN_MAP, DOMAIN_FILE_MAP } from '@/lib/markdown/constants'
import { extractMarkdownSection, extractBulletList, extractCommitments } from '@/lib/markdown/extract'
import { LifeMapTabs } from '@/components/life-map/life-map-tabs'
import { RadarChart } from '@/components/ui/radar-chart'
import { DOMAIN_SHORT_NAMES } from '@/lib/constants'
import { PULSE_DOMAINS } from '@/types/pulse-check'
import type { LifeMap, LifeMapDomain } from '@/types/database'
import type { OverviewFileFrontmatter, DomainFileFrontmatter } from '@/types/markdown-files'

/**
 * Convert overview markdown content into a LifeMap shape for the SynthesisSection component.
 */
function overviewToLifeMap(
  content: string,
  frontmatter: OverviewFileFrontmatter,
  userId: string
): LifeMap {
  const narrative = extractMarkdownSection(content, 'Narrative Summary')
  const northStar = extractMarkdownSection(content, 'Your North Star')
  const priorities = extractBulletList(content, "This Quarter's Focus")
  const tensions = extractBulletList(content, 'Tensions to Watch')
  const boundaries = extractBulletList(content, 'Boundaries')

  // Extract bold text from north star: **Career transition** — because...
  let engine: string | null = null
  if (northStar) {
    const boldMatch = northStar.match(/\*\*(.+?)\*\*/)
    engine = boldMatch ? boldMatch[1] : northStar.split('\n')[0] || null
  }

  return {
    id: 'file-based',
    user_id: userId,
    is_current: true,
    narrative_summary: narrative,
    primary_compounding_engine: engine,
    quarterly_priorities: priorities.length > 0 ? priorities : null,
    key_tensions: tensions.length > 0 ? tensions : null,
    anti_goals: boundaries.length > 0 ? boundaries : null,
    failure_modes: null,
    identity_statements: null,
    created_at: frontmatter.last_updated ?? new Date().toISOString(),
    updated_at: frontmatter.last_updated ?? new Date().toISOString(),
  }
}

/**
 * Convert a domain markdown file into a LifeMapDomain shape for the DomainGrid component.
 */
function domainFileToDomain(
  content: string,
  frontmatter: DomainFileFrontmatter,
  domainName: string
): LifeMapDomain {
  const currentState = extractMarkdownSection(content, 'Current State')
  const whatsWorking = extractBulletList(content, "What's Working")
  const whatsNotWorking = extractBulletList(content, "What's Not Working")
  const keyTension = extractMarkdownSection(content, 'Key Tension')
  const statedIntention = extractMarkdownSection(content, 'Stated Intention')

  return {
    id: 'file-based',
    life_map_id: 'file-based',
    domain_name: domainName,
    current_state: currentState,
    whats_working: whatsWorking.length > 0 ? whatsWorking : null,
    whats_not_working: whatsNotWorking.length > 0 ? whatsNotWorking : null,
    desires: null,
    tensions: keyTension ? [keyTension] : null,
    stated_intentions: statedIntention ? [statedIntention] : null,
    status: frontmatter.status ?? null,
    preview_line: frontmatter.preview_line ?? null,
    updated_at: frontmatter.last_updated ?? new Date().toISOString(),
  }
}

export default async function LifeMapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const ufs = new UserFileSystem(supabase, user.id)

  // Query file_index to find which domain files actually exist, avoiding blind reads
  const { data: existingDomainFiles } = await supabase
    .from('file_index')
    .select('file_path')
    .eq('user_id', user.id)
    .eq('file_type', 'domain')

  const existingDomainFilenames = existingDomainFiles
    ? existingDomainFiles.map((d) => d.file_path.replace('life-map/', '').replace('.md', ''))
    : Object.values(DOMAIN_FILE_MAP) // Fallback to reading all if file_index unavailable

  // Read overview + life plan + existing domains + baseline ratings + trends in parallel
  const [overview, lifePlan, baselineRatings, domainTrends, lastCheckinResult, ...domainFileResults] = await Promise.allSettled([
    ufs.readOverview(),
    ufs.readLifePlan(),
    getBaselineRatings(supabase, user.id),
    getDomainTrends(supabase, user.id),
    supabase
      .from('sessions')
      .select('completed_at')
      .eq('user_id', user.id)
      .eq('session_type', 'weekly_checkin')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    ...existingDomainFilenames.map(async (filename) => {
      const file = await ufs.readDomain(filename)
      if (!file) return null
      const domainName = FILE_TO_DOMAIN_MAP[filename] ?? filename
      return domainFileToDomain(file.content, file.frontmatter, domainName)
    }),
  ])

  // Unwrap settled results
  const overviewData = overview.status === 'fulfilled' ? overview.value : null
  const lifePlanData = lifePlan.status === 'fulfilled' ? lifePlan.value : null
  const baselineRatingsData = (baselineRatings.status === 'fulfilled' ? baselineRatings.value : null) ?? []
  const trendsData: Record<string, TrendDirection | null> = domainTrends.status === 'fulfilled' ? domainTrends.value : {}
  const lastCheckinAt = lastCheckinResult.status === 'fulfilled' ? lastCheckinResult.value.data?.completed_at ?? null : null

  const domains: LifeMapDomain[] = domainFileResults
    .filter((r): r is PromiseFulfilledResult<LifeMapDomain | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((d): d is LifeMapDomain => d !== null)

  if (!overviewData && domains.length === 0 && !lifePlanData) {
    return (
      <div className="px-md pt-2xl max-w-lg mx-auto">
        <h1 className="text-xl font-bold tracking-tight mb-2">Your Life Map</h1>
        <p className="text-text-secondary mb-xl">
          Your life map will appear here after your first conversation with Sage.
        </p>
        <Link
          href="/chat"
          className="inline-flex items-center justify-center h-12 px-6 bg-primary text-white rounded-md font-medium
                     hover:bg-primary-hover transition-colors"
        >
          Talk to Sage
        </Link>
      </div>
    )
  }

  const lifeMap = overviewData
    ? overviewToLifeMap(overviewData.content, overviewData.frontmatter, user.id)
    : {
        id: 'file-based',
        user_id: user.id,
        is_current: true,
        narrative_summary: null,
        primary_compounding_engine: null,
        quarterly_priorities: null,
        key_tensions: null,
        anti_goals: null,
        failure_modes: null,
        identity_statements: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } satisfies LifeMap

  // Extract life plan data for "What I'm Doing" tab
  const commitments = lifePlanData ? extractCommitments(lifePlanData.content) : []
  const quarterTheme = lifePlanData
    ? (extractMarkdownSection(lifePlanData.content, 'Quarter Theme')?.split('\n')[0]?.trim() ?? null)
    : null
  const thingsToProtect = lifePlanData
    ? extractBulletList(lifePlanData.content, 'Things to Protect')
    : []
  const lifePlanBoundaries = lifePlanData
    ? extractBulletList(lifePlanData.content, 'Boundaries')
    : []

  const lastUpdated = overviewData?.frontmatter.last_updated

  // Build radar chart data from baseline ratings
  const radarDomains = PULSE_DOMAINS.map((d) => d.label)
  const radarRatings: Record<number, number> = {}
  const exploredDomainNames = domains.map((d) => d.domain_name)

  if (baselineRatingsData.length > 0) {
    const ratingLookup = new Map(baselineRatingsData.map((r) => [r.domain, r.ratingNumeric]))
    radarDomains.forEach((label, i) => {
      const rating = ratingLookup.get(label)
      if (rating !== undefined) {
        radarRatings[i] = rating - 1 // RadarChart maxRating=4 expects 0-based
      }
    })
  }

  const changedSinceLastCheckin = lastCheckinAt
    ? domains
        .filter((d) => new Date(d.updated_at).getTime() > new Date(lastCheckinAt).getTime())
        .map((d) => d.domain_name)
    : []

  return (
    <div className="px-md pt-lg pb-lg max-w-lg mx-auto space-y-lg">
      <h1 className="text-xl font-bold tracking-tight">Your Life Map</h1>

      {baselineRatingsData.length > 0 && (
        <div className="mb-2 px-8">
          <RadarChart
            domains={radarDomains}
            ratings={radarRatings}
            maxRating={4}
            size={280}
            exploredDomains={exploredDomainNames}
            labels={radarDomains.map((d: string) => DOMAIN_SHORT_NAMES[d as keyof typeof DOMAIN_SHORT_NAMES] ?? d)}
          />
        </div>
      )}

      <LifeMapTabs
        lifeMap={lifeMap}
        domains={domains}
        baselineRatings={baselineRatingsData}
        domainTrends={trendsData}
        changedSinceLastCheckin={changedSinceLastCheckin}
        lifePlanData={{ quarterTheme, commitments, thingsToProtect, boundaries: lifePlanBoundaries }}
      />

      {lastUpdated && (
        <p className="text-[11px] text-text-secondary text-center">
          Last updated {new Date(lastUpdated).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      )}
    </div>
  )
}
