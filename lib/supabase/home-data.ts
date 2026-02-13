import type { SupabaseClient } from '@supabase/supabase-js'

export interface HomeData {
  greeting: string
  firstName: string | null
  onboardingCompleted: boolean
  nextCheckinDate: string | null
  checkinOverdue: boolean
  quarterlyPriorities: string[]
}

function getTimeGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
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

  // Get quarterly priorities from current life map
  let quarterlyPriorities: string[] = []

  if (onboardingCompleted) {
    const { data: lifeMap } = await supabase
      .from('life_maps')
      .select('quarterly_priorities')
      .eq('user_id', userId)
      .eq('is_current', true)
      .single()

    quarterlyPriorities = (lifeMap?.quarterly_priorities || []).slice(0, 3)
  }

  return {
    greeting: getTimeGreeting(),
    firstName,
    onboardingCompleted,
    nextCheckinDate,
    checkinOverdue,
    quarterlyPriorities,
  }
}
