'use client'

import { useState, useCallback, useEffect } from 'react'
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
import { MiniConversation } from './mini-conversation'
import type { QuickReplySelection } from './mini-conversation'
import { DomainCard } from './domain-card'
import { SummaryScreen } from './summary-screen'

type Step = 'intro' | 'intent' | 'conversation' | 'domains' | 'summary'

const RATING_VALUES: PulseRating[] = ['in_crisis', 'struggling', 'okay', 'good', 'thriving']
const RATING_NUMERIC: number[] = [1, 2, 3, 4, 5]

const DOMAIN_LABELS = PULSE_DOMAINS.map((d) => d.label)

const STORAGE_KEY = 'meos_onboarding_state'

interface OnboardingState {
  step: Step
  domainIndex: number
  ratings: Record<number, number>
  intent: string | null
  name: string
  quickReplies: QuickReplySelection[]
}

function loadSavedState(): OnboardingState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as OnboardingState
  } catch {
    return null
  }
}

function saveState(state: OnboardingState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // sessionStorage unavailable (e.g., private browsing) — fail silently
  }
}

function clearSavedState() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // noop
  }
}

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

  // Restore from sessionStorage if available
  const [initialized, setInitialized] = useState(false)
  const [step, setStep] = useState<Step>('intro')
  const [domainIndex, setDomainIndex] = useState(0)
  const [ratings, setRatings] = useState<Record<number, number>>({})
  const [intent, setIntent] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [quickReplies, setQuickReplies] = useState<QuickReplySelection[]>([])
  const [showSageMessage, setShowSageMessage] = useState(true)
  const [direction, setDirection] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [oauthName, setOauthName] = useState<string | undefined>(undefined)

  // Restore state from sessionStorage on mount
  useEffect(() => {
    const saved = loadSavedState()
    if (saved) {
      setStep(saved.step)
      setDomainIndex(saved.domainIndex)
      setRatings(saved.ratings)
      setIntent(saved.intent)
      setName(saved.name)
      setQuickReplies(saved.quickReplies)
      if (Object.keys(saved.ratings).length > 0) setShowSageMessage(false)
    }

    // Check for OAuth display name to pre-fill
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata) {
        const meta = user.user_metadata
        const oName = (meta.full_name as string) || (meta.name as string) || undefined
        if (oName) setOauthName(oName)
        // If no name set yet, pre-fill from OAuth
        if (!saved?.name && oName) setName(oName)
      }
    })

    setInitialized(true)
  }, [supabase.auth])

  // Persist state on every change (after initialization)
  useEffect(() => {
    if (!initialized) return
    saveState({ step, domainIndex, ratings, intent, name, quickReplies })
  }, [initialized, step, domainIndex, ratings, intent, name, quickReplies])

  const goForward = useCallback((nextStep: Step) => {
    setDirection(1)
    setStep(nextStep)
  }, [])

  const goBack = useCallback((prevStep: Step) => {
    setDirection(-1)
    setStep(prevStep)
  }, [])

  function handleIntroComplete(userName: string) {
    setName(userName)

    // Save display name to DB (non-blocking)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from('users')
          .update({ display_name: userName })
          .eq('id', user.id)
          .then(({ error }) => {
            if (error) console.error('Failed to save display name:', error)
          })
      }
    })

    goForward('intent')
  }

  function handleIntentSelect(value: string) {
    setIntent(value)
    goForward('conversation')
  }

  function handleConversationComplete(replies: QuickReplySelection[]) {
    setQuickReplies(replies)
    goForward('domains')
  }

  function handleConversationBack() {
    goBack('intent')
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
      goBack('conversation')
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

      // Check for existing active session to prevent duplicates on retry
      const { data: existingSession } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .eq('session_type', 'life_mapping')
        .maybeSingle()

      let sessionId: string

      if (existingSession) {
        sessionId = existingSession.id
      } else {
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
        sessionId = session.id
      }

      // Build pulse check ratings
      const pulseRatings: PulseCheckRating[] = PULSE_DOMAINS.map((d, i) => ({
        domain: d.label,
        domainKey: d.key,
        rating: RATING_VALUES[ratings[i] ?? 2],
        ratingNumeric: RATING_NUMERIC[ratings[i] ?? 2],
      }))

      // Save pulse check ratings (critical — abort on failure)
      await savePulseCheckRatings(supabase, sessionId, user.id, pulseRatings, true)

      // Seed life_map_domains with initial status (non-critical — log errors but continue)
      try {
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
      } catch (err) {
        console.error('Failed to seed life map domains (non-critical):', err)
      }

      // Store onboarding context in session metadata (non-critical)
      try {
        await supabase
          .from('sessions')
          .update({
            metadata: {
              onboarding_intent: intent,
              onboarding_name: name,
              onboarding_quick_replies: quickReplies,
            },
          })
          .eq('id', sessionId)
      } catch (err) {
        console.error('Failed to store session metadata (non-critical):', err)
      }

      // Ensure display name is saved (retry if Screen 1 save failed)
      try {
        await supabase
          .from('users')
          .update({ display_name: name })
          .eq('id', user.id)
      } catch {
        // Already attempted on Screen 1 — best effort
      }

      // Mark onboarding complete (only after critical data saved)
      await supabase
        .from('users')
        .update({ onboarding_completed: true })
        .eq('id', user.id)

      // Clear saved state
      clearSavedState()

      // Redirect to chat
      router.push('/chat')
    } catch (err) {
      console.error('Onboarding completion failed:', err)
      setSubmitError('Something went wrong. Please try again.')
      setIsSubmitting(false)
    }
  }

  // Don't render until we've checked sessionStorage
  if (!initialized) return null

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
              <SageIntro
                onContinue={handleIntroComplete}
                initialName={name || oauthName}
              />
            )}

            {step === 'intent' && (
              <IntentSelection
                onSelect={handleIntentSelect}
                initialIntent={intent}
              />
            )}

            {step === 'conversation' && intent && (
              <MiniConversation
                intent={intent}
                userName={name}
                onComplete={handleConversationComplete}
                onBack={handleConversationBack}
                initialReplies={quickReplies.length > 0 ? quickReplies : undefined}
              />
            )}

            {step === 'domains' && (
              <DomainCard
                domain={DOMAIN_LABELS[domainIndex]}
                descriptor={PULSE_DOMAINS[domainIndex].descriptor}
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
