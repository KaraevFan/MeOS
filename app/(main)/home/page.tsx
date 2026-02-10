import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getHomeData } from '@/lib/supabase/home-data'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const homeData = await getHomeData(supabase, user.id)

  const displayName = homeData.firstName
    ? homeData.firstName.charAt(0).toUpperCase() + homeData.firstName.slice(1)
    : null

  return (
    <div className="px-md pt-2xl max-w-lg mx-auto">
      {/* Greeting */}
      <h1 className="text-2xl font-bold tracking-tight mb-1">
        {homeData.greeting}{displayName ? `, ${displayName}` : ''}
      </h1>

      {!homeData.onboardingCompleted ? (
        /* Pre-onboarding state */
        <div className="mt-lg">
          <p className="text-text-secondary text-lg mb-xl">
            Ready to map your life? Let&apos;s talk.
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center justify-center h-12 px-8 bg-primary text-white rounded-md font-medium
                       hover:bg-primary-hover transition-colors shadow-sm"
          >
            Map your life
          </Link>
        </div>
      ) : (
        /* Post-onboarding state */
        <div className="mt-lg space-y-lg">
          {/* Check-in card */}
          {homeData.nextCheckinDate && (
            <div className="bg-bg-card rounded-lg shadow-sm p-4 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                    Next check-in
                  </p>
                  <p className="text-sm text-text font-medium">
                    {homeData.checkinOverdue
                      ? 'Due now'
                      : formatCheckinDate(homeData.nextCheckinDate)}
                  </p>
                </div>
                <Link
                  href="/chat?type=weekly_checkin"
                  className="inline-flex items-center justify-center h-10 px-4 bg-primary text-white rounded-md text-sm font-medium
                             hover:bg-primary-hover transition-colors"
                >
                  {homeData.checkinOverdue ? 'Check in now' : 'Start early'}
                </Link>
              </div>
            </div>
          )}

          {/* Priorities */}
          {homeData.quarterlyPriorities.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
                Current priorities
              </p>
              <ul className="space-y-2">
                {homeData.quarterlyPriorities.map((priority, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text">
                    <span className="text-primary font-bold mt-px">{i + 1}.</span>
                    <span>{priority}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Quick start */}
          <Link
            href="/chat"
            className="inline-flex items-center justify-center h-12 px-6 bg-bg-card border border-border rounded-md font-medium text-text
                       hover:bg-bg-sage transition-colors w-full"
          >
            Talk to Sage
          </Link>
        </div>
      )}
    </div>
  )
}

function formatCheckinDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return 'Due now'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays <= 7) return `In ${diffDays} days`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
