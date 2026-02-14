'use client'

import { useRouter } from 'next/navigation'
import { BreathingOrb } from '@/components/ui/breathing-orb'

interface PreOnboardingHeroProps {
  greeting: string
  displayName: string | null
}

export function PreOnboardingHero({ greeting, displayName }: PreOnboardingHeroProps) {
  const router = useRouter()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <p className="text-text-secondary text-lg mb-lg">
        {greeting}{displayName ? `, ${displayName}` : ''}
      </p>
      <BreathingOrb
        variant="interactive"
        onTap={() => router.push('/chat')}
      />
      <p className="mt-md text-text-secondary/60 text-sm">
        Tap to begin
      </p>
    </div>
  )
}
