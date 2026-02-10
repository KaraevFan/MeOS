'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseMessage, parseStreamingChunk } from '@/lib/ai/parser'
import { MessageBubble } from './message-bubble'
import { TypingIndicator } from './typing-indicator'
import { ChatInput } from './chat-input'
import { BuildingCardPlaceholder } from './building-card-placeholder'
import { QuickReplyButtons } from './quick-reply-buttons'
import { getOrCreateLifeMap, upsertDomain, updateLifeMapSynthesis } from '@/lib/supabase/life-map'
import { completeSession, updateDomainsExplored, updateSessionSummary } from '@/lib/supabase/sessions'
import type { ChatMessage, SessionType, DomainName } from '@/types/chat'

interface ChatViewProps {
  userId: string
  sessionType?: SessionType
}

const SAGE_OPENING_LIFE_MAPPING = `Hey — I'm Sage. I'm here to help you get a clearer picture of where you are in life and where you want to go. There's no right way to do this. I'll ask you some questions, you talk through whatever comes up, and I'll help organize it as we go. You'll see your life map building in real time. We can go as deep or as light as you want — you're in control of the pace. Sound good?

So — before we get into specifics, how are you feeling about life right now? Just the honest, unfiltered version.`

const SAGE_OPENING_CHECKIN = `Hey, welcome back. How are you doing?`

export function ChatView({ userId, sessionType = 'life_mapping' }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingText, setStreamingText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [domainsExplored, setDomainsExplored] = useState<Set<DomainName>>(new Set())
  const [prefillText, setPrefillText] = useState<string | undefined>()
  const [retryCount, setRetryCount] = useState(0)

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

            // Add Sage's opening message
            const openingMessage = sessionType === 'life_mapping'
              ? SAGE_OPENING_LIFE_MAPPING
              : SAGE_OPENING_CHECKIN

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

  async function sendMessage(text: string, retry = false) {
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
      const hasBlock = accumulated.includes('[DOMAIN_SUMMARY]') ||
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

        if (parsed.block?.type === 'domain_summary') {
          const domain = parsed.block.data.domain
          const newDomains = new Set(domainsExplored)
          newDomains.add(domain)
          setDomainsExplored(newDomains)

          // Persist domain to life map
          try {
            const lifeMap = await getOrCreateLifeMap(supabase, userId)
            await upsertDomain(supabase, lifeMap.id, parsed.block.data)
            await updateDomainsExplored(supabase, sessionId, [...newDomains])
          } catch {
            // Non-critical — don't break the conversation
            console.error('Failed to persist domain to life map')
          }
        }

        if (parsed.block?.type === 'life_map_synthesis') {
          // Persist synthesis and complete session
          try {
            const lifeMap = await getOrCreateLifeMap(supabase, userId)
            await updateLifeMapSynthesis(supabase, lifeMap.id, parsed.block.data)
            await completeSession(supabase, sessionId)

            // Mark onboarding complete
            await supabase
              .from('users')
              .update({ onboarding_completed: true })
              .eq('id', userId)
          } catch {
            console.error('Failed to persist synthesis')
          }
        }

        if (parsed.block?.type === 'session_summary') {
          // Persist session summary and complete session (weekly check-in)
          try {
            const data = parsed.block.data
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
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((message, index) => {
          const parsed = parseMessage(message.content)
          const isLastMessage = index === messages.length - 1
          const hasDomainCard = parsed.block?.type === 'domain_summary'
          const showQuickReplies = isLastMessage && hasDomainCard && sessionType === 'life_mapping' && !isStreaming

          return (
            <div key={message.id}>
              <MessageBubble
                message={message}
                parsedContent={parsed}
                onCorrectDomain={handleCorrectDomain}
              />
              {showQuickReplies && (
                <div className="mt-3">
                  <QuickReplyButtons
                    domainsExplored={domainsExplored}
                    onSelect={handleSend}
                    disabled={isStreaming}
                  />
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
            {streamingDisplay.pendingBlock && (
              <div className="w-full max-w-[95%]">
                <BuildingCardPlaceholder />
              </div>
            )}
          </>
        )}

        {/* Typing indicator — before first token */}
        {isStreaming && !streamingText && <TypingIndicator />}

        {/* Error state */}
        {error && !isStreaming && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-4 py-3 bg-bg-card border border-accent-terra/20">
              <p className="text-accent-terra text-sm">
                {retryCount >= 3
                  ? "Sage is having trouble right now. Your conversation is saved — come back and pick up where you left off."
                  : "Sage couldn't respond. Tap to retry."}
              </p>
              {retryCount < 3 && (
                <button
                  onClick={() => {
                    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
                    if (lastUserMsg) sendMessage(lastUserMsg.content, true)
                  }}
                  className="mt-2 text-sm text-primary font-medium hover:underline"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <ChatInput
        onSend={handleSend}
        disabled={isStreaming}
        prefill={prefillText}
      />
    </div>
  )
}
