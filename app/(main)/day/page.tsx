import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDayPlanWithCaptures } from '@/lib/supabase/day-plan-queries'
import { DayPlanSwipeContainer } from '@/components/day-plan/day-plan-swipe-container'
import { getUserTimezone } from '@/lib/get-user-timezone'
import { getLocalDateString } from '@/lib/dates'
import { getCalendarEvents, hasCalendarIntegration } from '@/lib/calendar/google-calendar'

export default async function DayPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const tz = await getUserTimezone(supabase, user.id)
  const today = getLocalDateString(tz)

  const [data, hasCalendar, calendarEvents] = await Promise.all([
    getDayPlanWithCaptures(supabase, user.id, today, tz),
    hasCalendarIntegration(user.id),
    getCalendarEvents(user.id, today, tz).catch((error) => {
      console.error('[day] Calendar fetch failed:', error)
      return [] as Awaited<ReturnType<typeof getCalendarEvents>>
    }),
  ])

  return (
    <DayPlanSwipeContainer
      initialDate={today}
      today={today}
      initialData={data}
      calendarEvents={calendarEvents}
      hasCalendarIntegration={hasCalendar}
    />
  )
}
