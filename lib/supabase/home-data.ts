import type { SupabaseClient } from '@supabase/supabase-js'
import { UserFileSystem } from '@/lib/markdown/user-file-system'
import { diffLocalCalendarDays, getDisplayName, getTimeGreeting } from '@/lib/utils'
import { getCalendarEvents } from '@/lib/calendar/google-calendar'
import type { CalendarEvent } from '@/lib/calendar/types'
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
  openDayCompleted: boolean
  yesterdayJournalSummary: string | null
  todayCaptureCount: number
  todayCaptures: string[]
  todayIntention: string | null
  yesterdayIntention: string | null
  calendarEvents: CalendarEvent[]
  calendarSummary: string | null
  checkinResponse: string | null
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
  let openDayCompleted = false
  let yesterdayJournalSummary: string | null = null
  let todayCaptureCount = 0
  let todayCaptures: string[] = []
  let todayIntention: string | null = null
  let yesterdayIntention: string | null = null
  let calendarEvents: CalendarEvent[] = []
  let calendarSummary: string | null = null
  let checkinResponse: string | null = null

  if (onboardingCompleted) {
    const ufs = new UserFileSystem(supabase, userId)

    const todayStr = new Date().toISOString().split('T')[0]
    // DST-safe yesterday: subtract 1 calendar day via Date methods
    const yesterdayDate = new Date()
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const yesterday = yesterdayDate.toISOString().split('T')[0]

    const [
      activeSessionResult,
      todayCloseDayResult,
      todayOpenDayResult,
      yesterdayJournalResult,
      todayDayPlanResult,
      yesterdayDayPlanResult,
      calendarResult,
      captureFilenamesResult,
    ] = await Promise.allSettled([
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
      supabase
        .from('sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('session_type', 'open_day')
        .eq('status', 'completed')
        .gte('completed_at', `${todayStr}T00:00:00`)
        .limit(1)
        .maybeSingle(),
      ufs.readDailyLog(yesterday),
      ufs.readDayPlan(todayStr),
      ufs.readDayPlan(yesterday),
      getCalendarEvents(userId, todayStr),
      ufs.listCaptures(todayStr, 5),
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

    // Check if today's open_day session completed
    if (todayOpenDayResult.status === 'fulfilled') {
      openDayCompleted = !!todayOpenDayResult.value.data
    }

    // Extract yesterday's journal summary
    if (yesterdayJournalResult.status === 'fulfilled' && yesterdayJournalResult.value) {
      const lines = yesterdayJournalResult.value.content
        .split('\n')
        .filter((l: string) => l.trim() && !l.startsWith('#'))
      yesterdayJournalSummary = lines[0]?.trim() || null
    }

    // Extract today's intention and checkin response from day plan
    if (todayDayPlanResult.status === 'fulfilled' && todayDayPlanResult.value) {
      todayIntention = todayDayPlanResult.value.frontmatter.intention ?? null
      checkinResponse = todayDayPlanResult.value.frontmatter.checkin_response ?? null
    }

    // Extract yesterday's intention for carry-forward
    if (yesterdayDayPlanResult.status === 'fulfilled' && yesterdayDayPlanResult.value) {
      yesterdayIntention = yesterdayDayPlanResult.value.frontmatter.intention ?? null
    }

    // Extract calendar events
    if (calendarResult.status === 'fulfilled') {
      calendarEvents = calendarResult.value
      if (calendarEvents.length > 0) {
        const firstEvent = calendarEvents[0]
        const firstTime = firstEvent.allDay
          ? 'all day'
          : new Date(firstEvent.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        const afternoon = calendarEvents.filter((e) => {
          const h = new Date(e.startTime).getHours()
          return h >= 12
        })
        calendarSummary = `${calendarEvents.length} meeting${calendarEvents.length === 1 ? '' : 's'} today · First at ${firstTime}${afternoon.length === 0 ? ' · Afternoon clear' : ''}`
      }
    }

    // Extract today's captures (text content for BreadcrumbsCard)
    if (captureFilenamesResult.status === 'fulfilled' && captureFilenamesResult.value.length > 0) {
      const captureFilenames = captureFilenamesResult.value
      todayCaptureCount = captureFilenames.length
      const captureResults = await Promise.allSettled(
        captureFilenames.map((filename) => ufs.readCapture(filename))
      )
      todayCaptures = captureResults
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof ufs.readCapture>>> =>
          r.status === 'fulfilled' && r.value !== null
        )
        .map((r) => r.value!.content)
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
    openDayCompleted,
    yesterdayJournalSummary,
    todayCaptureCount,
    todayCaptures,
    todayIntention,
    yesterdayIntention,
    calendarEvents,
    calendarSummary,
    checkinResponse,
  }
}
