import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getHomeData } from '@/lib/supabase/home-data'
import { NorthStarCard } from '@/components/ui/north-star-card'
import { CommitmentCard } from '@/components/home/commitment-card'
import { PreOnboardingHero, TalkToSageOrb } from '@/components/home/pre-onboarding-hero'

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

  const activeCommitments = homeData.commitments.filter((c) => c.status !== 'complete')
  const hasCommitments = activeCommitments.length > 0

  return (
    <div className="px-md pt-2xl pb-lg max-w-lg mx-auto">
      {/* 1. Greeting */}
      <h1 className="text-2xl font-bold tracking-tight mb-1">
        {homeData.greeting}{displayName ? `, ${displayName}` : ''}
      </h1>

      {/* 2. Sage contextual line */}
      {homeData.sageLine && (
        <div className="mt-lg flex items-start gap-2.5">
          <div className="w-6 h-6 rounded-full bg-accent-sage/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-sage">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.85 0 3.58-.5 5.07-1.38" />
              <path d="M17 8c-1.5 0-3 .5-3 2s1.5 2 3 2 3 .5 3 2-1.5 2-3 2" />
            </svg>
          </div>
          <p className="text-sm text-text-secondary italic leading-relaxed">
            {homeData.sageLine}
          </p>
        </div>
      )}

      <div className="mt-lg space-y-lg">
        {/* 3. North star card */}
        {homeData.northStarFull && (
          <NorthStarCard northStarFull={homeData.northStarFull} northStarLabel={homeData.northStar ?? undefined} />
        )}

        {/* 4. Active commitments (or priorities fallback) */}
        {hasCommitments ? (
          <div>
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
              Active commitments
            </p>
            <div className="space-y-sm">
              {activeCommitments.slice(0, 2).map((commitment, i) => (
                <CommitmentCard key={i} commitment={commitment} />
              ))}
            </div>
          </div>
        ) : homeData.quarterlyPriorities.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
              This quarter&apos;s focus
            </p>
            <ul className="space-y-2">
              {homeData.quarterlyPriorities.map((priority, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text">
                  <span className="text-primary font-bold mt-px">{i + 1}.</span>
                  <span>{stripLeadingNumber(priority)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* 5. Check-in prompt */}
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

        {/* 6. Boundaries — only when data exists */}
        {homeData.boundaries.length > 0 && (
          <div className="opacity-75">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
              Boundaries
            </p>
            <ul className="text-sm text-text-secondary space-y-1">
              {homeData.boundaries.map((boundary, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="mt-0.5">&times;</span>
                  <span>{boundary}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 7. Talk to Sage */}
        <TalkToSageOrb />
      </div>
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

/** Strip leading "1) ", "2. " etc from priority text (P2-1 fix) */
function stripLeadingNumber(text: string): string {
  return text.replace(/^\d+[\)\.]\s*/, '')
}
