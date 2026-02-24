import type { SupabaseClient } from '@supabase/supabase-js'
import { UserFileSystem } from '@/lib/markdown/user-file-system'
import { diffLocalCalendarDays, getDisplayName, getTimeGreeting } from '@/lib/utils'
import { getLocalDateString, getYesterdayDateString, getLocalMidnight, getHourInTimezone, formatTimeInTimezone } from '@/lib/dates'
import { getCalendarEvents, hasCalendarIntegration as checkCalendarIntegration } from '@/lib/calendar/google-calendar'
import type { CalendarEvent } from '@/lib/calendar/types'
import type { SessionType, CompletedArc } from '@/types/chat'
import { expireStaleOpenDaySessions, expireStaleCloseDaySessions, expireStaleOpenConversations } from '@/lib/ai/context'

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
  hasCalendarIntegration: boolean
  checkinResponse: 'yes' | 'not-yet' | 'snooze' | null
}

export async function getHomeData(
  supabase: SupabaseClient,
  userId: string,
  timezone: string = 'UTC',
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
  let hasCalendar = false
  let checkinResponse: 'yes' | 'not-yet' | 'snooze' | null = null

  if (onboardingCompleted) {
    // Expire stale sessions so the home screen doesn't show yesterday's lingering sessions.
    // Pass the caller's authenticated Supabase client to avoid creating new clients.
    await Promise.all([
      expireStaleOpenDaySessions(userId, timezone, supabase),
      expireStaleCloseDaySessions(userId, timezone, supabase),
      expireStaleOpenConversations(userId, supabase),
    ])

    const ufs = new UserFileSystem(supabase, userId)

    const todayStr = getLocalDateString(timezone)
    const yesterday = getYesterdayDateString(timezone)

    const todayMidnight = getLocalMidnight(todayStr, timezone)

    const [
      activeSessionResult,
      todayCloseDayResult,
      todayOpenDayResult,
      conversationArcsResult,
      yesterdayJournalResult,
      todayDayPlanResult,
      yesterdayDayPlanResult,
      calendarResult,
      captureFilenamesResult,
      calendarIntegrationResult,
    ] = await Promise.allSettled([
      supabase
        .from('sessions')
        .select('id, session_type, messages!inner(id)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .eq('messages.role', 'user')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('session_type', 'close_day')
        .eq('status', 'completed')
        .gte('completed_at', todayMidnight)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('session_type', 'open_day')
        .eq('status', 'completed')
        .gte('completed_at', todayMidnight)
        .limit(1)
        .maybeSingle(),
      // Also check for completed arcs within open_conversation sessions today
      supabase
        .from('sessions')
        .select('id, metadata')
        .eq('user_id', userId)
        .eq('session_type', 'open_conversation')
        .gte('updated_at', todayMidnight)
        .not('metadata', 'is', null)
        .limit(10),
      ufs.readDailyLog(yesterday),
      ufs.readDayPlan(todayStr),
      ufs.readDayPlan(yesterday),
      getCalendarEvents(userId, todayStr, timezone),
      ufs.listCaptures(todayStr),
      checkCalendarIntegration(userId),
    ])

    // Extract active session from parallel result
    if (activeSessionResult.status === 'fulfilled') {
      const activeSession = activeSessionResult.value.data
      if (activeSession) {
        activeSessionId = activeSession.id
        activeSessionType = activeSession.session_type
      }
    }

    // Helper: check if any open_conversation session has a completed arc of a given mode
    const hasCompletedArc = (mode: string): boolean => {
      if (conversationArcsResult.status !== 'fulfilled') return false
      const sessions = conversationArcsResult.value.data ?? []
      return sessions.some((s) => {
        const meta = s.metadata as Record<string, unknown> | null
        const arcs: CompletedArc[] = Array.isArray(meta?.completed_arcs) ? meta.completed_arcs as CompletedArc[] : []
        return arcs.some((arc) => arc.mode === mode)
      })
    }

    // Check if today's close_day session exists (direct or via open_conversation arc)
    if (todayCloseDayResult.status === 'fulfilled') {
      todayClosed = !!todayCloseDayResult.value.data || hasCompletedArc('close_day')
    }

    // Check if today's open_day session completed (direct or via open_conversation arc)
    if (todayOpenDayResult.status === 'fulfilled') {
      openDayCompleted = !!todayOpenDayResult.value.data || hasCompletedArc('open_day')
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
      const rawCheckin = todayDayPlanResult.value.frontmatter.checkin_response
      checkinResponse = rawCheckin === 'yes' || rawCheckin === 'not-yet' || rawCheckin === 'snooze' ? rawCheckin : null
    }

    // Extract yesterday's intention for carry-forward
    if (yesterdayDayPlanResult.status === 'fulfilled' && yesterdayDayPlanResult.value) {
      yesterdayIntention = yesterdayDayPlanResult.value.frontmatter.intention ?? null
    }

    // Check calendar integration status
    if (calendarIntegrationResult.status === 'fulfilled') {
      hasCalendar = calendarIntegrationResult.value
    }

    // Extract calendar events
    if (calendarResult.status === 'fulfilled') {
      calendarEvents = calendarResult.value
      if (calendarEvents.length > 0) {
        const firstEvent = calendarEvents[0]
        const firstTime = firstEvent.allDay
          ? 'all day'
          : formatTimeInTimezone(firstEvent.startTime, timezone)
        const afternoon = calendarEvents.filter((e) => {
          const h = getHourInTimezone(e.startTime, timezone)
          return h >= 12
        })
        calendarSummary = `${calendarEvents.length} meeting${calendarEvents.length === 1 ? '' : 's'} today · First at ${firstTime}${afternoon.length === 0 ? ' · Afternoon clear' : ''}`
      }
    }

    // Extract today's captures (text content for BreadcrumbsCard)
    if (captureFilenamesResult.status === 'fulfilled' && captureFilenamesResult.value.length > 0) {
      const captureFilenames = captureFilenamesResult.value
      todayCaptureCount = captureFilenames.length
      // Only read first 5 for display — count reflects total
      const captureResults = await Promise.allSettled(
        captureFilenames.slice(0, 5).map((filename) => ufs.readCapture(filename))
      )
      todayCaptures = captureResults
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof ufs.readCapture>>> =>
          r.status === 'fulfilled' && r.value !== null
        )
        .map((r) => r.value!.content)
    }
  }

  return {
    greeting: getTimeGreeting(timezone),
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
    hasCalendarIntegration: hasCalendar,
    checkinResponse,
  }
}
