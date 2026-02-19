'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseMessage, parseStreamingChunk } from '@/lib/ai/parser'
import { MessageBubble } from './message-bubble'
import { TypingIndicator } from './typing-indicator'
import { ChatInput } from './chat-input'
import { BuildingCardPlaceholder } from './building-card-placeholder'
import { QuickReplyButtons } from './quick-reply-buttons'
import { ErrorMessage } from './error-message'
import { PulseCheckCard } from './pulse-check-card'
import { getOrCreateLifeMap, upsertDomain, updateLifeMapSynthesis } from '@/lib/supabase/life-map'
import { completeSession, updateDomainsExplored, updateSessionSummary } from '@/lib/supabase/sessions'
import { UserFileSystem } from '@/lib/markdown/user-file-system'
import { handleAllFileUpdates } from '@/lib/markdown/file-write-handler'
import type { FileUpdateData } from '@/types/chat'
import { savePulseCheckRatings, pulseRatingToDomainStatus, getLatestRatingsPerDomain } from '@/lib/supabase/pulse-check'
import { isPushSupported, requestPushPermission } from '@/lib/notifications/push'
import { scheduleMidDayNudge } from '@/lib/notifications/schedule-nudge'
import { PinnedContextCard } from './pinned-context-card'
import { SessionCompleteCard } from './session-complete-card'
import { SessionHeader } from './session-header'
import { SuggestedReplyButtons } from './suggested-reply-buttons'
import { IntentionCard } from './intention-card'
import { BriefingCard } from './briefing-card'
import { PulseRatingCard } from './pulse-rating-card'
import type { ChatMessage, SessionType, DomainName, PulseContextMode } from '@/types/chat'
import { PULSE_DOMAINS } from '@/types/pulse-check'
import type { PulseCheckRating } from '@/types/pulse-check'
import type { SessionState, SessionStateResult } from '@/lib/supabase/session-state'
import type { Commitment } from '@/lib/markdown/extract'
import { useSidebarContext } from './sidebar-context'
import { ALL_DOMAINS } from '@/lib/constants'
import { addDaysIso } from '@/lib/utils'
import { captureException } from '@/lib/monitoring/sentry'

interface BriefingData {
  firstName: string | null
  todayIntention: string | null
  yesterdayIntention: string | null
}

interface ChatViewProps {
  userId: string
  sessionType?: SessionType
  initialSessionState?: SessionStateResult
  initialCommitments?: Commitment[]
  exploreDomain?: string
  nudgeContext?: string
  sessionContext?: string
  precheckin?: boolean
  resumeSessionId?: string
  briefingData?: BriefingData
}

function StateQuickReplies({
  state,
  unexploredDomains,
  onSelect,
  disabled,
  pulseCheckRatings: ratings,
}: {
  state: SessionState
  unexploredDomains?: DomainName[]
  onSelect: (text: string) => void
  disabled: boolean
  pulseCheckRatings?: PulseCheckRating[] | null
}) {
  const buttonClass = 'flex-shrink-0 px-3 py-1.5 min-h-[44px] rounded-full text-sm font-medium bg-bg-card/50 border border-text-secondary/25 text-text shadow-sm hover:bg-primary hover:text-white hover:border-primary active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
  const primaryClass = 'flex-shrink-0 px-3 py-1.5 min-h-[44px] rounded-full text-sm bg-primary/10 border border-primary/30 text-primary font-medium hover:bg-primary hover:text-white hover:border-primary active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed'

  switch (state) {
    case 'mapping_in_progress': {
      let domains = unexploredDomains || []
      if (ratings && ratings.length > 0) {
        const ratingMap = new Map(ratings.map((r) => [r.domain, r.ratingNumeric]))
        domains = [...domains].sort((a, b) => (ratingMap.get(a) ?? 3) - (ratingMap.get(b) ?? 3))
      }
      return (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 px-1 scrollbar-hide">
          {domains.map((d) => (
            <button key={d} onClick={() => onSelect(`Let's explore ${d}`)} disabled={disabled} className={buttonClass}>{d}</button>
          ))}
          <button onClick={() => onSelect("Just want to talk.")} disabled={disabled} className={buttonClass}>Just talk</button>
          <button onClick={() => onSelect("Let's wrap up and synthesize what we've covered.")} disabled={disabled} className={primaryClass}>Wrap up</button>
        </div>
      )
    }
    case 'mapping_complete':
      return (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 px-1 scrollbar-hide">
          <button onClick={() => onSelect("I'd like to start my check-in early.")} disabled={disabled} className={primaryClass}>Start check-in early</button>
          <button onClick={() => onSelect("Something's on my mind.")} disabled={disabled} className={buttonClass}>Something on my mind</button>
          <button onClick={() => onSelect("I'd like to update my life map.")} disabled={disabled} className={buttonClass}>Update my life map</button>
        </div>
      )
    case 'checkin_due':
    case 'checkin_overdue':
      return (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 px-1 scrollbar-hide">
          <button onClick={() => onSelect("Let's do it.")} disabled={disabled} className={primaryClass}>Let&apos;s do it</button>
          <button onClick={() => onSelect("Not right now.")} disabled={disabled} className={buttonClass}>Not right now</button>
        </div>
      )
    case 'mid_conversation':
      return (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 px-1 scrollbar-hide">
          <button onClick={() => onSelect("Let's continue.")} disabled={disabled} className={primaryClass}>Continue</button>
          <button onClick={() => onSelect("Start fresh.")} disabled={disabled} className={buttonClass}>Start fresh</button>
        </div>
      )
    default:
      return null
  }
}

const SAGE_OPENING_NEW_USER = `Hey — I'm Sage. I'm going to help you build a map of where you are in life right now.

Before we talk, I want to get a quick pulse. Rate each of these areas — don't overthink it, just your gut right now.`

function getSageOpening(state: string, userName?: string, hasOnboardingPulse?: boolean): string {
  const name = userName ? ` ${userName.charAt(0).toUpperCase() + userName.slice(1)}` : ''
  switch (state) {
    case 'new_user':
      // If user already completed onboarding (pulse check done there), don't ask for pulse
      if (hasOnboardingPulse) {
        return `Hey${name ? ',' + name : ''} — thanks for sharing that snapshot. I can already see some interesting patterns. Let me take a closer look...`
      }
      return SAGE_OPENING_NEW_USER
    case 'mapping_in_progress':
      return `Welcome back${name ? ',' + name : ''}. Want to keep going with your life map?`
    case 'mapping_complete':
      return `Hey${name ? ',' + name : ''}. I'm here whenever. Anything on your mind?`
    case 'close_day':
      return `Hey${name ? ',' + name : ''}. Let's close out the day together.`
    case 'open_day':
      return `Good morning${name ? ',' + name : ''}. Let's set the tone for today.`
    case 'checkin_due':
      return `Hey${name ? ',' + name : ''} — it's check-in time. Ready to look at how this week went?`
    case 'checkin_overdue':
      return `Hey${name ? ',' + name : ''} — we missed our check-in. No pressure. Want to catch up now?`
    case 'mid_conversation':
      return `Hey — we were in the middle of things. Want to pick up where we left off, or start fresh?`
    default:
      return SAGE_OPENING_NEW_USER
  }
}

export function ChatView({ userId, sessionType = 'life_mapping', initialSessionState, initialCommitments, exploreDomain, nudgeContext, sessionContext, precheckin, resumeSessionId, briefingData }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingText, setStreamingText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [domainsExplored, setDomainsExplored] = useState<Set<DomainName>>(new Set())
  const [prefillText, setPrefillText] = useState<string | undefined>()
  const [retryCount, setRetryCount] = useState(0)
  const [showPushPrompt, setShowPushPrompt] = useState(false)
  const [showPulseCheck, setShowPulseCheck] = useState(false)
  const [pulseCheckSubmitting, setPulseCheckSubmitting] = useState(false)
  const [pulseCheckError, setPulseCheckError] = useState<string | null>(null)
  const [pulseCheckRatings, setPulseCheckRatings] = useState<PulseCheckRating[] | null>(null)
  const [sessionCompleted, setSessionCompleted] = useState(false)
  const [nextCheckinDate, setNextCheckinDate] = useState<string | null>(null)
  const [showCheckinPulse, setShowCheckinPulse] = useState(false)
  const [checkinPulseSubmitting, setCheckinPulseSubmitting] = useState(false)
  const [previousRatings, setPreviousRatings] = useState<PulseCheckRating[]>([])
  const [showBriefing, setShowBriefing] = useState(sessionType === 'open_day' && !!briefingData)

  const { setActiveDomain } = useSidebarContext()

  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  const sessionIdRef = useRef<string | null>(null)
  const streamAbortRef = useRef<AbortController | null>(null)
  // Cache parseMessage results by message ID — avoids re-parsing stable messages on every streaming tick
  const parsedCache = useRef<Map<string, ReturnType<typeof parseMessage>>>(new Map())
  const supabase = createClient()

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingText, scrollToBottom])

  // Keep refs in sync with state for use in closures
  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { sessionIdRef.current = sessionId }, [sessionId])

  // Abort any in-flight stream if the component unmounts.
  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort()
      streamAbortRef.current = null
    }
  }, [])

  // Initialize session
  useEffect(() => {
    /** Load messages for a session and hydrate state. Returns the fetched messages array. */
    async function loadSessionMessages(sid: string, domains?: DomainName[] | null): Promise<ChatMessage[]> {
      const { data: existingMessages } = await supabase
        .from('messages')
        .select('id, session_id, role, content, has_structured_block, created_at')
        .eq('session_id', sid)
        .order('created_at', { ascending: true })

      const mapped: ChatMessage[] = (existingMessages ?? []).map((m) => ({
        id: m.id,
        sessionId: m.session_id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        hasStructuredBlock: m.has_structured_block,
        createdAt: m.created_at,
      }))

      setSessionId(sid)
      if (mapped.length > 0) setMessages(mapped)
      if (domains) setDomainsExplored(new Set(domains))
      return mapped
    }

    async function init() {
      try {
        // Priority 1: Resume a specific session by ID (server already validated it's active + owned)
        if (resumeSessionId) {
          await loadSessionMessages(resumeSessionId)
          setIsLoading(false)
          return
        }

        // Check for active session
        const { data: activeSession } = await supabase
          .from('sessions')
          .select('id, session_type, domains_explored, status, metadata')
          .eq('user_id', userId)
          .eq('session_type', sessionType)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (activeSession) {
          // Derive hasNoUserMessages / hasNoMessages from already-fetched data — no extra queries
          const existingMessages = await loadSessionMessages(activeSession.id, activeSession.domains_explored as DomainName[] | null)

          // Show pulse check if new user hasn't completed it yet
          // (handles page refresh, HMR, and StrictMode double-mount)
          const isNewUser = initialSessionState?.state === 'new_user'
          if (isNewUser && sessionType === 'life_mapping') {
            const hasNoUserMessages = !existingMessages.some((m) => m.role === 'user')
            const hasNoMessages = existingMessages.length === 0

            const { data: ratings } = await supabase
              .from('pulse_check_ratings')
              .select('id')
              .eq('session_id', activeSession.id)
              .limit(1)

            if (!ratings || ratings.length === 0) {
              // No pulse data yet — show pulse check UI (only if no messages either)
              if (hasNoMessages) {
                setShowPulseCheck(true)
              }
            } else if (hasNoUserMessages) {
              // Pulse data exists and user hasn't replied yet — ensure Sage opens with rating context
              if (hasNoMessages) {
                // Insert the opening acknowledgment message
                const openingMessage = getSageOpening('new_user', initialSessionState?.userName, true)
                const { data: savedMsg, error: insertError } = await supabase
                  .from('messages')
                  .insert({
                    session_id: activeSession.id,
                    role: 'assistant',
                    content: openingMessage,
                    has_structured_block: false,
                  })
                  .select()
                  .single()

                if (insertError) {
                  console.error('[ChatView] Failed to insert opening message:', insertError)
                } else if (savedMsg) {
                  setMessages([{
                    id: savedMsg.id,
                    sessionId: savedMsg.session_id,
                    role: 'assistant',
                    content: savedMsg.content,
                    hasStructuredBlock: false,
                    createdAt: savedMsg.created_at,
                  }])
                }
              }

              // Always trigger onboarding_baseline when pulse data exists and user hasn't replied
              setTimeout(() => {
                triggerSageResponse('onboarding_baseline')
              }, 100)
            }
          }
        } else {
          // Check if user just completed onboarding (has pulse data already)
          const { data: existingPulseSession } = await supabase
            .from('pulse_check_ratings')
            .select('session_id')
            .eq('user_id', userId)
            .eq('is_baseline', true)
            .limit(1)
            .maybeSingle()

          const hasOnboardingPulse = Boolean(existingPulseSession)

          const state = initialSessionState?.state || 'new_user'

          // Build ad-hoc context to store in session metadata (read server-side, not per-request)
          let adHocContext: string | undefined
          if (sessionType === 'ad_hoc' && state === 'mapping_complete') {
            if (sessionContext) {
              adHocContext = sessionContext
            } else if (nudgeContext) {
              adHocContext = `The user is responding to this reflection prompt: "${nudgeContext}". Open by acknowledging it and asking how it's landing.`
            } else {
              adHocContext = 'Generate your opening message. Look at the user\'s life context and open with something specific.'
            }
          }

          // Create new session (store ad-hoc context in metadata for server-side retrieval)
          const { data: newSession } = await supabase
            .from('sessions')
            .insert({
              user_id: userId,
              session_type: sessionType,
              status: 'active',
              ...(adHocContext ? { metadata: { ad_hoc_context: adHocContext } } : {}),
            })
            .select()
            .single()

          if (newSession) {
            setSessionId(newSession.id)

            const needsPulseCheck = state === 'new_user' && sessionType === 'life_mapping' && !hasOnboardingPulse

            // Add Sage's opening message — daily rhythm sessions use sessionType directly
            const openingKey = sessionType === 'close_day' || sessionType === 'open_day' ? sessionType : state
            const openingMessage = getSageOpening(openingKey, initialSessionState?.userName, hasOnboardingPulse)

            const { data: savedMsg, error: insertError } = await supabase
              .from('messages')
              .insert({
                session_id: newSession.id,
                role: 'assistant',
                content: openingMessage,
                has_structured_block: false,
              })
              .select()
              .single()

            if (insertError) {
              console.error('[ChatView] Failed to insert opening message:', insertError)
            } else if (savedMsg) {
              setMessages([{
                id: savedMsg.id,
                sessionId: savedMsg.session_id,
                role: 'assistant',
                content: savedMsg.content,
                hasStructuredBlock: false,
                createdAt: savedMsg.created_at,
              }])
            }

            // Show pulse check for new users (only if no onboarding pulse data)
            if (needsPulseCheck) {
              setShowPulseCheck(true)
            }

            // Auto-trigger Sage for sessions that need an AI-generated opening
            if (precheckin) {
              setTimeout(() => {
                triggerSageResponse('none', { precheckin: true })
              }, 100)
            } else if (sessionType === 'close_day') {
              // close_day: Sage opens with context-aware evening reflection prompt
              setTimeout(() => {
                triggerSageResponse('none')
              }, 100)
            } else if (adHocContext) {
              // Context from session metadata (nudge, session history, or generic opening)
              setTimeout(() => {
                triggerSageResponse('none')
              }, 100)
            }

            // Auto-trigger Sage with pulse context for post-onboarding users
            if (hasOnboardingPulse && state === 'new_user') {
              setTimeout(() => {
                triggerSageResponse('onboarding_baseline')
              }, 100)
            }
          }
        }
      } catch {
        setError('Failed to initialize session')
      } finally {
        setIsLoading(false)
      }
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, sessionType, resumeSessionId])

  async function handlePulseCheckSubmit(ratings: PulseCheckRating[]) {
    if (!sessionId) return

    setPulseCheckSubmitting(true)
    setPulseCheckError(null)

    try {
      // Save ratings to DB
      await savePulseCheckRatings(supabase, sessionId, userId, ratings, true)

      // Seed life_map_domains with initial status (parallel writes)
      const lifeMap = await getOrCreateLifeMap(supabase, userId)
      await Promise.allSettled(
        ratings.map((rating) =>
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

      // Store ratings in state for later use
      setPulseCheckRatings(ratings)
      setShowPulseCheck(false)

      // Trigger Sage's response without showing a user message (context is reconstructed server-side)
      triggerSageResponse('onboarding_baseline')
    } catch {
      setPulseCheckError("Couldn't save your ratings. Tap to try again.")
    } finally {
      setPulseCheckSubmitting(false)
    }
  }

  async function handleCheckinPulseSubmit(ratings: PulseCheckRating[]) {
    if (!sessionId) return

    setCheckinPulseSubmitting(true)

    try {
      await savePulseCheckRatings(supabase, sessionId, userId, ratings, false)
      setShowCheckinPulse(false)

      triggerSageResponse('checkin_after_rerate')
    } catch {
      setError("Couldn't save your ratings. Try again.")
    } finally {
      setCheckinPulseSubmitting(false)
    }
  }

  function handleCheckinPulseSkip() {
    setShowCheckinPulse(false)
    triggerSageResponse('checkin_after_skip')
  }

  // Handle ?explore=<domain> from life map CTA
  const exploreHandled = useRef(false)
  const validDomainLabels: string[] = PULSE_DOMAINS.map((d) => d.label)
  useEffect(() => {
    if (exploreDomain && sessionId && !isLoading && !exploreHandled.current) {
      if (validDomainLabels.includes(exploreDomain)) {
        exploreHandled.current = true
        sendMessage(`Let's explore ${exploreDomain}`)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exploreDomain, sessionId, isLoading])

  /** Shared SSE streaming, message finalization, and DB persistence */
  async function streamAndFinalize(
    requestBody: Record<string, unknown>,
    forSessionId: string,
    signal?: AbortSignal
  ): Promise<string> {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal,
    })

    if (!response.ok) throw new Error(`API error: ${response.status}`)

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response stream')

    const decoder = new TextDecoder()
    let accumulated = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          if (parsed.error) throw new Error(parsed.error)
          if (parsed.text) {
            accumulated += parsed.text
            setStreamingText(accumulated)
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue
          throw e
        }
      }
    }

    const hasBlock = accumulated.includes('[FILE_UPDATE') ||
      accumulated.includes('[DOMAIN_SUMMARY]') ||
      accumulated.includes('[LIFE_MAP_SYNTHESIS]') ||
      accumulated.includes('[SESSION_SUMMARY]')

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId: forSessionId,
      role: 'assistant',
      content: accumulated,
      hasStructuredBlock: hasBlock,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, assistantMessage])
    setStreamingText('')

    await supabase.from('messages').insert({
      session_id: forSessionId,
      role: 'assistant',
      content: accumulated,
      has_structured_block: hasBlock,
    })

    return accumulated
  }

  async function triggerSageResponse(
    pulseMode: PulseContextMode,
    options?: { precheckin?: boolean }
  ) {
    // Use refs to avoid stale closure values (called from setTimeout/async contexts)
    const currentSessionId = sessionIdRef.current
    if (!currentSessionId || isStreaming) return

    const controller = new AbortController()
    streamAbortRef.current = controller

    setIsStreaming(true)
    setStreamingText('')
    setError(null)

    const apiMessages = messagesRef.current.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    try {
      await streamAndFinalize({
        sessionId: currentSessionId,
        sessionType,
        messages: apiMessages,
        pulseContextMode: pulseMode,
        ...(options?.precheckin ? { precheckin: true } : {}),
        ...(exploreDomain ? { exploreDomain } : {}),
      }, currentSessionId, controller.signal)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      captureException(err, { tags: { component: 'chat-view', stage: 'trigger_sage' } })
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
    } finally {
      if (streamAbortRef.current === controller) {
        streamAbortRef.current = null
      }
      setIsStreaming(false)
    }
  }

  async function sendMessage(text: string, retry = false) {
    if (!sessionId || isStreaming) return
    const controller = new AbortController()
    streamAbortRef.current = controller

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId,
      role: 'user',
      content: text,
      hasStructuredBlock: false,
      createdAt: new Date().toISOString(),
    }

    if (!retry) {
      // Add user message to state and save to DB
      setMessages((prev) => [...prev, userMessage])
      setRetryCount(0)

      await supabase.from('messages').insert({
        session_id: sessionId,
        role: 'user',
        content: text,
        has_structured_block: false,
      })
    }

    setIsStreaming(true)
    setStreamingText('')
    setError(null)

    // Build message array for API
    const apiMessages = [...messages, ...(retry ? [] : [userMessage])].map((m) => ({
      role: m.role,
      content: m.content,
    }))

    try {
      const accumulated = await streamAndFinalize({
        sessionId,
        sessionType,
        messages: apiMessages,
        ...(exploreDomain ? { exploreDomain } : {}),
      }, sessionId, controller.signal)

      // Detect [PULSE_CHECK] marker — Sage is asking for a pulse re-rating during check-in
      if (accumulated.includes('[PULSE_CHECK]')) {
        try {
          const ratings = await getLatestRatingsPerDomain(supabase, userId)
          setPreviousRatings(ratings)
        } catch {
          // If we can't fetch previous ratings, show empty card
          setPreviousRatings([])
        }
        setShowCheckinPulse(true)
        // Don't process FILE_UPDATE blocks yet — Sage will emit those after the re-rating
        return
      }

      // Handle structured blocks — persist to life map and manage session lifecycle
      const hasBlock = accumulated.includes('[FILE_UPDATE') ||
        accumulated.includes('[DOMAIN_SUMMARY]') ||
        accumulated.includes('[LIFE_MAP_SYNTHESIS]') ||
        accumulated.includes('[SESSION_SUMMARY]')

      if (hasBlock) {
        const parsed = parseMessage(accumulated)

        // Extract all domain summary blocks from the message
        const domainBlocks = parsed.segments.filter(
          (s): s is Extract<typeof s, { type: 'block'; blockType: 'domain_summary' }> =>
            s.type === 'block' && s.blockType === 'domain_summary'
        )

        if (domainBlocks.length > 0) {
          const newDomains = new Set(domainsExplored)
          for (const block of domainBlocks) {
            newDomains.add(block.data.domain)
          }
          setDomainsExplored(newDomains)

          try {
            const lifeMap = await getOrCreateLifeMap(supabase, userId)
            for (const block of domainBlocks) {
              await upsertDomain(supabase, lifeMap.id, block.data)
            }
            await updateDomainsExplored(supabase, sessionId, [...newDomains])
          } catch {
            console.error('Failed to persist domains to life map')
          }
        }

        // Handle synthesis block
        const synthesisBlock = parsed.segments.find(
          (s): s is Extract<typeof s, { type: 'block'; blockType: 'life_map_synthesis' }> =>
            s.type === 'block' && s.blockType === 'life_map_synthesis'
        )

        if (synthesisBlock) {
          try {
            const lifeMap = await getOrCreateLifeMap(supabase, userId)
            await updateLifeMapSynthesis(supabase, lifeMap.id, synthesisBlock.data)
            await completeSession(supabase, sessionId)

            setNextCheckinDate(addDaysIso(new Date(), 7))
            setSessionCompleted(true)

            // Mark onboarding complete (fire-and-forget — same as the FILE_UPDATE path below)
            supabase.from('users').update({ onboarding_completed: true }).eq('id', userId)
              .then(({ error }) => { if (error) console.error('Failed to mark onboarding complete') })

            // Prompt for push notifications after first life mapping
            if (isPushSupported() && Notification.permission === 'default') {
              setShowPushPrompt(true)
            }
          } catch {
            console.error('Failed to persist synthesis')
          }
        }

        // Handle session summary block
        const summaryBlock = parsed.segments.find(
          (s): s is Extract<typeof s, { type: 'block'; blockType: 'session_summary' }> =>
            s.type === 'block' && s.blockType === 'session_summary'
        )

        if (summaryBlock) {
          try {
            const data = summaryBlock.data
            const summaryText = [
              `Date: ${data.date}`,
              `Sentiment: ${data.sentiment}`,
              `Energy: ${data.energyLevel ?? 'N/A'}`,
              `Themes: ${data.keyThemes.join(', ')}`,
              `Commitments: ${data.commitments.join(', ')}`,
              `Updates: ${data.lifeMapUpdates}`,
              `Patterns: ${data.patternsObserved}`,
            ].join('\n')

            await updateSessionSummary(
              supabase,
              sessionId,
              summaryText,
              data.keyThemes,
              data.commitments,
              data.sentiment,
              data.energyLevel
            )
            await completeSession(supabase, sessionId)

            setNextCheckinDate(addDaysIso(new Date(), 7))
            setSessionCompleted(true)
          } catch {
            console.error('Failed to persist session summary')
          }
        }

        // Handle [FILE_UPDATE] blocks — write markdown files to Storage
        const fileUpdateBlocks = parsed.segments.filter(
          (s): s is Extract<typeof s, { type: 'block'; blockType: 'file_update' }> =>
            s.type === 'block' && s.blockType === 'file_update'
        )

        if (fileUpdateBlocks.length > 0) {
          const ufs = new UserFileSystem(supabase, userId)
          const updates: FileUpdateData[] = fileUpdateBlocks.map((b) => b.data)

          // Fire writes asynchronously — don't block the UI
          const writeSessionType = (sessionType === 'ad_hoc' && exploreDomain) ? 'ad_hoc_explore' : sessionType
          handleAllFileUpdates(ufs, updates, writeSessionType).then((results) => {
            for (const r of results) {
              if (!r.success) {
                console.error(`[ChatView] File write failed: ${r.path} — ${r.error}`)
              }
            }
          }).catch((err) => {
            console.error('[ChatView] File write handler error:', err)
          })

          // Track explored domains from domain-type file updates
          const newDomains = new Set(domainsExplored)
          let domainChanged = false
          for (const block of fileUpdateBlocks) {
            if (block.data.fileType === 'domain' && block.data.name) {
              newDomains.add(block.data.name as DomainName)
              domainChanged = true
            }
          }
          if (domainChanged) {
            setDomainsExplored(newDomains)
            setActiveDomain(null) // Clear sidebar active domain after card is generated
            updateDomainsExplored(supabase, sessionId, [...newDomains]).catch(() => {
              console.error('Failed to update domains explored')
            })
          }

          // Handle [REFLECTION_PROMPT] blocks — store for home screen display
          const reflectionBlock = parsed.segments.find(
            (s): s is Extract<typeof s, { type: 'block'; blockType: 'reflection_prompt' }> =>
              s.type === 'block' && s.blockType === 'reflection_prompt'
          )
          if (reflectionBlock) {
            supabase.from('reflection_prompts').upsert(
              {
                user_id: userId,
                session_id: sessionId,
                prompt_text: reflectionBlock.data.content,
                type: 'sage_generated',
                created_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,session_id' }
            ).then(({ error }) => {
              if (error) console.error('[ChatView] Failed to store reflection prompt:', error.message)
            })
          }

          // Handle session lifecycle for synthesis/check-in/daily-log file updates
          const hasOverview = updates.some((u) => u.fileType === 'overview')
          const hasCheckIn = updates.some((u) => u.fileType === 'check-in')
          const hasDailyLog = updates.some((u) => u.fileType === 'daily-log')
          const hasDayPlan = updates.some((u) => u.fileType === 'day-plan')

          if (hasDailyLog) {
            completeSession(supabase, sessionId).then(() => {
              setSessionCompleted(true)
            }).catch(() => {
              console.error('Failed to complete close_day session')
            })
          }

          if (hasDayPlan) {
            completeSession(supabase, sessionId).then(() => {
              setSessionCompleted(true)

              // Fire-and-forget: schedule mid-day nudge referencing morning intention
              const dayPlanUpdate = updates.find((u) => u.fileType === 'day-plan')
              const intention = dayPlanUpdate?.attributes?.intention ?? null
              if (intention) {
                scheduleMidDayNudge(supabase, userId, intention).catch(() => {
                  console.error('Failed to schedule mid-day nudge')
                })
              }
            }).catch(() => {
              console.error('Failed to complete open_day session')
            })
          }

          if (hasOverview || hasCheckIn) {
            completeSession(supabase, sessionId).then(() => {
              setNextCheckinDate(addDaysIso(new Date(), 7))
              setSessionCompleted(true)

              // Fire-and-forget: generate re-engagement content while context is warm
              const recent = messagesRef.current.slice(-8).map((m) => ({ role: m.role, content: m.content }))
              fetch('/api/session/generate-reengagement', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, sessionType, recentMessages: recent }),
              }).catch(() => console.error('Failed to generate re-engagement content'))
            }).catch(() => {
              console.error('Failed to complete session')
            })

            if (hasOverview) {
              // Mark onboarding complete (fire-and-forget — same as the SESSION_SUMMARY path above)
            supabase.from('users').update({ onboarding_completed: true }).eq('id', userId)
              .then(({ error }) => { if (error) console.error('Failed to mark onboarding complete') })

              if (isPushSupported() && Notification.permission === 'default') {
                setShowPushPrompt(true)
              }
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      captureException(err, { tags: { component: 'chat-view', stage: 'send_message' } })
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
      setRetryCount((prev) => prev + 1)
    } finally {
      if (streamAbortRef.current === controller) {
        streamAbortRef.current = null
      }
      setIsStreaming(false)
    }
  }

  function handleCorrectDomain(domain: DomainName) {
    setPrefillText(`About my ${domain} card — `)
  }

  function handleSend(text: string) {
    setPrefillText(undefined)

    // Detect domain exploration for sidebar active domain
    const exploreMatch = text.match(/^Let's explore (.+)$/i)
    if (exploreMatch) {
      const domainName = exploreMatch[1].trim()
      const matchedDomain = ALL_DOMAINS.find((d) => d.toLowerCase() === domainName.toLowerCase())
      if (matchedDomain) {
        setActiveDomain(matchedDomain)
      }
    }

    sendMessage(text)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-secondary">Loading conversation...</div>
      </div>
    )
  }

  // Parse streaming text for display (strip [PULSE_CHECK] marker)
  const streamingDisplay = streamingText
    ? parseStreamingChunk(streamingText.replace(/\[PULSE_CHECK\]/g, ''))
    : null

  // Computed once per render — prevents O(n²) scan if placed inside messages.map()
  const hasNoUserMessages = !messages.some((m) => m.role === 'user')

  return (
    <div className="flex flex-col h-full">
      {/* Pinned context card for weekly check-ins */}
      {sessionType === 'weekly_checkin' && initialCommitments && initialCommitments.length > 0 && (
        <PinnedContextCard commitments={initialCommitments} />
      )}

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="min-h-full flex flex-col justify-end space-y-4">
        <SessionHeader sessionType={sessionType} exploreDomain={exploreDomain} nudgeContext={nudgeContext} />

        {/* Morning briefing card (open_day only, before first message) */}
        {showBriefing && briefingData && messages.length === 0 && !isStreaming && (
          <BriefingCard
            firstName={briefingData.firstName}
            todayIntention={briefingData.todayIntention}
            yesterdayIntention={briefingData.yesterdayIntention}
            onStart={() => {
              setShowBriefing(false)
              handleSend("Let's open the day")
            }}
          />
        )}

        {messages.map((message, index) => {
          let parsed = parsedCache.current.get(message.id)
          if (!parsed) {
            parsed = parseMessage(message.content)
            parsedCache.current.set(message.id, parsed)
          }
          const isLastMessage = index === messages.length - 1
          const hasDomainCard = parsed.segments.some(
            (s) => s.type === 'block' && (
              s.blockType === 'domain_summary' ||
              (s.blockType === 'file_update' && s.data?.fileType === 'domain')
            )
          )
          const showDomainQuickReplies = isLastMessage && hasDomainCard && sessionType === 'life_mapping' && !isStreaming

          // Check for AI-driven suggested replies and intention cards
          const suggestedReplies = parsed.segments.find(
            (s) => s.type === 'block' && s.blockType === 'suggested_replies'
          )
          const intentionCard = parsed.segments.find(
            (s) => s.type === 'block' && s.blockType === 'intention_card'
          )
          const hasSuggestedReplies = isLastMessage && suggestedReplies && !isStreaming
          const hasIntentionCard = isLastMessage && intentionCard && !isStreaming

          // Show state-aware quick replies after opening message (first assistant msg, no user messages yet)
          // But only if there are no AI-driven suggested replies
          const isOpeningMessage = index === 0 && message.role === 'assistant'
          const showStateQuickReplies = isLastMessage && isOpeningMessage && hasNoUserMessages && !isStreaming && !showPulseCheck && !hasSuggestedReplies

          return (
            <div key={message.id}>
              <MessageBubble
                message={message}
                parsedContent={parsed}
                onCorrectDomain={handleCorrectDomain}
              />
              {hasIntentionCard && intentionCard.type === 'block' && intentionCard.blockType === 'intention_card' && (
                <div className="mt-2 flex justify-start">
                  <IntentionCard
                    data={intentionCard.data}
                    onKeep={() => handleSend("I'll keep that focus")}
                    onChange={() => handleSend('I want to change my focus')}
                    disabled={isStreaming}
                  />
                </div>
              )}
              {hasSuggestedReplies && suggestedReplies.type === 'block' && suggestedReplies.blockType === 'suggested_replies' && (
                <div className="mt-2">
                  <SuggestedReplyButtons
                    data={suggestedReplies.data}
                    onSelect={handleSend}
                    disabled={isStreaming}
                  />
                </div>
              )}
              {showDomainQuickReplies && (
                <div className="mt-2">
                  <QuickReplyButtons
                    domainsExplored={domainsExplored}
                    onSelect={handleSend}
                    disabled={isStreaming}
                    pulseCheckRatings={pulseCheckRatings}
                  />
                </div>
              )}
              {showStateQuickReplies && initialSessionState && (
                <StateQuickReplies
                  state={initialSessionState.state}
                  unexploredDomains={initialSessionState.unexploredDomains}
                  onSelect={handleSend}
                  disabled={isStreaming}
                  pulseCheckRatings={pulseCheckRatings}
                />
              )}
            </div>
          )
        })}

        {/* Streaming message */}
        {isStreaming && streamingDisplay && (
          <>
            {streamingDisplay.displayText ? (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-lg px-4 py-3 bg-bg-sage border-l-[3px] border-l-accent-sage">
                  <p className="text-text whitespace-pre-wrap">{streamingDisplay.displayText}</p>
                </div>
              </div>
            ) : null}
            {streamingDisplay.pendingBlock && (
              <div className="w-full max-w-[95%]">
                <BuildingCardPlaceholder />
              </div>
            )}
          </>
        )}

        {/* Pulse check card (onboarding) */}
        {showPulseCheck && (
          <PulseCheckCard
            onSubmit={handlePulseCheckSubmit}
            isSubmitting={pulseCheckSubmitting}
            submitError={pulseCheckError}
            onRetry={() => {
              if (pulseCheckRatings) handlePulseCheckSubmit(pulseCheckRatings)
            }}
          />
        )}

        {/* Check-in pulse re-rating card */}
        {showCheckinPulse && (
          <PulseRatingCard
            previousRatings={previousRatings}
            onSubmit={handleCheckinPulseSubmit}
            onSkip={handleCheckinPulseSkip}
            isSubmitting={checkinPulseSubmitting}
          />
        )}

        {/* Typing indicator — before first token */}
        {isStreaming && !streamingText && <TypingIndicator />}

        {/* Error state */}
        {error && !isStreaming && (
          <ErrorMessage
            retryCount={retryCount}
            onRetry={() => {
              const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
              if (lastUserMsg) sendMessage(lastUserMsg.content, true)
            }}
          />
        )}

        {/* Session complete card */}
        {sessionCompleted && !isStreaming && (
          <div className="flex justify-start">
            <SessionCompleteCard
              sessionType={sessionType}
              nextCheckinDate={nextCheckinDate}
            />
          </div>
        )}

        {/* Push notification prompt */}
        {showPushPrompt && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-4 py-3 bg-bg-card border border-primary/20">
              <p className="text-sm text-text mb-3">
                Want me to remind you when it&apos;s time to check in?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await requestPushPermission()
                    setShowPushPrompt(false)
                  }}
                  className="h-9 px-4 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary-hover transition-colors"
                >
                  Allow
                </button>
                <button
                  onClick={() => setShowPushPrompt(false)}
                  className="h-9 px-4 text-text-secondary text-sm font-medium rounded-md hover:bg-border/30 transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Input area */}
      {!sessionCompleted && (
        <ChatInput
          onSend={handleSend}
          disabled={isStreaming || showPulseCheck || showCheckinPulse}
          prefill={prefillText}
          placeholder={showPulseCheck ? 'Rate your life areas above to begin.' : showCheckinPulse ? 'Update your pulse ratings above, or skip.' : undefined}
        />
      )}
    </div>
  )
}
