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
import { savePulseCheckRatings, pulseRatingToDomainStatus } from '@/lib/supabase/pulse-check'
import { isPushSupported, requestPushPermission } from '@/lib/notifications/push'
import { PinnedContextCard } from './pinned-context-card'
import type { ChatMessage, SessionType, DomainName } from '@/types/chat'
import type { PulseCheckRating } from '@/types/pulse-check'
import type { SessionState, SessionStateResult } from '@/lib/supabase/session-state'
import type { Commitment } from '@/lib/markdown/extract'

interface ChatViewProps {
  userId: string
  sessionType?: SessionType
  initialSessionState?: SessionStateResult
  initialCommitments?: Commitment[]
  exploreDomain?: string
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
  const buttonClass = 'flex-shrink-0 px-3 py-1.5 rounded-full text-sm bg-bg border border-border text-text hover:bg-primary hover:text-white hover:border-primary active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
  const primaryClass = 'flex-shrink-0 px-3 py-1.5 rounded-full text-sm bg-primary/10 border border-primary/30 text-primary font-medium hover:bg-primary hover:text-white hover:border-primary active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed'

  switch (state) {
    case 'mapping_in_progress': {
      let domains = unexploredDomains || []
      if (ratings && ratings.length > 0) {
        const ratingMap = new Map(ratings.map((r) => [r.domain, r.ratingNumeric]))
        domains = [...domains].sort((a, b) => (ratingMap.get(a) ?? 3) - (ratingMap.get(b) ?? 3))
      }
      return (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 px-1 scrollbar-hide">
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
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 px-1 scrollbar-hide">
          <button onClick={() => onSelect("I'd like to start my check-in early.")} disabled={disabled} className={primaryClass}>Start check-in early</button>
          <button onClick={() => onSelect("Something's on my mind.")} disabled={disabled} className={buttonClass}>Something on my mind</button>
          <button onClick={() => onSelect("I'd like to update my life map.")} disabled={disabled} className={buttonClass}>Update my life map</button>
        </div>
      )
    case 'checkin_due':
    case 'checkin_overdue':
      return (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 px-1 scrollbar-hide">
          <button onClick={() => onSelect("Let's do it.")} disabled={disabled} className={primaryClass}>Let&apos;s do it</button>
          <button onClick={() => onSelect("Not right now.")} disabled={disabled} className={buttonClass}>Not right now</button>
        </div>
      )
    case 'mid_conversation':
      return (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 px-1 scrollbar-hide">
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

function getSageOpening(state: string, userName?: string): string {
  const name = userName ? ` ${userName.charAt(0).toUpperCase() + userName.slice(1)}` : ''
  switch (state) {
    case 'new_user':
      return SAGE_OPENING_NEW_USER
    case 'mapping_in_progress':
      return `Welcome back${name ? ',' + name : ''}. Want to keep going with your life map?`
    case 'mapping_complete':
      return `Hey${name ? ',' + name : ''}. I'm here whenever. Anything on your mind?`
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

export function ChatView({ userId, sessionType = 'life_mapping', initialSessionState, initialCommitments, exploreDomain }: ChatViewProps) {
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

  const scrollRef = useRef<HTMLDivElement>(null)
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

  // Initialize session
  useEffect(() => {
    async function init() {
      try {
        // Check for active session
        const { data: activeSession } = await supabase
          .from('sessions')
          .select('*')
          .eq('user_id', userId)
          .eq('session_type', sessionType)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (activeSession) {
          setSessionId(activeSession.id)

          // Load existing messages
          const { data: existingMessages } = await supabase
            .from('messages')
            .select('*')
            .eq('session_id', activeSession.id)
            .order('created_at', { ascending: true })

          if (existingMessages && existingMessages.length > 0) {
            setMessages(existingMessages.map((m) => ({
              id: m.id,
              sessionId: m.session_id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
              hasStructuredBlock: m.has_structured_block,
              createdAt: m.created_at,
            })))

            // Restore explored domains
            if (activeSession.domains_explored) {
              setDomainsExplored(new Set(activeSession.domains_explored as DomainName[]))
            }
          }

          // Show pulse check if new user hasn't completed it yet
          // (handles page refresh, HMR, and StrictMode double-mount)
          const isNewUser = initialSessionState?.state === 'new_user'
          const hasNoUserMessages = !existingMessages?.some((m) => m.role === 'user')
          if (isNewUser && sessionType === 'life_mapping' && hasNoUserMessages) {
            const { data: ratings } = await supabase
              .from('pulse_check_ratings')
              .select('id')
              .eq('session_id', activeSession.id)
              .limit(1)

            if (!ratings || ratings.length === 0) {
              setShowPulseCheck(true)
            }
          }
        } else {
          // Create new session
          const { data: newSession } = await supabase
            .from('sessions')
            .insert({
              user_id: userId,
              session_type: sessionType,
              status: 'active',
            })
            .select()
            .single()

          if (newSession) {
            setSessionId(newSession.id)

            const state = initialSessionState?.state || 'new_user'
            const needsPulseCheck = state === 'new_user' && sessionType === 'life_mapping'

            // Add Sage's opening message
            const openingMessage = getSageOpening(state, initialSessionState?.userName)

            const { data: savedMsg } = await supabase
              .from('messages')
              .insert({
                session_id: newSession.id,
                role: 'assistant',
                content: openingMessage,
                has_structured_block: false,
              })
              .select()
              .single()

            if (savedMsg) {
              setMessages([{
                id: savedMsg.id,
                sessionId: savedMsg.session_id,
                role: 'assistant',
                content: savedMsg.content,
                hasStructuredBlock: false,
                createdAt: savedMsg.created_at,
              }])
            }

            // Show pulse check for new users
            if (needsPulseCheck) {
              setShowPulseCheck(true)
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
  }, [userId, sessionType])

  async function handlePulseCheckSubmit(ratings: PulseCheckRating[]) {
    if (!sessionId) return

    setPulseCheckSubmitting(true)
    setPulseCheckError(null)

    try {
      // Save ratings to DB
      await savePulseCheckRatings(supabase, sessionId, userId, ratings, true)

      // Seed life_map_domains with initial status
      const lifeMap = await getOrCreateLifeMap(supabase, userId)
      for (const rating of ratings) {
        await upsertDomain(supabase, lifeMap.id, {
          domain: rating.domain as DomainName,
          currentState: '',
          whatsWorking: [],
          whatsNotWorking: [],
          keyTension: '',
          statedIntention: '',
          status: pulseRatingToDomainStatus(rating.rating),
        })
      }

      // Store ratings in state for later use
      setPulseCheckRatings(ratings)
      setShowPulseCheck(false)

      // Build pulse check context for Sage's pattern-read response
      const ratingsText = ratings
        .map((r) => `- ${r.domain}: ${r.rating} (${r.ratingNumeric}/5)`)
        .join('\n')

      const pulseContext = `The user just completed a life pulse check. Here are their self-ratings:
${ratingsText}

Your job now:
1. Briefly reflect back the overall pattern you see (1-2 sentences). Note any contrasts.
2. Propose starting with the domain that seems most pressing (lowest rated), but give the user choice.
3. Ask a specific opening question — NOT "tell me about X" but something like "You rated X as 'struggling' — what's the main source of tension there?"

Do NOT list all 8 domains back. Keep it conversational.`

      // Trigger Sage's response without showing a user message
      triggerSageResponse(pulseContext)
    } catch {
      setPulseCheckError("Couldn't save your ratings. Tap to try again.")
    } finally {
      setPulseCheckSubmitting(false)
    }
  }

  // Handle ?explore=<domain> from life map CTA
  const exploreHandled = useRef(false)
  useEffect(() => {
    if (exploreDomain && sessionId && !isLoading && !exploreHandled.current) {
      exploreHandled.current = true
      sendMessage(`Let's explore ${exploreDomain}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exploreDomain, sessionId, isLoading])

  async function triggerSageResponse(pulseContext: string) {
    if (!sessionId || isStreaming) return

    setIsStreaming(true)
    setStreamingText('')
    setError(null)

    // Build message array from existing messages (no user trigger message)
    const apiMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          sessionType,
          messages: apiMessages,
          pulseCheckContext: pulseContext,
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

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

      // Finalize the assistant message
      const hasBlock = accumulated.includes('[FILE_UPDATE') ||
        accumulated.includes('[DOMAIN_SUMMARY]') ||
        accumulated.includes('[LIFE_MAP_SYNTHESIS]') ||
        accumulated.includes('[SESSION_SUMMARY]')

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        sessionId,
        role: 'assistant',
        content: accumulated,
        hasStructuredBlock: hasBlock,
        createdAt: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMessage])
      setStreamingText('')

      // Save assistant message to DB
      await supabase.from('messages').insert({
        session_id: sessionId,
        role: 'assistant',
        content: accumulated,
        has_structured_block: hasBlock,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
    } finally {
      setIsStreaming(false)
    }
  }

  async function sendMessage(text: string, retry = false, extraSystemContext?: string) {
    if (!sessionId || isStreaming) return

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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          sessionType,
          messages: apiMessages,
          ...(extraSystemContext ? { pulseCheckContext: extraSystemContext } : {}),
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

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
            if (parsed.error) {
              throw new Error(parsed.error)
            }
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

      // Stream complete — finalize the message
      const hasBlock = accumulated.includes('[FILE_UPDATE') ||
        accumulated.includes('[DOMAIN_SUMMARY]') ||
        accumulated.includes('[LIFE_MAP_SYNTHESIS]') ||
        accumulated.includes('[SESSION_SUMMARY]')

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        sessionId,
        role: 'assistant',
        content: accumulated,
        hasStructuredBlock: hasBlock,
        createdAt: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMessage])
      setStreamingText('')

      // Save assistant message to DB
      await supabase.from('messages').insert({
        session_id: sessionId,
        role: 'assistant',
        content: accumulated,
        has_structured_block: hasBlock,
      })

      // Handle structured blocks — persist to life map and manage session lifecycle
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

            // Mark onboarding complete
            await supabase
              .from('users')
              .update({ onboarding_completed: true })
              .eq('id', userId)

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
          handleAllFileUpdates(ufs, updates, sessionType).then((results) => {
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
            updateDomainsExplored(supabase, sessionId, [...newDomains]).catch(() => {
              console.error('Failed to update domains explored')
            })
          }

          // Handle session lifecycle for synthesis/check-in file updates
          const hasOverview = updates.some((u) => u.fileType === 'overview')
          const hasCheckIn = updates.some((u) => u.fileType === 'check-in')

          if (hasOverview) {
            completeSession(supabase, sessionId).catch(() => {
              console.error('Failed to complete session')
            })
            Promise.resolve(
              supabase
                .from('users')
                .update({ onboarding_completed: true })
                .eq('id', userId)
            ).catch(() => console.error('Failed to mark onboarding complete'))

            if (isPushSupported() && Notification.permission === 'default') {
              setShowPushPrompt(true)
            }
          } else if (hasCheckIn) {
            completeSession(supabase, sessionId).catch(() => {
              console.error('Failed to complete session')
            })
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
      setRetryCount((prev) => prev + 1)
    } finally {
      setIsStreaming(false)
    }
  }

  function handleCorrectDomain(domain: DomainName) {
    setPrefillText(`About my ${domain} card — `)
  }

  function handleSend(text: string) {
    setPrefillText(undefined)
    sendMessage(text)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-secondary">Loading conversation...</div>
      </div>
    )
  }

  // Parse streaming text for display
  const streamingDisplay = streamingText
    ? parseStreamingChunk(streamingText)
    : null

  return (
    <div className="flex flex-col h-full">
      {/* Pinned context card for weekly check-ins */}
      {sessionType === 'weekly_checkin' && initialCommitments && initialCommitments.length > 0 && (
        <PinnedContextCard commitments={initialCommitments} />
      )}

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((message, index) => {
          const parsed = parseMessage(message.content)
          const isLastMessage = index === messages.length - 1
          const hasDomainCard = parsed.segments.some(
            (s) => s.type === 'block' && (
              s.blockType === 'domain_summary' ||
              (s.blockType === 'file_update' && s.data?.fileType === 'domain')
            )
          )
          const showDomainQuickReplies = isLastMessage && hasDomainCard && sessionType === 'life_mapping' && !isStreaming

          // Show state-aware quick replies after opening message (first assistant msg, no user messages yet)
          const hasNoUserMessages = !messages.some((m) => m.role === 'user')
          const isOpeningMessage = index === 0 && message.role === 'assistant'
          const showStateQuickReplies = isLastMessage && isOpeningMessage && hasNoUserMessages && !isStreaming && !showPulseCheck

          return (
            <div key={message.id}>
              <MessageBubble
                message={message}
                parsedContent={parsed}
                onCorrectDomain={handleCorrectDomain}
              />
              {showDomainQuickReplies && (
                <div className="mt-3">
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

        {/* Pulse check card */}
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

      {/* Input area */}
      <ChatInput
        onSend={handleSend}
        disabled={isStreaming || showPulseCheck}
        prefill={prefillText}
        placeholder={showPulseCheck ? 'Rate your life areas above to begin.' : undefined}
      />
    </div>
  )
}
