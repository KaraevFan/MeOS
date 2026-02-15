'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { savePulseCheckRatings, pulseRatingToDomainStatus } from '@/lib/supabase/pulse-check'
import { getOrCreateLifeMap, upsertDomain } from '@/lib/supabase/life-map'
import { PULSE_DOMAINS } from '@/types/pulse-check'
import type { PulseCheckRating, PulseRating } from '@/types/pulse-check'
import type { DomainName } from '@/types/chat'
import { SageIntro } from './sage-intro'
import { IntentSelection } from './intent-selection'
import { DomainCard } from './domain-card'
import { SummaryScreen } from './summary-screen'

type Step = 'intro' | 'intent' | 'domains' | 'summary'

const RATING_VALUES: PulseRating[] = ['in_crisis', 'struggling', 'okay', 'good', 'thriving']
const RATING_NUMERIC: number[] = [1, 2, 3, 4, 5]

const DOMAIN_LABELS = PULSE_DOMAINS.map((d) => d.label)

const pageVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 280 : -280,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -280 : 280,
    opacity: 0,
  }),
}

const pageTransition = {
  duration: 0.4,
  ease: [0.25, 0.46, 0.45, 0.94] as const,
}

export function OnboardingFlow() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<Step>('intro')
  const [domainIndex, setDomainIndex] = useState(0)
  const [ratings, setRatings] = useState<Record<number, number>>({})
  const [intent, setIntent] = useState<string | null>(null)
  const [showSageMessage, setShowSageMessage] = useState(true)
  const [direction, setDirection] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const goForward = useCallback((nextStep: Step) => {
    setDirection(1)
    setStep(nextStep)
  }, [])

  const goBack = useCallback((prevStep: Step) => {
    setDirection(-1)
    setStep(prevStep)
  }, [])

  function handleIntroComplete() {
    goForward('intent')
  }

  function handleIntentSelect(value: string) {
    setIntent(value)
    goForward('domains')
  }

  function handleDomainRate(value: number) {
    setRatings((prev) => ({ ...prev, [domainIndex]: value }))

    // Hide sage message after first rating
    if (showSageMessage) setShowSageMessage(false)

    // Auto-advance after 400ms
    setTimeout(() => {
      if (domainIndex < PULSE_DOMAINS.length - 1) {
        setDirection(1)
        setDomainIndex((prev) => prev + 1)
      } else {
        goForward('summary')
      }
    }, 400)
  }

  function handleDomainBack() {
    if (domainIndex > 0) {
      setDirection(-1)
      setDomainIndex((prev) => prev - 1)
    } else {
      goBack('intent')
    }
  }

  function handleEditRatings() {
    setDomainIndex(0)
    goBack('domains')
  }

  async function handleStartConversation() {
    if (isSubmitting) return
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Create a new life_mapping session
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          user_id: user.id,
          session_type: 'life_mapping',
          status: 'active',
        })
        .select()
        .single()

      if (sessionError || !session) throw sessionError || new Error('Failed to create session')

      // Build pulse check ratings
      const pulseRatings: PulseCheckRating[] = PULSE_DOMAINS.map((d, i) => ({
        domain: d.label,
        domainKey: d.key,
        rating: RATING_VALUES[ratings[i] ?? 2],
        ratingNumeric: RATING_NUMERIC[ratings[i] ?? 2],
      }))

      // Save pulse check ratings
      await savePulseCheckRatings(supabase, session.id, user.id, pulseRatings, true)

      // Seed life_map_domains with initial status (parallel writes)
      const lifeMap = await getOrCreateLifeMap(supabase, user.id)
      await Promise.allSettled(
        pulseRatings.map((rating) =>
          upsertDomain(supabase, lifeMap.id, {
            domain: rating.domain as DomainName,
            currentState: '',
            whatsWorking: [],
            whatsNotWorking: [],
            keyTension: '',
            statedIntention: '',
            status: pulseRatingToDomainStatus(rating.rating),
          })
        )
      )

      // Mark onboarding complete
      await supabase
        .from('users')
        .update({ onboarding_completed: true })
        .eq('id', user.id)

      // Store intent in session metadata (accessible to chat API)
      if (intent) {
        await supabase
          .from('sessions')
          .update({ metadata: { onboarding_intent: intent } })
          .eq('id', session.id)
      }

      // Redirect to chat
      router.push('/chat')
    } catch (err) {
      console.error('Onboarding completion failed:', err)
      setSubmitError('Something went wrong. Please try again.')
      setIsSubmitting(false)
    }
  }

  // Unique key for AnimatePresence — includes domainIndex for domain steps
  const stepKey = step === 'domains' ? `domains-${domainIndex}` : step

  return (
    <div className="min-h-screen min-h-[100dvh] bg-bg flex flex-col items-center overflow-hidden">
      <div className="w-full max-w-[430px] relative">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={stepKey}
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={pageTransition}
            className="w-full"
          >
            {step === 'intro' && (
              <SageIntro onContinue={handleIntroComplete} />
            )}

            {step === 'intent' && (
              <IntentSelection onSelect={handleIntentSelect} />
            )}

            {step === 'domains' && (
              <DomainCard
                domain={DOMAIN_LABELS[domainIndex]}
                rating={ratings[domainIndex] ?? null}
                onRate={handleDomainRate}
                isFirst={domainIndex === 0}
                showSageMessage={showSageMessage}
                currentIndex={domainIndex}
                totalDomains={PULSE_DOMAINS.length}
                onBack={handleDomainBack}
              />
            )}

            {step === 'summary' && (
              <SummaryScreen
                domains={DOMAIN_LABELS}
                ratings={ratings}
                onStart={handleStartConversation}
                onEditRatings={handleEditRatings}
                isSubmitting={isSubmitting}
                submitError={submitError}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
