/**
 * SSE Event Protocol:
 * - { text: string }              — Streaming token from Claude
 * - { error: string }             — Error message
 * - { sessionCompleted: true }    — Session was completed server-side
 * - { modeChange: string }        — Entered a structured arc (e.g. 'open_day')
 * - { arcCompleted: string }      — Structured arc completed, returned to open conversation
 * - [DONE]                        — Terminal sentinel, stream ends
 */
import { createClient } from '@/lib/supabase/server'
import { buildConversationContext, expireStaleOpenDaySessions, expireStaleCloseDaySessions, expireStaleOpenConversations } from '@/lib/ai/context'
import { DOMAIN_FILE_MAP } from '@/lib/markdown/constants'
import { INTENT_CONTEXT_LABELS } from '@/lib/onboarding'
import { captureException } from '@/lib/monitoring/sentry'
import { getUserTimezone } from '@/lib/get-user-timezone'
import { detectTerminalArtifact } from '@/lib/ai/completion-detection'
import { completeSession } from '@/lib/supabase/sessions'
import type { SessionMetadata, CompletedArc, StructuredArcType } from '@/types/chat'
import { generateSessionSummary } from '@/lib/ai/generate-session-summary'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { PulseContextMode } from '@/types/chat'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Simple in-memory rate limiter: max requests per user per window
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 20
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  entry.count++
  return true
}

const ChatRequestSchema = z.object({
  sessionId: z.string().uuid(),
  sessionType: z.enum(['life_mapping', 'weekly_checkin', 'open_conversation', 'close_day', 'open_day', 'quick_capture']),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(10_000),
  })).max(100),
  pulseContextMode: z.enum(['none', 'onboarding_baseline', 'checkin_after_rerate', 'checkin_after_skip']).optional(),
  precheckin: z.boolean().optional(),
  exploreDomain: z.string().optional(),
}).refine(
  // open_day sessions can start with zero messages (AI generates the opening)
  (data) => data.messages.length > 0 || data.sessionType === 'open_day' || data.sessionType === 'open_conversation',
  { message: 'Messages array must have at least 1 item', path: ['messages'] },
)

const PRE_CHECKIN_WARMUP_INSTRUCTION = `The user is doing a quick pre-checkin warmup before their weekly reflection.
Guide a 2-minute prep with exactly two short reflective questions:
1) "What's felt most true this week?"
2) "What's one thing you don't want to avoid in your check-in?"
After they respond, offer to start the weekly check-in.`

function extractOnboardingMeta(metadata: unknown): {
  intent: string | null
  name: string | null
  quickReplies: { exchange: number; selectedOption: string }[]
} {
  if (!metadata || typeof metadata !== 'object') {
    return { intent: null, name: null, quickReplies: [] }
  }
  const meta = metadata as Record<string, unknown>
  const quickReplies: { exchange: number; selectedOption: string }[] = []
  if (Array.isArray(meta.onboarding_quick_replies)) {
    for (const item of meta.onboarding_quick_replies) {
      if (
        item && typeof item === 'object' &&
        typeof (item as Record<string, unknown>).exchange === 'number' &&
        typeof (item as Record<string, unknown>).selectedOption === 'string'
      ) {
        quickReplies.push(item as { exchange: number; selectedOption: string })
      }
    }
  }
  return {
    intent: typeof meta.onboarding_intent === 'string' ? meta.onboarding_intent : null,
    name: typeof meta.onboarding_name === 'string' ? meta.onboarding_name.replace(/[<>]/g, '').slice(0, 50) : null,
    quickReplies,
  }
}

async function buildPulseContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sessionId: string,
  mode: PulseContextMode
): Promise<string | null> {
  if (mode === 'none') return null

  if (mode === 'onboarding_baseline') {
    const { data: session } = await supabase
      .from('sessions')
      .select('metadata')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle()

    const onboarding = extractOnboardingMeta(session?.metadata)

    const { data: sessionRows } = await supabase
      .from('pulse_check_ratings')
      .select('domain_name, rating, rating_numeric')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .eq('is_baseline', true)
      .order('created_at', { ascending: true })

    let pulseRows = sessionRows ?? []
    if (pulseRows.length === 0) {
      const { data: latestBaselineSession } = await supabase
        .from('pulse_check_ratings')
        .select('session_id')
        .eq('user_id', userId)
        .eq('is_baseline', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestBaselineSession?.session_id) {
        const { data: latestRows } = await supabase
          .from('pulse_check_ratings')
          .select('domain_name, rating, rating_numeric')
          .eq('user_id', userId)
          .eq('session_id', latestBaselineSession.session_id)
          .eq('is_baseline', true)
          .order('created_at', { ascending: true })
        pulseRows = latestRows ?? []
      }
    }

    if (pulseRows.length === 0) return null

    const ratingsText = pulseRows
      .map((r) => `- ${r.domain_name}: ${r.rating} (${r.rating_numeric}/5)`)
      .join('\n')

    const contextParts: string[] = []
    if (onboarding.name) {
      contextParts.push(`The user's name is ${onboarding.name}. Greet them by name.`)
    }
    if (onboarding.intent) {
      const intentLabel = INTENT_CONTEXT_LABELS[onboarding.intent] || "they didn't specify"
      contextParts.push(`What brought them here: ${intentLabel}.`)
    }
    if (onboarding.quickReplies.length > 0) {
      const replyText = onboarding.quickReplies.map((r) => `"${r.selectedOption}"`).join(', ')
      contextParts.push(`In our brief intro conversation, they said: ${replyText}.`)
    }

    const onboardingContext = contextParts.length > 0
      ? `\n\nONBOARDING CONTEXT:\n${contextParts.join('\n')}\nReference this context naturally — weave it in, don't robotically list things.`
      : ''

    return `The user just completed their onboarding pulse check. Here are their self-ratings:
${ratingsText}
${onboardingContext}
CRITICAL: The user has ALREADY rated all 8 domains. DO NOT ask them to rate anything. Never say "Rate each of these areas" or ask them to score or evaluate domains. You have their ratings — use them.

Your job now:
1. Briefly reflect back the overall pattern you see (1-2 sentences). Note any contrasts.
2. Propose starting with the domain that seems most pressing (lowest rated), but give the user choice.
3. Ask a specific opening question — NOT "tell me about X" but something like "You rated X as 'struggling' — what's the main source of tension there?"

Do NOT list all 8 domains back. Keep it conversational.`
  }

  if (mode === 'checkin_after_rerate') {
    const { data: rows } = await supabase
      .from('pulse_check_ratings')
      .select('domain_name, rating, rating_numeric')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .eq('is_baseline', false)
      .order('created_at', { ascending: true })

    if (!rows || rows.length === 0) {
      return 'The user just re-rated their pulse. Proceed with the closing synthesis: write the FILE_UPDATE blocks.'
    }

    const ratingsText = rows
      .map((r) => `- ${r.domain_name}: ${r.rating} (${r.rating_numeric}/5)`)
      .join('\n')

    return `The user just re-rated their pulse. Here are the updated ratings:
${ratingsText}

Now proceed with the closing synthesis: write the FILE_UPDATE blocks.`
  }

  if (mode === 'checkin_after_skip') {
    return 'The user skipped the pulse re-rating. Proceed with the closing synthesis: write the FILE_UPDATE blocks.'
  }

  // Exhaustive check: ensures all PulseContextMode values are handled
  const _exhaustive: never = mode
  return _exhaustive
}

export async function POST(request: Request) {
  // Validate auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Rate limit
  if (!checkRateLimit(user.id)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Parse and validate request body
  let body: z.infer<typeof ChatRequestSchema>

  try {
    const raw = await request.json()
    body = ChatRequestSchema.parse(raw)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    captureException('Invalid JSON body in /api/chat', { tags: { route: '/api/chat' } })
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { sessionId, sessionType, messages, pulseContextMode, precheckin, exploreDomain } = body

  // Validate session ownership (also fetch metadata for ad-hoc context)
  const { data: sessionCheck } = await supabase
    .from('sessions')
    .select('id, metadata')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!sessionCheck) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Extract session metadata once, used for active_mode, pending_completion, ad_hoc_context
  const existingMetadata = (sessionCheck.metadata ?? {}) as SessionMetadata

  // Validate and extract active_mode once — reused in context building and post-stream processing
  const VALID_ARC_MODES: readonly StructuredArcType[] = ['open_day', 'close_day', 'weekly_checkin', 'life_mapping']
  const activeMode: StructuredArcType | null = typeof existingMetadata.active_mode === 'string'
    && VALID_ARC_MODES.includes(existingMetadata.active_mode as StructuredArcType)
    ? existingMetadata.active_mode as StructuredArcType
    : null

  // Resolve user timezone for date-aware context injection
  const timezone = await getUserTimezone(supabase, user.id)

  // Expire stale sessions before building context
  if (sessionType === 'close_day') {
    await expireStaleOpenDaySessions(user.id, timezone)
  }
  if (sessionType === 'open_day') {
    await expireStaleCloseDaySessions(user.id, timezone)
  }
  if (sessionType === 'open_conversation') {
    await expireStaleOpenConversations(user.id)
  }

  // Build system prompt with context (session type already validated by Zod schema)
  let systemPrompt: string
  try {
    const validatedExploreDomain = exploreDomain && typeof exploreDomain === 'string'
      && exploreDomain in DOMAIN_FILE_MAP
      ? exploreDomain
      : undefined
    systemPrompt = await buildConversationContext(sessionType, user.id, {
      exploreDomain: validatedExploreDomain,
      timezone,
      activeMode,
    })

    const mode = pulseContextMode ?? 'none'
    const pulseContext = await buildPulseContext(supabase, user.id, sessionId, mode)
    if (pulseContext) {
      systemPrompt += `\n\n${pulseContext}`
    }

    // Pre-checkin warmup: instruction is server-defined, keyed on a boolean flag
    if (precheckin && sessionType === 'open_conversation') {
      systemPrompt += `\n\n${PRE_CHECKIN_WARMUP_INSTRUCTION}`
    }

    // Open conversation context from session metadata (set once at session creation, not per-request)
    if (sessionType === 'open_conversation' && !precheckin) {
      if (existingMetadata.ad_hoc_context && typeof existingMetadata.ad_hoc_context === 'string') {
        systemPrompt += `\n\n<user_data>\n${existingMetadata.ad_hoc_context.slice(0, 2000)}\n</user_data>`
      }
    }

    // Inject completed arcs context so Sage knows what just happened when returning from a mode
    if (sessionType === 'open_conversation' && !activeMode) {
      const completedArcs: CompletedArc[] = Array.isArray(existingMetadata.completed_arcs) ? existingMetadata.completed_arcs as CompletedArc[] : []
      if (completedArcs.length > 0) {
        const arcLabels: Record<string, string> = {
          open_day: 'morning session (Open the Day)',
          close_day: 'evening reflection (Close the Day)',
          weekly_checkin: 'weekly check-in',
          life_mapping: 'life mapping session',
        }
        const latest = completedArcs[completedArcs.length - 1]
        const label = arcLabels[latest.mode] || latest.mode
        systemPrompt += `\n\nCONTEXT: The user just completed a ${label} within this conversation. Acknowledge it briefly and stay available — don't re-greet or re-introduce yourself. See "Returning From a Completed Arc" in your skill instructions.`
      }
    }
  } catch (error) {
    captureException(error, {
      tags: { route: '/api/chat', stage: 'build_context' },
      extra: { sessionId, sessionType },
    })
    return new Response(JSON.stringify({ error: 'Failed to build conversation context' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Check if this close_day session has a pending_completion flag from Phase A
  const isPendingCloseDay = sessionType === 'close_day' && existingMetadata.pending_completion === true

  // Stream Claude response via SSE
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // open_day sessions start with zero user messages — Sage speaks first.
        // Anthropic API requires ≥1 message, so inject a synthetic user turn.
        const apiMessages = messages.length > 0
          ? messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
          : [{ role: 'user' as const, content: `[Start ${sessionType} session]` }]

        const messageStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 1024,
          system: systemPrompt,
          messages: apiMessages,
        })

        // Accumulate response text for post-stream completion detection
        let accumulated = ''

        messageStream.on('text', (text) => {
          accumulated += text
          const data = JSON.stringify({ text })
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        })

        messageStream.on('error', (error) => {
          const message = error instanceof Error ? error.message : 'Unknown error'
          const data = JSON.stringify({ error: message })
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          controller.close()
        })

        await messageStream.finalMessage()

        // Post-stream: detect terminal artifacts and complete session server-side
        try {
          if (isPendingCloseDay) {
            // close_day Phase B: previous response emitted journal, user confirmed.
            // If this response has no new journal and no suggested replies, session is done.
            const hasNewJournal = accumulated.includes('[FILE_UPDATE type="daily-log"')
            const hasSuggestedReplies = accumulated.includes('[SUGGESTED_REPLIES]')

            if (!hasNewJournal && !hasSuggestedReplies) {
              await completeSession(supabase, sessionId)
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { pending_completion: _pendingFlag, ...cleanMetadata } = existingMetadata
              await supabase.from('sessions')
                .update({ metadata: cleanMetadata })
                .eq('id', sessionId)
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sessionCompleted: true })}\n\n`))

              // Generate summary with the already-authenticated client
              await generateSessionSummary(supabase, sessionId).catch((err) => {
                captureException(err, { tags: { route: '/api/chat', stage: 'summary_generation' }, extra: { sessionId } })
              })
            }
          } else {
            const signal = detectTerminalArtifact(accumulated, sessionType, activeMode)

            if (signal === 'complete') {
              if (activeMode && sessionType === 'open_conversation') {
                // Arc completed within open_conversation — return to base layer
                const completedArcs: CompletedArc[] = Array.isArray(existingMetadata.completed_arcs)
                  ? existingMetadata.completed_arcs as CompletedArc[]
                  : []
                completedArcs.push({ mode: activeMode, completed_at: new Date().toISOString() })
                const arcMetadata = {
                  ...existingMetadata,
                  active_mode: null,
                  completed_arcs: completedArcs,
                }
                await supabase.from('sessions')
                  .update({ metadata: arcMetadata })
                  .eq('id', sessionId)
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ arcCompleted: activeMode })}\n\n`))
              } else {
                // Standard session completion
                await completeSession(supabase, sessionId)
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sessionCompleted: true })}\n\n`))

                // Generate summary with the already-authenticated client
                await generateSessionSummary(supabase, sessionId).catch((err) => {
                  captureException(err, { tags: { route: '/api/chat', stage: 'summary_generation' }, extra: { sessionId } })
                })
              }
            } else if (signal === 'pending_completion') {
              // close_day Phase A: journal emitted, awaiting user confirmation
              await supabase.from('sessions')
                .update({ metadata: { ...existingMetadata, pending_completion: true } })
                .eq('id', sessionId)
            }
          }

          // Detect [ENTER_MODE] signal for dynamic mode transitions
          const enterModeMatch = accumulated.match(/\[ENTER_MODE:\s*(\w+)\]/)
          if (enterModeMatch) {
            const newMode = enterModeMatch[1]
            if (VALID_ARC_MODES.includes(newMode as StructuredArcType)) {
              await supabase.from('sessions')
                .update({ metadata: { ...existingMetadata, active_mode: newMode } })
                .eq('id', sessionId)
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ modeChange: newMode })}\n\n`))
            }
          }
        } catch (completionError) {
          // Non-fatal: log but don't break the stream
          captureException(completionError, {
            tags: { route: '/api/chat', stage: 'completion_detection' },
            extra: { sessionId, sessionType },
          })
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (error) {
        captureException(error, {
          tags: { route: '/api/chat', stage: 'stream' },
          extra: { sessionId, sessionType },
        })
        const message = error instanceof Error ? error.message : 'Failed to connect to AI'
        const data = JSON.stringify({ error: message })
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
