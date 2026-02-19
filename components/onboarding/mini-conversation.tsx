'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SuggestionPills } from '@/components/chat/suggestion-pills'

// ─── Types ──────────────────────────────────────────────

export interface QuickReplySelection {
  exchange: number
  selectedOption: string
}

interface MiniConversationProps {
  intent: string
  onComplete: (quickReplies: QuickReplySelection[]) => void
  onBack: () => void
  initialReplies?: QuickReplySelection[]
}

interface ConversationExchange {
  sageMessage: string
  quickReplies: string[]
}

// ─── Conversation Scripts ───────────────────────────────

const EXCHANGE_1_SCRIPTS: Record<string, ConversationExchange> = {
  intentional: {
    sageMessage: "Nice — sounds like you're in a good place and want to make the most of it. Before we dive in, quick question: when you imagine having more clarity about your life, what does that actually look like?",
    quickReplies: [
      'Knowing my priorities',
      'Less pulled in every direction',
      'Not sure yet',
    ],
  },
  new_start: {
    sageMessage: "Starting something new is exciting — and a little overwhelming. Quick question: is this something you chose, or something that happened to you?",
    quickReplies: [
      'I chose this',
      'It happened to me',
      'A bit of both',
    ],
  },
  stuck: {
    sageMessage: "I hear you — that scattered feeling is really common, especially for people who have a lot going on. Quick question: is it more that you have too many things competing for attention, or that you're not sure what to focus on?",
    quickReplies: [
      'Too many things competing',
      'Not sure what matters',
      'A bit of both',
    ],
  },
  tough_time: {
    sageMessage: "I appreciate you sharing that. No pressure to get into specifics right now. Quick question: is there one area of life that's weighing on you most, or does it feel like everything at once?",
    quickReplies: [
      'One thing weighing on me',
      'Everything at once',
      'Hard to pin down',
    ],
  },
  exploring: {
    sageMessage: "Love that — no pressure, just curiosity. Quick question: what made you want to check this out?",
    quickReplies: [
      'Someone recommended it',
      'Saw it online',
      'I like the idea of a life map',
    ],
  },
}

const EXCHANGE_2: ConversationExchange = {
  sageMessage: "Got it. That's really helpful context.\n\nHere's what I'd like to do: I'm going to show you eight areas of life — things like career, relationships, health — and ask you to give each one a quick gut rating. Don't overthink it. This just helps me know where to focus when we actually talk.\n\nSound good?",
  quickReplies: [
    "Let's do it",
    'What do you mean by "gut rating"?',
  ],
}

const CLARIFICATION: ConversationExchange = {
  sageMessage: "Just a 1-to-5 feel for how each area is going. 1 means rough, 5 means thriving. Go with your first instinct — there are no wrong answers and you can always change them later.",
  quickReplies: [
    "Got it — let's go",
  ],
}

// ─── Typing Indicator ───────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center justify-center gap-1.5 py-8">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-text-secondary/40"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

// ─── Exchange Card ──────────────────────────────────────

function ExchangeCard({
  exchange,
  onSelect,
}: {
  exchange: ConversationExchange
  onSelect: (option: string) => void
}) {
  const pills = exchange.quickReplies.slice(0, 3).map((option) => ({
    label: option,
    value: option,
  }))

  return (
    <>
      <h2 className="text-lg font-medium text-text leading-snug mb-8 text-center">
        {exchange.sageMessage.split('\n\n').map((paragraph, i) => (
          <span key={i}>
            {i > 0 && <><br /><br /></>}
            {paragraph}
          </span>
        ))}
      </h2>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <SuggestionPills pills={pills} onSelect={onSelect} />
      </motion.div>
    </>
  )
}

// ─── Main Component ─────────────────────────────────────

type ConversationPhase =
  | 'typing_exchange1'
  | 'showing_exchange1'
  | 'typing_exchange2'
  | 'showing_exchange2'
  | 'typing_clarification'
  | 'showing_clarification'
  | 'complete'

const TYPING_DELAY_MS = 600

export function MiniConversation({
  intent,
  onComplete,
  onBack,
  initialReplies,
}: MiniConversationProps) {
  const prefersReducedMotion = useRef(false)

  // Check reduced motion preference
  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  const [phase, setPhase] = useState<ConversationPhase>(() => {
    if (!initialReplies || initialReplies.length === 0) return 'typing_exchange1'
    if (initialReplies.length === 1) return 'typing_exchange2'
    return 'complete'
  })
  const [replies, setReplies] = useState<QuickReplySelection[]>(initialReplies ?? [])

  const exchange1 = EXCHANGE_1_SCRIPTS[intent] ?? EXCHANGE_1_SCRIPTS.exploring

  // Handle typing delays
  useEffect(() => {
    if (phase === 'complete') return

    const isTypingPhase = phase.startsWith('typing_')
    if (!isTypingPhase) return

    const delay = prefersReducedMotion.current ? 0 : TYPING_DELAY_MS
    const timer = setTimeout(() => {
      if (phase === 'typing_exchange1') setPhase('showing_exchange1')
      else if (phase === 'typing_exchange2') setPhase('showing_exchange2')
      else if (phase === 'typing_clarification') setPhase('showing_clarification')
    }, delay)

    return () => clearTimeout(timer)
  }, [phase])

  function handleQuickReply(exchange: number, option: string) {
    const newReply: QuickReplySelection = { exchange, selectedOption: option }
    const updated = [...replies, newReply]
    setReplies(updated)

    if (exchange === 1) {
      setPhase('typing_exchange2')
    } else if (exchange === 2) {
      if (option === 'What do you mean by "gut rating"?') {
        setPhase('typing_clarification')
      } else {
        setTimeout(() => onComplete(updated), 400)
        setPhase('complete')
      }
    } else if (exchange === 3) {
      setTimeout(() => onComplete(updated), 400)
      setPhase('complete')
    }
  }

  // Determine what replies we have
  const exchange1Reply = replies.find((r) => r.exchange === 1)
  const exchange2Reply = replies.find((r) => r.exchange === 2)

  // Determine which exchange to show
  const showExchange1 = (phase === 'typing_exchange1' || phase === 'showing_exchange1') && !exchange1Reply
  const showExchange2 = exchange1Reply && (phase === 'typing_exchange2' || phase === 'showing_exchange2') && !exchange2Reply
  const showClarification =
    exchange2Reply &&
    exchange2Reply.selectedOption === 'What do you mean by "gut rating"?' &&
    (phase === 'typing_clarification' || phase === 'showing_clarification') &&
    !replies.find((r) => r.exchange === 3)

  return (
    <div className="flex flex-col min-h-[100dvh] relative z-10">
      {/* Back button */}
      <div className="flex items-center px-5 pt-5 pb-2">
        <motion.button
          type="button"
          onClick={onBack}
          className="p-2 text-text-secondary hover:text-text transition-colors"
          aria-label="Go back to intent selection"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          whileTap={{ scale: 0.9 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </motion.button>
      </div>

      {/* Card content area — one exchange at a time */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-6 overflow-y-auto"
        aria-live="polite"
        aria-label="Questions from Sage"
      >
        <AnimatePresence mode="wait">
          {showExchange1 && (
            <motion.div
              key="exchange1"
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.35 }}
              className="w-full max-w-sm"
            >
              {phase === 'typing_exchange1' ? (
                <TypingIndicator />
              ) : (
                <ExchangeCard
                  exchange={exchange1}

                  onSelect={(option) => handleQuickReply(1, option)}
                />
              )}
            </motion.div>
          )}

          {showExchange2 && (
            <motion.div
              key="exchange2"
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.35 }}
              className="w-full max-w-sm"
            >
              {phase === 'typing_exchange2' ? (
                <TypingIndicator />
              ) : (
                <ExchangeCard
                  exchange={EXCHANGE_2}

                  onSelect={(option) => handleQuickReply(2, option)}
                />
              )}
            </motion.div>
          )}

          {showClarification && (
            <motion.div
              key="clarification"
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.35 }}
              className="w-full max-w-sm"
            >
              {phase === 'typing_clarification' ? (
                <TypingIndicator />
              ) : (
                <ExchangeCard
                  exchange={CLARIFICATION}

                  onSelect={(option) => handleQuickReply(3, option)}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
