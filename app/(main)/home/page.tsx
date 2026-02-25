import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getHomeData } from '@/lib/supabase/home-data'
import { getUserTimezone } from '@/lib/get-user-timezone'
import { PreOnboardingHero } from '@/components/home/pre-onboarding-hero'
import { HomeScreen } from '@/components/home/home-screen'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const tz = await getUserTimezone(supabase, user.id)
  const homeData = await getHomeData(supabase, user.id, tz)

  const displayName = homeData.firstName
    ? homeData.firstName.charAt(0).toUpperCase() + homeData.firstName.slice(1)
    : null

  if (!homeData.onboardingCompleted) {
    return (
      <div className="px-md pt-2xl max-w-lg mx-auto">
        <PreOnboardingHero
          greeting={homeData.greeting}
          displayName={displayName}
        />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <HomeScreen
        data={{
          displayName,
          onboardingCompleted: homeData.onboardingCompleted,
          checkinOverdue: homeData.checkinOverdue,
          nextCheckinDate: homeData.nextCheckinDate,
          todayClosed: homeData.todayClosed,
          openDayCompleted: homeData.openDayCompleted,
          yesterdayJournalSummary: homeData.yesterdayJournalSummary,
          todayCaptureCount: homeData.todayCaptureCount,
          todayCaptures: homeData.todayCaptures,
          todayIntention: homeData.todayIntention,
          yesterdayIntention: homeData.yesterdayIntention,
          calendarEvents: homeData.calendarEvents,
          calendarSummary: homeData.calendarSummary,
          hasCalendarIntegration: homeData.hasCalendarIntegration,
          activeSessionId: homeData.activeSessionId,
          activeSessionType: homeData.activeSessionType,
          checkinResponse: homeData.checkinResponse,
          unmappedDomains: homeData.unmappedDomains,
        }}
      />
    </div>
  )
}
