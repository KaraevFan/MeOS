import type { SupabaseClient } from '@supabase/supabase-js'
import { UserFileSystem } from '@/lib/markdown/user-file-system'

export interface HomeData {
  greeting: string
  firstName: string | null
  onboardingCompleted: boolean
  nextCheckinDate: string | null
  checkinOverdue: boolean
  quarterlyPriorities: string[]
  sageLine: string | null
  compoundingEngine: string | null
  daysSinceMapping: number | null
}

function getTimeGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function getSageLine(context: {
  daysSinceMapping: number | null
  daysSinceCheckin: number | null
  topPriority: string | null
  compoundingEngine: string | null
  nextCheckinAt: string | null
}): string | null {
  const { daysSinceMapping, daysSinceCheckin, topPriority, compoundingEngine, nextCheckinAt } = context

  // Check-in imminent
  if (nextCheckinAt) {
    const diffMs = new Date(nextCheckinAt).getTime() - Date.now()
    const diffHours = diffMs / (1000 * 60 * 60)
    if (diffHours > 0 && diffHours <= 24) {
      return "Check-in's tomorrow. Take a minute to notice how the week felt."
    }
  }

  // Post check-in (within 1 day)
  if (daysSinceCheckin !== null && daysSinceCheckin <= 1) {
    return "Good check-in. Here's what's carrying forward."
  }

  // Day 1 after mapping
  if (daysSinceMapping !== null && daysSinceMapping <= 1) {
    return "You mapped your life yesterday. Today's the first day of doing something about it."
  }

  // First week
  if (daysSinceMapping !== null && daysSinceMapping <= 7 && compoundingEngine) {
    return `Day ${daysSinceMapping} of focusing on ${compoundingEngine}. How's momentum?`
  }

  // Week 2
  if (daysSinceMapping !== null && daysSinceMapping <= 14) {
    return "Two weeks in. Are things tracking, or has reality intervened?"
  }

  // Generic with priority
  if (topPriority) {
    return `Your focus: ${topPriority}. One thing today?`
  }

  // Fallback
  return "I'm here whenever you want to talk."
}

/**
 * Extract a markdown section's content by heading text.
 * Returns the content between the matched heading and the next heading of equal or higher level.
 */
function extractMarkdownSection(content: string, heading: string): string | null {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const headingRegex = new RegExp(`^#{1,3}\\s+${escaped}`, 'm')
  const match = content.match(headingRegex)
  if (!match || match.index === undefined) return null

  const afterHeading = content.slice(match.index + match[0].length)
  const nextHeading = afterHeading.search(/^#{1,3}\s/m)
  const sectionContent = nextHeading === -1 ? afterHeading : afterHeading.slice(0, nextHeading)
  return sectionContent.trim()
}

/**
 * Extract a bullet list from a markdown section.
 */
function extractBulletList(content: string, heading: string): string[] {
  const section = extractMarkdownSection(content, heading)
  if (!section) return []
  return section
    .split('\n')
    .filter((line) => line.startsWith('- '))
    .map((line) => line.replace(/^-\s+/, '').trim())
}

export async function getHomeData(
  supabase: SupabaseClient,
  userId: string
): Promise<HomeData> {
  // Get user profile
  const { data: user } = await supabase
    .from('users')
    .select('email, onboarding_completed, next_checkin_at')
    .eq('id', userId)
    .single()

  const onboardingCompleted = user?.onboarding_completed ?? false

  // Extract first name from email
  const email = user?.email || ''
  const firstName = email.split('@')[0]?.split(/[._+-]/)[0] || null

  // Use next_checkin_at from users table (set by completeSession)
  let nextCheckinDate: string | null = null
  let checkinOverdue = false

  if (onboardingCompleted && user?.next_checkin_at) {
    nextCheckinDate = user.next_checkin_at
    checkinOverdue = new Date(user.next_checkin_at) <= new Date()
  }

  // Get quarterly priorities + compounding engine from markdown files
  let quarterlyPriorities: string[] = []
  let compoundingEngine: string | null = null
  let daysSinceMapping: number | null = null

  if (onboardingCompleted) {
    const ufs = new UserFileSystem(supabase, userId)
    const overview = await ufs.readOverview().catch(() => null)

    if (overview) {
      // Extract priorities from "This Quarter's Focus" section
      quarterlyPriorities = extractBulletList(overview.content, "This Quarter's Focus").slice(0, 3)

      // Extract compounding engine / north star from "Your North Star" section
      const northStar = extractMarkdownSection(overview.content, 'Your North Star')
      if (northStar) {
        // Extract bold text: **Career transition** — because...
        const boldMatch = northStar.match(/\*\*(.+?)\*\*/)
        compoundingEngine = boldMatch ? boldMatch[1] : northStar.split('\n')[0] || null
      }

      // Days since mapping from frontmatter last_updated
      if (overview.frontmatter.last_updated) {
        const mapDate = new Date(overview.frontmatter.last_updated)
        daysSinceMapping = Math.floor((Date.now() - mapDate.getTime()) / (1000 * 60 * 60 * 24))
      }
    }
  }

  // Calculate days since last check-in
  let daysSinceCheckin: number | null = null
  if (onboardingCompleted) {
    const { data: lastCheckin } = await supabase
      .from('sessions')
      .select('completed_at')
      .eq('user_id', userId)
      .eq('session_type', 'weekly_checkin')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastCheckin?.completed_at) {
      daysSinceCheckin = Math.floor((Date.now() - new Date(lastCheckin.completed_at).getTime()) / (1000 * 60 * 60 * 24))
    }
  }

  const sageLine = onboardingCompleted
    ? getSageLine({
        daysSinceMapping,
        daysSinceCheckin,
        topPriority: quarterlyPriorities[0] || null,
        compoundingEngine,
        nextCheckinAt: nextCheckinDate,
      })
    : null

  return {
    greeting: getTimeGreeting(),
    firstName,
    onboardingCompleted,
    nextCheckinDate,
    checkinOverdue,
    quarterlyPriorities,
    sageLine,
    compoundingEngine,
    daysSinceMapping,
  }
}
