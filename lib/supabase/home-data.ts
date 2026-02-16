import type { SupabaseClient } from '@supabase/supabase-js'
import { UserFileSystem } from '@/lib/markdown/user-file-system'
import { extractMarkdownSection, extractBulletList, extractCommitments } from '@/lib/markdown/extract'
import type { Commitment } from '@/lib/markdown/extract'
import { getDisplayName } from '@/lib/utils'

export interface ReflectionNudge {
  id: string
  text: string
  contextHint: string | null
}

export interface HomeData {
  greeting: string
  firstName: string | null
  onboardingCompleted: boolean
  nextCheckinDate: string | null
  checkinOverdue: boolean
  quarterlyPriorities: string[]
  sageLine: string | null
  northStar: string | null
  northStarFull: string | null
  commitments: Commitment[]
  boundaries: string[]
  quarterTheme: string | null
  daysSinceMapping: number | null
  reflectionNudge: ReflectionNudge | null
  activeSessionId: string | null
  activeSessionType: string | null
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
  northStar: string | null
  topCommitment: string | null
  nextCheckinAt: string | null
}): string | null {
  const { daysSinceMapping, daysSinceCheckin, topPriority, northStar, topCommitment, nextCheckinAt } = context

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

  // First week — reference commitment name if available
  if (daysSinceMapping !== null && daysSinceMapping <= 7) {
    if (topCommitment) {
      return `Day ${daysSinceMapping} of "${topCommitment}." How's momentum?`
    }
    if (northStar) {
      return `Day ${daysSinceMapping} of focusing on ${northStar}. How's momentum?`
    }
    return `Day ${daysSinceMapping} since your life map. How are things landing?`
  }

  // Week 2
  if (daysSinceMapping !== null && daysSinceMapping <= 14) {
    return "Two weeks in. Are things tracking, or has reality intervened?"
  }

  // With north star
  if (northStar) {
    return `Your north star: ${northStar}. One thing today?`
  }

  // Generic with priority
  if (topPriority) {
    return `Your focus: ${topPriority}. One thing today?`
  }

  // Fallback
  return "I'm here whenever you want to talk."
}

export async function getHomeData(
  supabase: SupabaseClient,
  userId: string
): Promise<HomeData> {
  // Get user profile
  const { data: user } = await supabase
    .from('users')
    .select('email, display_name, onboarding_completed, next_checkin_at')
    .eq('id', userId)
    .single()

  const onboardingCompleted = user?.onboarding_completed ?? false

  const firstName = getDisplayName({
    display_name: user?.display_name,
    email: user?.email,
  })

  // Use next_checkin_at from users table (set by completeSession)
  let nextCheckinDate: string | null = null
  let checkinOverdue = false

  if (onboardingCompleted && user?.next_checkin_at) {
    nextCheckinDate = user.next_checkin_at
    checkinOverdue = new Date(user.next_checkin_at) <= new Date()
  }

  // Check for active session
  let activeSessionId: string | null = null
  let activeSessionType: string | null = null

  if (onboardingCompleted) {
    const { data: activeSession } = await supabase
      .from('sessions')
      .select('id, session_type')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (activeSession) {
      activeSessionId = activeSession.id
      activeSessionType = activeSession.session_type
    }
  }

  // Read from markdown files
  let quarterlyPriorities: string[] = []
  let northStar: string | null = null
  let northStarFull: string | null = null
  let commitments: Commitment[] = []
  let boundaries: string[] = []
  let quarterTheme: string | null = null
  let daysSinceMapping: number | null = null
  let daysSinceCheckin: number | null = null

  if (onboardingCompleted) {
    const ufs = new UserFileSystem(supabase, userId)

    // Read overview + life plan + last check-in all in parallel
    const [overview, lifePlan, lastCheckinResult] = await Promise.allSettled([
      ufs.readOverview(),
      ufs.readLifePlan(),
      supabase
        .from('sessions')
        .select('completed_at')
        .eq('user_id', userId)
        .eq('session_type', 'weekly_checkin')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    // Extract from overview
    const overviewData = overview.status === 'fulfilled' ? overview.value : null
    if (overviewData) {
      quarterlyPriorities = extractBulletList(overviewData.content, "This Quarter's Focus").slice(0, 3)

      // North star: bold label (short) + full paragraph
      const northStarSection = extractMarkdownSection(overviewData.content, 'Your North Star')
      if (northStarSection) {
        northStarFull = northStarSection.split('\n').filter((l) => l.trim()).join('\n')
        const boldMatch = northStarSection.match(/\*\*(.+?)\*\*/)
        northStar = boldMatch ? boldMatch[1] : northStarSection.split('\n')[0] || null
      }

      // Boundaries from overview (identity-level)
      boundaries = extractBulletList(overviewData.content, 'Boundaries')

      // Days since mapping
      if (overviewData.frontmatter.last_updated) {
        const mapDate = new Date(overviewData.frontmatter.last_updated)
        daysSinceMapping = Math.floor((Date.now() - mapDate.getTime()) / (1000 * 60 * 60 * 24))
      }
    }

    // Extract from life plan
    const lifePlanData = lifePlan.status === 'fulfilled' ? lifePlan.value : null
    if (lifePlanData) {
      commitments = extractCommitments(lifePlanData.content)

      const themeSection = extractMarkdownSection(lifePlanData.content, 'Quarter Theme')
      if (themeSection) {
        quarterTheme = themeSection.split('\n')[0]?.trim() || null
      }
    }

    // Extract days since last check-in from parallel result
    if (lastCheckinResult.status === 'fulfilled') {
      const lastCheckin = lastCheckinResult.value.data
      if (lastCheckin?.completed_at) {
        daysSinceCheckin = Math.floor((Date.now() - new Date(lastCheckin.completed_at).getTime()) / (1000 * 60 * 60 * 24))
      }
    }
  }

  // First non-complete commitment for sage line interpolation
  const activeCommitment = commitments.find((c) => c.status !== 'complete')

  const sageLine = onboardingCompleted
    ? getSageLine({
        daysSinceMapping,
        daysSinceCheckin,
        topPriority: quarterlyPriorities[0] || null,
        northStar,
        topCommitment: activeCommitment?.label || null,
        nextCheckinAt: nextCheckinDate,
      })
    : null

  // Fetch latest unused reflection prompt for home screen nudge
  let reflectionNudge: ReflectionNudge | null = null
  if (onboardingCompleted) {
    const { data: nudge } = await supabase
      .from('reflection_prompts')
      .select('id, prompt_text, context_hint')
      .eq('user_id', userId)
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (nudge) {
      reflectionNudge = {
        id: nudge.id,
        text: nudge.prompt_text,
        contextHint: nudge.context_hint,
      }
    }
  }

  return {
    greeting: getTimeGreeting(),
    firstName,
    onboardingCompleted,
    nextCheckinDate,
    checkinOverdue,
    quarterlyPriorities,
    sageLine,
    northStar,
    northStarFull,
    commitments,
    boundaries,
    quarterTheme,
    daysSinceMapping,
    reflectionNudge,
    activeSessionId,
    activeSessionType,
  }
}
