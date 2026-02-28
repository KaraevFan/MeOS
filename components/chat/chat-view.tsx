'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { parseMessage, parseStreamingChunk } from '@/lib/ai/parser'
import { MessageBubble } from './message-bubble'
import { TypingIndicator } from './typing-indicator'
import { ChatInput } from './chat-input'
import { BuildingCardPlaceholder } from './building-card-placeholder'
import { SuggestionPills } from './suggestion-pills'
import type { SuggestionPill } from './suggestion-pills'
import { EnergyCheckCard } from './energy-check-card'
import { ErrorMessage } from './error-message'
import { PulseCheckCard } from './pulse-check-card'
import { getOrCreateLifeMap, upsertDomain, updateLifeMapSynthesis } from '@/lib/supabase/life-map'
import { completeSession, updateDomainsExplored, updateSessionSummary, abandonSession } from '@/lib/supabase/sessions'
import { UserFileSystem } from '@/lib/markdown/user-file-system'
import { handleAllFileUpdates } from '@/lib/markdown/file-write-handler'
import type { FileUpdateData } from '@/types/chat'
import { getOrCreateTodayDayPlan, updateDayPlan } from '@/lib/supabase/day-plan-queries'
import type { DayPlan } from '@/types/day-plan'
import { savePulseCheckRatings, pulseRatingToDomainStatus, getLatestRatingsPerDomain, getBaselineRatings } from '@/lib/supabase/pulse-check'
import { useActiveSession } from '@/components/providers/active-session-provider'
import { isPushSupported, requestPushPermission } from '@/lib/notifications/push'
import { scheduleMidDayNudge } from '@/lib/notifications/schedule-nudge'
import { PinnedContextCard } from './pinned-context-card'
import { SessionCompleteCard } from './session-complete-card'
import { SessionHeader } from './session-header'
import { ExitConfirmationSheet } from './exit-confirmation-sheet'
import { IntentionCard } from './intention-card'
import { BriefingCard } from './briefing-card'
import { PulseRatingCard } from './pulse-rating-card'
import type { ChatMessage, SessionType, DomainName, PulseContextMode } from '@/types/chat'
import { PULSE_DOMAINS } from '@/types/pulse-check'
import type { PulseCheckRating } from '@/types/pulse-check'
import type { SessionState, SessionStateResult } from '@/lib/supabase/session-state'
import type { Commitment } from '@/lib/markdown/extract'
import { useSidebarContext } from './sidebar-context'
import { LifeMapProgressPill } from './life-map-progress-pill'
import { ALL_DOMAINS } from '@/lib/constants'
import { addDaysIso } from '@/lib/utils'
import { captureException } from '@/lib/monitoring/sentry'

interface BriefingData {
  firstName: string | null
  todayIntention: string | null
  timezone: string
}

interface ChatViewProps {
  userId: string
  sessionType?: SessionType
  initialSessionState?: SessionStateResult
  initialCommitments?: Commitment[]
  initialPulseRatings?: PulseCheckRating[]
  exploreDomain?: string
  nudgeContext?: string
  sessionContext?: string
  precheckin?: boolean
  resumeSessionId?: string
  briefingData?: BriefingData
}

/** Build state-based suggestion pills for opening messages */
function getStatePills(state: SessionState, unexploredDomains?: DomainName[], ratings?: PulseCheckRating[] | null): SuggestionPill[] {
  switch (state) {
    case 'mapping_in_progress': {
      let domains = unexploredDomains || []
      if (ratings && ratings.length > 0) {
        const ratingMap = new Map(ratings.map((r) => [r.domain, r.ratingNumeric]))
        domains = [...domains].sort((a, b) => (ratingMap.get(a) ?? 3) - (ratingMap.get(b) ?? 3))
      }
      const suggestWrapUp = (unexploredDomains?.length ?? 0) < ALL_DOMAINS.length - 2
      const domainPills: SuggestionPill[] = domains.slice(0, suggestWrapUp ? 2 : 3).map((d) => ({
        label: d,
        value: `Let's explore ${d}`,
      }))
      if (suggestWrapUp) {
        domainPills.push({ label: 'Wrap up', value: "Let's wrap up and synthesize what we've covered.", variant: 'primary' as const })
      }
      return domainPills
    }
    case 'mapping_complete':
      return [
        { label: 'Start check-in early', value: "I'd like to start my check-in early.", variant: 'primary' as const },
        { label: 'Something on my mind', value: "Something's on my mind." },
        { label: 'Update my life map', value: "I'd like to update my life map." },
      ]
    case 'checkin_due':
    case 'checkin_overdue':
      return [
        { label: "Let's do it", value: "Let's do it.", variant: 'primary' as const },
        { label: 'Not right now', value: 'Not right now.' },
      ]
    case 'mid_conversation':
      return [
        { label: 'Continue', value: "Let's continue.", variant: 'primary' as const },
        { label: 'Start fresh', value: 'Start fresh.' },
      ]
    default:
      return []
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

export function ChatView({ userId, sessionType = 'life_mapping', initialSessionState, initialCommitments, initialPulseRatings, exploreDomain, nudgeContext, sessionContext, precheckin, resumeSessionId, briefingData }: ChatViewProps) {
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
  const [pulseCheckRatings, setPulseCheckRatings] = useState<PulseCheckRating[] | null>(initialPulseRatings ?? null)
  const [sessionCompleted, setSessionCompleted] = useState(false)
  const [nextCheckinDate, setNextCheckinDate] = useState<string | null>(null)
  const [showCheckinPulse, setShowCheckinPulse] = useState(false)
  const [checkinPulseSubmitting, setCheckinPulseSubmitting] = useState(false)
  const [previousRatings, setPreviousRatings] = useState<PulseCheckRating[]>([])
  const [showBriefing, setShowBriefing] = useState(sessionType === 'open_day' && !!briefingData)
  const [showExitSheet, setShowExitSheet] = useState(false)
  // Active mode within open_conversation (e.g. 'open_day', 'close_day')
  const [activeMode, setActiveMode] = useState<string | null>(null)
  // Tracks whether a terminal artifact card has rendered (fallback signal for session completion)
  const [hasTerminalArtifact, setHasTerminalArtifact] = useState(false)
  // Tracks active tool execution for shimmer indicator
  const [pendingToolCall, setPendingToolCall] = useState<string | null>(null)
  // Tool-driven suggestion pills (from show_options tool)
  const [toolDrivenOptions, setToolDrivenOptions] = useState<string[] | null>(null)
  // Ref-based guard: prevents duplicate completeSession() calls from server+client race.
  // React batches setSessionCompleted(true), so state guards read stale values in the same tick.
  const sessionCompletedRef = useRef(false)
  // Two-phase close_day completion: card emitted (Phase A) → user confirms → session completes (Phase B)
  const awaitingJournalConfirmationRef = useRef(false)

  const router = useRouter()
  const { setActiveDomain, setIsStreaming: setSidebarStreaming, signalDomainCompleted } = useSidebarContext()
  const { setHasActiveSession } = useActiveSession()

  // Keep tab bar hidden for the entire chat page lifecycle (active + completed).
  // The SessionCompleteCard provides navigation after session ends ("Back to Home").
  // Cleanup on unmount resets to false so the tab bar reappears when navigating away.
  useEffect(() => {
    setHasActiveSession(!!sessionId)
    return () => setHasActiveSession(false)
  }, [sessionId, setHasActiveSession])

  // Stabilize pill ratings prop to avoid new array reference every render
  const pillRatings = useMemo(
    () => pulseCheckRatings?.map((r) => ({ domain: r.domain, ratingNumeric: r.ratingNumeric })) ?? null,
    [pulseCheckRatings]
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  const sessionIdRef = useRef<string | null>(null)
  const streamAbortRef = useRef<AbortController | null>(null)
  // Cache parseMessage results by message ID — avoids re-parsing stable messages on every streaming tick
  const parsedCache = useRef<Map<string, ReturnType<typeof parseMessage>>>(new Map())
  const supabase = createClient()

  const isOnboarding = useMemo(
    () => sessionType === 'life_mapping' && initialSessionState?.state === 'new_user',
    [sessionType, initialSessionState]
  )

  // Sync streaming state to SidebarContext so pill can show shimmer
  useEffect(() => {
    setSidebarStreaming(isStreaming)
  }, [isStreaming, setSidebarStreaming])

  // Track whether user is near bottom via scroll events (before content updates change scrollHeight)
  const NEAR_BOTTOM_THRESHOLD = 100 // px
  const isNearBottomRef = useRef(true)

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const el = scrollRef.current
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isNearBottomRef.current = distanceFromBottom < NEAR_BOTTOM_THRESHOLD
  }, [])

  const scrollToBottom = useCallback((force = false) => {
    if (!scrollRef.current) return
    if (force || isNearBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  // Force-scroll on mount (initial load)
  useEffect(() => {
    scrollToBottom(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Proximity-aware scroll on new messages / streaming updates
  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingText, scrollToBottom])

  // Exit session handler — decision tree:
  // - Terminal artifact rendered (session functionally complete): navigate home directly
  // - Onboarding (life_mapping + new_user): always "Save & finish later" → leave active, navigate home
  // - 0-2 user messages: silent discard → abandon session, navigate home
  // - 3+ user messages: show pause confirmation sheet
  const handleExit = useCallback(() => {
    // If a terminal artifact has rendered, the session is functionally done — skip modal
    if (hasTerminalArtifact || sessionCompleted) {
      router.push('/home')
      return
    }

    const userMessageCount = messagesRef.current.filter((m) => m.role === 'user').length

    if (isOnboarding) {
      // Always save onboarding progress — show "Save & finish later" sheet
      setShowExitSheet(true)
      return
    }

    if (userMessageCount < 3) {
      // Barely started — discard silently
      if (sessionIdRef.current) {
        const client = createClient()
        abandonSession(client, sessionIdRef.current, userId).catch((err) => {
          captureException(err, { tags: { component: 'chat-view', stage: 'abandon_session' } })
        })
      }
      router.push('/home')
      return
    }

    // Substantive session — ask user to pause or continue
    setShowExitSheet(true)
  }, [isOnboarding, hasTerminalArtifact, sessionCompleted, userId, router])

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
            } else {
              // Pulse data exists — load into state so pill/spider chart can display
              const baselineRatings = await getBaselineRatings(supabase, userId)
              if (baselineRatings) setPulseCheckRatings(baselineRatings)
            }

            if (ratings && ratings.length > 0 && hasNoUserMessages) {
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

          // Build opening context to store in session metadata (read server-side, not per-request)
          let openingContext: string | undefined
          if (sessionType === 'open_conversation') {
            if (sessionContext) {
              openingContext = sessionContext
            } else if (nudgeContext) {
              openingContext = `The user is responding to this reflection prompt: "${nudgeContext}". Open by acknowledging it and asking how it's landing.`
            } else {
              openingContext = 'Generate your opening message. Look at the user\'s life context and open with something specific.'
            }
          }

          // Create new session (store opening context in metadata for server-side retrieval)
          const { data: newSession } = await supabase
            .from('sessions')
            .insert({
              user_id: userId,
              session_type: sessionType,
              status: 'active',
              ...(openingContext ? { metadata: { ad_hoc_context: openingContext } } : {}),
            })
            .select()
            .single()

          if (newSession) {
            setSessionId(newSession.id)

            const needsPulseCheck = state === 'new_user' && sessionType === 'life_mapping' && !hasOnboardingPulse

            // AI-generated openings: skip hard-coded opening for open_day and open_conversation
            const aiGeneratedOpening = (sessionType === 'open_day' && !briefingData) || sessionType === 'open_conversation'
            if (aiGeneratedOpening) {
              // Show typing indicator while we auto-trigger Sage
              setIsStreaming(true)
            } else if (sessionType !== 'open_day') {
              // Add Sage's opening message — daily rhythm sessions use sessionType directly
              const openingKey = sessionType === 'close_day' ? sessionType : state
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
            } else if (sessionType === 'open_day' && !briefingData) {
              // open_day without briefing: auto-trigger Sage to generate context-rich greeting
              // When briefingData exists, the BriefingCard's onStart callback handles this
              setTimeout(() => {
                triggerSageResponse('none')
              }, 100)
            } else if (openingContext) {
              // Context from session metadata (nudge, session history, or generic opening)
              setTimeout(() => {
                triggerSageResponse('none')
              }, 100)
            }

            // Auto-trigger Sage with pulse context for post-onboarding users
            if (hasOnboardingPulse && state === 'new_user') {
              // Load baseline ratings into state so pill/spider chart can display
              const baselineRatings = await getBaselineRatings(supabase, userId)
              if (baselineRatings) setPulseCheckRatings(baselineRatings)

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

  /** Shared SSE streaming, message finalization, and DB persistence.
   *  Returns the accumulated response text. If the server signals session completion,
   *  sessionCompleted state is set here (no client-side completeSession call needed). */
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
          if (parsed.sessionCompleted) {
            // Server completed the session — set ref + state, skip client-side completion
            sessionCompletedRef.current = true
            setSessionCompleted(true)
            // Signal Day tab to refresh on next mount (avoids unconditional router.refresh)
            sessionStorage.setItem('dayPlanStale', '1')
          }
          if (parsed.modeChange) {
            setActiveMode(parsed.modeChange)
          }
          if (parsed.arcCompleted) {
            // Structured arc finished within open_conversation — return to base layer
            setActiveMode(null)
          }
          // Tool-use events: show shimmer during save_file execution
          if (parsed.toolCall) {
            if (parsed.toolCall.name === 'save_file') {
              setPendingToolCall(parsed.toolCall.name)
            }
            continue
          }
          if (parsed.roundBoundary) {
            setPendingToolCall(null)
            continue
          }
          // Domain rating update from tool-use — update spider chart live
          if (parsed.domainUpdate) {
            const { domain, updatedRating } = parsed.domainUpdate as { domain: string; updatedRating: number }
            if (domain && typeof updatedRating === 'number' && updatedRating >= 1 && updatedRating <= 5) {
              setPulseCheckRatings((prev) => {
                if (!prev) return prev
                const existing = prev.find((r) => r.domain === domain)
                if (existing) {
                  return prev.map((r) =>
                    r.domain === domain ? { ...r, ratingNumeric: updatedRating } : r
                  )
                }
                return prev
              })
              // Persist to pulse_check_ratings for trend tracking (fire-and-forget)
              if (sessionId) {
                const ratingLabel = (['in_crisis', 'struggling', 'okay', 'good', 'thriving'] as const)[updatedRating - 1]
                supabase.from('pulse_check_ratings').insert({
                  session_id: sessionId,
                  user_id: userId,
                  domain_name: domain,
                  rating: ratingLabel,
                  rating_numeric: updatedRating,
                  is_baseline: false,
                }).then(() => { /* fire-and-forget */ })
              }
            }
            continue
          }
          if (parsed.showPulseCheck) {
            // Tool-driven pulse check — trigger the existing check-in pulse UI
            try {
              const ratings = await getLatestRatingsPerDomain(supabase, userId)
              setPreviousRatings(ratings)
            } catch {
              setPreviousRatings([])
            }
            setShowCheckinPulse(true)
            continue
          }
          if (parsed.showOptions) {
            // Tool-driven suggestion pills — store options for rendering after stream ends
            const opts = parsed.showOptions as { options?: string[] }
            if (Array.isArray(opts.options)) {
              setToolDrivenOptions(opts.options)
            }
            continue
          }
          if (parsed.text) {
            if (pendingToolCall) setPendingToolCall(null)
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
      setPendingToolCall(null)
      setIsStreaming(false)
    }
  }

  async function sendMessage(text: string, retry = false) {
    if (!sessionId || isStreaming) return
    // User just sent — ensure auto-scroll to show their message and the response
    isNearBottomRef.current = true
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

        // Arc-mode guard: when inside a structured arc within open_conversation,
        // the server sends arcCompleted — skip client-side completeSession calls.
        const isArcMode = activeMode != null && sessionType === 'open_conversation'

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

        if (synthesisBlock && !sessionCompletedRef.current && !isArcMode) {
          sessionCompletedRef.current = true
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

        if (summaryBlock && !sessionCompletedRef.current && !isArcMode) {
          sessionCompletedRef.current = true
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
          const writeSessionType = sessionType
          const fileWriteTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
          handleAllFileUpdates(ufs, updates, writeSessionType, fileWriteTimezone).then((results) => {
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
          let lastNewDomain: string | null = null
          for (const block of fileUpdateBlocks) {
            if (block.data.fileType === 'domain' && block.data.name) {
              const domainName = block.data.name as DomainName
              if (!domainsExplored.has(domainName)) {
                lastNewDomain = domainName
              }
              newDomains.add(domainName)
              domainChanged = true
            }
          }
          if (domainChanged) {
            setDomainsExplored(newDomains)
            // Signal pill auto-expand for newly completed domains
            if (lastNewDomain) {
              signalDomainCompleted(lastNewDomain)
            }
            setActiveDomain(null) // Clear sidebar active domain after card is generated
            updateDomainsExplored(supabase, sessionId, [...newDomains]).catch(() => {
              console.error('Failed to update domains explored')
            })
          }

          // Handle updated_rating from domain file updates — update live UI + persist
          for (const block of fileUpdateBlocks) {
            if (block.data.fileType === 'domain' && block.data.name && block.data.attributes?.updated_rating) {
              const newRating = Math.round(Number(block.data.attributes.updated_rating))
              if (Number.isInteger(newRating) && newRating >= 1 && newRating <= 5 && sessionId) {
                const domainName = block.data.name
                // Update pulse ratings state for live shelf/spider chart update
                setPulseCheckRatings((prev) => {
                  if (!prev) return prev
                  const existing = prev.find((r) => r.domain === domainName)
                  if (existing) {
                    return prev.map((r) =>
                      r.domain === domainName ? { ...r, ratingNumeric: newRating } : r
                    )
                  }
                  return prev
                })
                // Persist to pulse_check_ratings for trend tracking (fire-and-forget)
                const ratingLabel = (['in_crisis', 'struggling', 'okay', 'good', 'thriving'] as const)[newRating - 1]
                supabase.from('pulse_check_ratings').insert({
                  session_id: sessionId,
                  user_id: userId,
                  domain_name: domainName,
                  rating: ratingLabel,
                  rating_numeric: newRating,
                  is_baseline: false,
                }).then(({ error }) => {
                  if (error) console.error('[ChatView] Failed to persist updated rating:', error.message)
                })
              }
            }
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

          // Track terminal artifact rendering for exit modal fallback
          if (hasDailyLog || hasDayPlan || hasOverview || hasCheckIn) {
            setHasTerminalArtifact(true)
          }

          if (hasDailyLog) {
            // Phase A: JournalCard emitted — defer session completion until user confirms the card.
            // Sage's prompt asks "Does this capture the day?" after the card.
            awaitingJournalConfirmationRef.current = true
          }

          if (hasDayPlan && !sessionCompletedRef.current) {
            if (!isArcMode) {
              sessionCompletedRef.current = true
              completeSession(supabase, sessionId).then(() => {
                setSessionCompleted(true)

                // Fire-and-forget: schedule mid-day nudge referencing morning intention
                const dayPlanUpdate = updates.find((u) => u.fileType === 'day-plan')
                const intention = dayPlanUpdate?.attributes?.intention ?? null
                if (intention) {
                  scheduleMidDayNudge(supabase, userId, intention, Intl.DateTimeFormat().resolvedOptions().timeZone).catch(() => {
                    console.error('Failed to schedule mid-day nudge')
                  })
                }
              }).catch(() => {
                console.error('Failed to complete open_day session')
              })
            }
          }

          // Write structured day plan data to Postgres — runs unconditionally when a day-plan
          // FILE_UPDATE is present (the sessionCompleted guard above is for lifecycle only;
          // the Postgres row must exist regardless or the Day page shows "No plan for this day").
          if (hasDayPlan) {
            const dayPlanDataBlock = parsed.segments.find(
              (s): s is Extract<typeof s, { type: 'block'; blockType: 'day_plan_data' }> =>
                s.type === 'block' && s.blockType === 'day_plan_data'
            )
            const dayPlanFileUpdate = updates.find((u) => u.fileType === 'day-plan')
            const dayPlanIntention = dayPlanDataBlock?.data.intention ?? dayPlanFileUpdate?.attributes?.intention ?? null

            const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
            try {
              const dayPlan = await getOrCreateTodayDayPlan(supabase, userId, clientTimezone)
              const updateData: Partial<Pick<DayPlan,
                'intention' | 'energy_level' | 'morning_session_id' | 'morning_completed_at' |
                'priorities' | 'open_threads'
              >> = {
                morning_session_id: sessionId,
                morning_completed_at: new Date().toISOString(),
              }
              if (dayPlanIntention) updateData.intention = dayPlanIntention
              if (dayPlanDataBlock?.data.energy_level) updateData.energy_level = dayPlanDataBlock.data.energy_level
              if (dayPlanDataBlock?.data.priorities) updateData.priorities = dayPlanDataBlock.data.priorities
              if (dayPlanDataBlock?.data.open_threads) updateData.open_threads = dayPlanDataBlock.data.open_threads.map((t) => ({
                text: t.text,
                source_session_type: t.source_session_type ?? 'open_day',
                source_date: t.source_date ?? new Intl.DateTimeFormat('en-CA', { timeZone: clientTimezone }).format(new Date()),
                provenance_label: t.provenance_label ?? '',
                status: t.status,
                resolved_at: null,
              }))

              await updateDayPlan(supabase, userId, dayPlan.date, updateData)
            } catch (err) {
              captureException(err, { tags: { component: 'chat-view', stage: 'day_plan_write' } })
            }
          }

          if ((hasOverview || hasCheckIn) && !sessionCompletedRef.current && !isArcMode) {
            sessionCompletedRef.current = true
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

      // Phase B: close_day two-phase completion.
      // If we're awaiting journal confirmation and Sage's closing response has no new daily-log
      // and no suggested replies (indicating Sage is done, not asking follow-ups), complete the session.
      const hasDailyLogInResponse = accumulated.includes('[FILE_UPDATE type="daily-log"')
      const hasSuggestedReplies = accumulated.includes('[SUGGESTED_REPLIES]')
      if (
        sessionType === 'close_day' &&
        awaitingJournalConfirmationRef.current &&
        !hasDailyLogInResponse &&
        !hasSuggestedReplies &&
        !sessionCompletedRef.current
      ) {
        awaitingJournalConfirmationRef.current = false
        sessionCompletedRef.current = true
        completeSession(supabase, sessionId).then(() => {
          setSessionCompleted(true)
        }).catch((err) => {
          captureException(err, { tags: { component: 'chat-view', stage: 'complete_close_day' } })
          console.error('Failed to complete close_day session')
        })
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
      setPendingToolCall(null)
      setIsStreaming(false)
    }
  }

  function handleCorrectDomain(domain: DomainName) {
    setPrefillText(`About my ${domain} card — `)
  }

  function handleSend(text: string) {
    setPrefillText(undefined)
    // Clear tool-driven options when user sends a message (they chose or typed instead)
    if (toolDrivenOptions) setToolDrivenOptions(null)

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
    <div className="flex flex-col h-full min-h-0">
      {/* Session header — always visible at top; exit button triggers decision tree */}
      <SessionHeader
        sessionType={sessionType}
        exploreDomain={exploreDomain}
        nudgeContext={nudgeContext}
        activeMode={activeMode}
        onExit={handleExit}
      />

      {/* Life Map Progress Pill — shown during life_mapping sessions after pulse check */}
      {sessionType === 'life_mapping' && !showPulseCheck && !showCheckinPulse && (
        <LifeMapProgressPill
          userId={userId}
          domainsExplored={domainsExplored}
          pulseCheckRatings={pillRatings}
        />
      )}

      {/* Pinned context card for weekly check-ins */}
      {sessionType === 'weekly_checkin' && initialCommitments && initialCommitments.length > 0 && (
        <PinnedContextCard commitments={initialCommitments} />
      )}

      {/* Messages area */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="min-h-full flex flex-col justify-end space-y-4">

        {/* Morning briefing card (open_day only, before first message) */}
        {showBriefing && briefingData && messages.length === 0 && !isStreaming && (
          <BriefingCard
            firstName={briefingData.firstName}
            todayIntention={briefingData.todayIntention}
            timezone={briefingData.timezone}
            onStart={() => {
              setShowBriefing(false)
              // Auto-trigger Claude (same pattern as close_day) — no user message
              // so Claude starts clean at Step 1 (energy check + pills)
              triggerSageResponse('none')
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
          // Suppress state pills for structured session types — they have their own flow (energy check, etc.)
          const showStateQuickReplies = isLastMessage && isOpeningMessage && hasNoUserMessages && !isStreaming && !showPulseCheck && !hasSuggestedReplies
            && sessionType !== 'open_day' && sessionType !== 'close_day'

          // Build pills for the active suggestion source (priority: AI > domain > state)
          // Only compute for the last message to avoid unnecessary work
          let activePills: SuggestionPill[] = []
          if (isLastMessage && !isStreaming && !sessionCompleted && !hasIntentionCard) {
            if (toolDrivenOptions && toolDrivenOptions.length > 0) {
              activePills = toolDrivenOptions.map((o) => ({ label: o, value: o }))
            } else if (hasSuggestedReplies && suggestedReplies.type === 'block' && suggestedReplies.blockType === 'suggested_replies') {
              activePills = suggestedReplies.data.replies.map((r) => ({ label: r, value: r }))
            } else if (showDomainQuickReplies) {
              // Top 3 unexplored domains by pulse rating
              let remaining = ALL_DOMAINS.filter((d) => !domainsExplored.has(d))
              if (pulseCheckRatings && pulseCheckRatings.length > 0) {
                const ratingMap = new Map(pulseCheckRatings.map((r) => [r.domain, r.ratingNumeric]))
                remaining = [...remaining].sort((a, b) => (ratingMap.get(a) ?? 3) - (ratingMap.get(b) ?? 3))
              }
              const suggestWrapUp = domainsExplored.size >= 3
              const top = remaining.slice(0, suggestWrapUp ? 2 : 3)
              activePills = top.map((d) => ({ label: d, value: `Let's explore ${d}` }))
              if (suggestWrapUp) {
                activePills.push({ label: 'Wrap up & synthesize', value: "Let's wrap up and synthesize what we've covered.", variant: 'primary' as const })
              }
            } else if (showStateQuickReplies && initialSessionState) {
              activePills = getStatePills(initialSessionState.state, initialSessionState.unexploredDomains, pulseCheckRatings)
            }
          }

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
              {activePills.length > 0 && (
                <div className="mt-2">
                  {/* Use EnergyCheckCard for open_day energy check (5 options at start of session) */}
                  {sessionType === 'open_day' && activePills.length >= 4 && messages.length <= 3 ? (
                    <EnergyCheckCard
                      pills={activePills}
                      onSelect={handleSend}
                      disabled={isStreaming}
                    />
                  ) : (
                    <SuggestionPills
                      pills={activePills}
                      onSelect={handleSend}
                      disabled={isStreaming}
                    />
                  )}
                </div>
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
            {(streamingDisplay.pendingBlock || pendingToolCall === 'save_file') && (
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

      {/* Exit confirmation sheet — pause or save-and-finish-later */}
      <ExitConfirmationSheet
        open={showExitSheet}
        isOnboarding={isOnboarding}
        onPause={() => router.push('/home')}
        onContinue={() => setShowExitSheet(false)}
      />
    </div>
  )
}
