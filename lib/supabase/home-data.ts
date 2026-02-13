import type { SupabaseClient } from '@supabase/supabase-js'

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

  // Get quarterly priorities + compounding engine from current life map
  let quarterlyPriorities: string[] = []
  let compoundingEngine: string | null = null
  let daysSinceMapping: number | null = null

  if (onboardingCompleted) {
    const { data: lifeMap } = await supabase
      .from('life_maps')
      .select('quarterly_priorities, primary_compounding_engine, updated_at')
      .eq('user_id', userId)
      .eq('is_current', true)
      .single()

    quarterlyPriorities = (lifeMap?.quarterly_priorities || []).slice(0, 3)
    compoundingEngine = lifeMap?.primary_compounding_engine || null

    if (lifeMap?.updated_at) {
      const mapDate = new Date(lifeMap.updated_at)
      daysSinceMapping = Math.floor((Date.now() - mapDate.getTime()) / (1000 * 60 * 60 * 24))
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
