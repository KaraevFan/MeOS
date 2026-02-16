'use client'

import { useRouter } from 'next/navigation'
import { BreathingOrb } from '@/components/ui/breathing-orb'

interface PreOnboardingHeroProps {
  greeting: string
  displayName: string | null
}

export function PreOnboardingHero({ greeting, displayName }: PreOnboardingHeroProps) {
  const router = useRouter()
  const navigate = () => router.push('/onboarding')

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <p className="text-text-secondary text-lg mb-lg">
        {greeting}{displayName ? `, ${displayName}` : ''}
      </p>
      <BreathingOrb onTap={navigate} />
      <p className="mt-md text-text-secondary/60 text-sm">
        Tap to begin
      </p>
    </div>
  )
}

export function TalkToSageOrb() {
  const router = useRouter()

  return (
    <div className="flex flex-col items-center py-md">
      <BreathingOrb onTap={() => router.push('/chat?type=ad_hoc')} />
      <p className="mt-sm text-text-secondary/60 text-sm">
        Talk to Sage
      </p>
    </div>
  )
}
