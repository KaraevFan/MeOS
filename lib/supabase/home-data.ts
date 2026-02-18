import type { SupabaseClient } from '@supabase/supabase-js'
import { UserFileSystem } from '@/lib/markdown/user-file-system'
import { diffLocalCalendarDays, getDisplayName } from '@/lib/utils'
import type { SessionType } from '@/types/chat'

export interface HomeData {
  greeting: string
  firstName: string | null
  onboardingCompleted: boolean
  nextCheckinDate: string | null
  checkinOverdue: boolean
  activeSessionId: string | null
  activeSessionType: SessionType | null
  todayClosed: boolean
  yesterdayJournalSummary: string | null
  todayCaptureCount: number
  todayIntention: string | null
  yesterdayIntention: string | null
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
    checkinOverdue = diffLocalCalendarDays(user.next_checkin_at) <= 0
  }

  let activeSessionId: string | null = null
  let activeSessionType: SessionType | null = null
  let todayClosed = false
  let yesterdayJournalSummary: string | null = null
  const todayCaptureCount = 0 // M1: captures not implemented yet
  const todayIntention: string | null = null // M1: day plans not implemented yet
  const yesterdayIntention: string | null = null // M1: day plans not implemented yet

  if (onboardingCompleted) {
    const ufs = new UserFileSystem(supabase, userId)

    const todayStr = new Date().toISOString().split('T')[0]
    // DST-safe yesterday: subtract 1 calendar day via Date methods
    const yesterdayDate = new Date()
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const yesterday = yesterdayDate.toISOString().split('T')[0]

    const [activeSessionResult, todayCloseDayResult, yesterdayJournalResult] = await Promise.allSettled([
      supabase
        .from('sessions')
        .select('id, session_type')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('session_type', 'close_day')
        .eq('status', 'completed')
        .gte('completed_at', `${todayStr}T00:00:00`)
        .limit(1)
        .maybeSingle(),
      ufs.readDailyLog(yesterday),
    ])

    // Extract active session from parallel result
    if (activeSessionResult.status === 'fulfilled') {
      const activeSession = activeSessionResult.value.data
      if (activeSession) {
        activeSessionId = activeSession.id
        activeSessionType = activeSession.session_type
      }
    }

    // Check if today's close_day session exists
    if (todayCloseDayResult.status === 'fulfilled') {
      todayClosed = !!todayCloseDayResult.value.data
    }

    // Extract yesterday's journal summary
    if (yesterdayJournalResult.status === 'fulfilled' && yesterdayJournalResult.value) {
      const lines = yesterdayJournalResult.value.content
        .split('\n')
        .filter((l: string) => l.trim() && !l.startsWith('#'))
      yesterdayJournalSummary = lines[0]?.trim() || null
    }
  }

  return {
    greeting: getTimeGreeting(),
    firstName,
    onboardingCompleted,
    nextCheckinDate,
    checkinOverdue,
    activeSessionId,
    activeSessionType,
    todayClosed,
    yesterdayJournalSummary,
    todayCaptureCount,
    todayIntention,
    yesterdayIntention,
  }
}
