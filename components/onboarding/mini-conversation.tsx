'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

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
      'Knowing my priorities and sticking to them',
      'Feeling less pulled in every direction',
      'Having a plan I actually follow',
      "Honestly, I'm not sure yet",
    ],
  },
  new_start: {
    sageMessage: "Starting something new is exciting — and a little overwhelming. Quick question: is this something you chose, or something that happened to you?",
    quickReplies: [
      "I chose this — ready for what's next",
      "It happened to me — still figuring it out",
      'A bit of both honestly',
      "I'd rather not say",
    ],
  },
  stuck: {
    sageMessage: "I hear you — that scattered feeling is really common, especially for people who have a lot going on. Quick question: is it more that you have too many things competing for attention, or that you're not sure what to focus on?",
    quickReplies: [
      'Too many things, not enough focus',
      "Not sure what actually matters to me",
      'A bit of both',
      "It's something else entirely",
    ],
  },
  tough_time: {
    sageMessage: "I appreciate you sharing that. No pressure to get into specifics right now. Quick question: is there one area of life that's weighing on you most, or does it feel like everything at once?",
    quickReplies: [
      'One thing is really weighing on me',
      'It feels like everything at once',
      "I'm not sure — it's hard to pin down",
      "I'd rather just get started",
    ],
  },
  exploring: {
    sageMessage: "Love that — no pressure, just curiosity. Quick question: what made you want to check this out?",
    quickReplies: [
      'Someone recommended it',
      'Saw it online and was curious',
      'I like the idea of a life map',
      'Honestly, just killing time',
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
    <div className="flex items-center gap-1 px-4 py-3">
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

// ─── Message Components ─────────────────────────────────

function SageMessage({ text }: { text: string }) {
  return (
    <motion.div
      className="max-w-[85%] self-start"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="bg-bg-sage rounded-2xl rounded-bl-md px-4 py-3">
        {text.split('\n\n').map((paragraph, i) => (
          <p key={i} className={cn('text-[15px] text-text leading-relaxed', i > 0 && 'mt-3')}>
            {paragraph}
          </p>
        ))}
      </div>
    </motion.div>
  )
}

function UserMessage({ text }: { text: string }) {
  return (
    <motion.div
      className="max-w-[80%] self-end"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="bg-primary text-white rounded-2xl rounded-br-md px-4 py-3">
        <p className="text-[15px] leading-relaxed">{text}</p>
      </div>
    </motion.div>
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
  const scrollRef = useRef<HTMLDivElement>(null)

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

  // Auto-scroll to bottom when content changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [phase, replies])

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
      // After Exchange 1, show Exchange 2
      setPhase('typing_exchange2')
    } else if (exchange === 2) {
      if (option === 'What do you mean by "gut rating"?') {
        setPhase('typing_clarification')
      } else {
        // "Let's do it" — complete
        setTimeout(() => onComplete(updated), 400)
        setPhase('complete')
      }
    } else if (exchange === 3) {
      // After clarification — complete
      setTimeout(() => onComplete(updated), 400)
      setPhase('complete')
    }
  }

  // Determine what replies we have
  const exchange1Reply = replies.find((r) => r.exchange === 1)
  const exchange2Reply = replies.find((r) => r.exchange === 2)
  const clarificationReply = replies.find((r) => r.exchange === 3)

  // Determine which quick replies to show
  const showExchange1Replies = phase === 'showing_exchange1' && !exchange1Reply
  const showExchange2Replies = phase === 'showing_exchange2' && !exchange2Reply
  const showClarificationReplies = phase === 'showing_clarification' && !clarificationReply

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

      {/* Chat area */}
      <div
        ref={scrollRef}
        className="flex-1 flex flex-col gap-3 px-5 pb-6 overflow-y-auto"
        aria-live="polite"
        aria-label="Conversation with Sage"
      >
        {/* Exchange 1: Sage message */}
        {(phase !== 'typing_exchange1') && (
          <SageMessage text={exchange1.sageMessage} />
        )}
        {phase === 'typing_exchange1' && <TypingIndicator />}

        {/* Exchange 1: User reply (if selected) */}
        {exchange1Reply && (
          <UserMessage text={exchange1Reply.selectedOption} />
        )}

        {/* Exchange 2: Sage message */}
        {phase === 'typing_exchange2' && <TypingIndicator />}
        {exchange1Reply && phase !== 'typing_exchange2' && (phase === 'showing_exchange2' || exchange2Reply || phase === 'typing_clarification' || phase === 'showing_clarification' || phase === 'complete') && (
          <SageMessage text={EXCHANGE_2.sageMessage} />
        )}

        {/* Exchange 2: User reply (if selected) */}
        {exchange2Reply && (
          <UserMessage text={exchange2Reply.selectedOption} />
        )}

        {/* Clarification: Sage message */}
        {phase === 'typing_clarification' && <TypingIndicator />}
        {exchange2Reply && exchange2Reply.selectedOption === 'What do you mean by "gut rating"?' && (phase === 'showing_clarification' || clarificationReply || phase === 'complete') && (
          <SageMessage text={CLARIFICATION.sageMessage} />
        )}

        {/* Clarification: User reply (if selected) */}
        {clarificationReply && (
          <UserMessage text={clarificationReply.selectedOption} />
        )}
      </div>

      {/* Quick reply buttons — fixed to bottom */}
      <AnimatePresence mode="wait">
        {showExchange1Replies && (
          <QuickReplyBar
            key="exchange1"
            options={exchange1.quickReplies}
            onSelect={(option) => handleQuickReply(1, option)}
          />
        )}
        {showExchange2Replies && (
          <QuickReplyBar
            key="exchange2"
            options={EXCHANGE_2.quickReplies}
            onSelect={(option) => handleQuickReply(2, option)}
          />
        )}
        {showClarificationReplies && (
          <QuickReplyBar
            key="clarification"
            options={CLARIFICATION.quickReplies}
            onSelect={(option) => handleQuickReply(3, option)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Quick Reply Bar ────────────────────────────────────

function QuickReplyBar({
  options,
  onSelect,
}: {
  options: string[]
  onSelect: (option: string) => void
}) {
  return (
    <motion.div
      className="px-5 pb-8 pt-3 bg-gradient-to-t from-bg via-bg to-transparent"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex flex-col gap-2">
        {options.map((option, i) => (
          <motion.button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            className="w-full text-left px-4 py-3 rounded-2xl border-[1.5px] border-border bg-bg text-[15px] text-text leading-snug active:bg-primary active:text-white active:border-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: i * 0.06 }}
            whileTap={{ scale: 0.98 }}
            aria-label={option}
          >
            {option}
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}
