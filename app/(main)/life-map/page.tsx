import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentLifeMap } from '@/lib/supabase/life-map'
import { getBaselineRatings } from '@/lib/supabase/pulse-check'
import { SynthesisSection } from '@/components/life-map/synthesis-section'
import { DomainGrid } from '@/components/life-map/domain-grid'

export default async function LifeMapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [lifeMap, baselineRatings] = await Promise.all([
    getCurrentLifeMap(supabase, user.id),
    getBaselineRatings(supabase, user.id),
  ])

  if (!lifeMap || lifeMap.domains.length === 0) {
    return (
      <div className="px-md pt-2xl max-w-lg mx-auto">
        <h1 className="text-xl font-bold tracking-tight mb-2">Your Life Map</h1>
        <p className="text-text-secondary mb-xl">
          Your life map will appear here after your first conversation with Sage.
        </p>
        <Link
          href="/chat"
          className="inline-flex items-center justify-center h-12 px-6 bg-primary text-white rounded-md font-medium
                     hover:bg-primary-hover transition-colors"
        >
          Talk to Sage
        </Link>
      </div>
    )
  }

  return (
    <div className="px-md pt-lg pb-lg max-w-lg mx-auto space-y-lg">
      <h1 className="text-xl font-bold tracking-tight">Your Life Map</h1>

      <SynthesisSection lifeMap={lifeMap} />

      <DomainGrid domains={lifeMap.domains} baselineRatings={baselineRatings} />

      <p className="text-[11px] text-text-secondary text-center">
        Last updated {new Date(lifeMap.updated_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </p>
    </div>
  )
}
