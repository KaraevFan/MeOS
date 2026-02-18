import { createClient } from '@/lib/supabase/server'
import { buildConversationContext } from '@/lib/ai/context'
import { DOMAIN_FILE_MAP } from '@/lib/markdown/constants'
import { INTENT_CONTEXT_LABELS } from '@/lib/onboarding'
import { captureException } from '@/lib/monitoring/sentry'
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
  sessionType: z.enum(['life_mapping', 'weekly_checkin', 'ad_hoc', 'close_day']),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(10_000),
  })).min(1).max(100),
  pulseContextMode: z.enum(['none', 'onboarding_baseline', 'checkin_after_rerate', 'checkin_after_skip']).optional(),
  precheckin: z.boolean().optional(),
  exploreDomain: z.string().optional(),
})

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
    name: typeof meta.onboarding_name === 'string' ? meta.onboarding_name : null,
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

  // Build system prompt with context (session type already validated by Zod schema)
  let systemPrompt: string
  try {
    const validatedExploreDomain = exploreDomain && typeof exploreDomain === 'string'
      && exploreDomain in DOMAIN_FILE_MAP
      ? exploreDomain
      : undefined
    systemPrompt = await buildConversationContext(sessionType, user.id, {
      exploreDomain: validatedExploreDomain,
    })

    const mode = pulseContextMode ?? 'none'
    const pulseContext = await buildPulseContext(supabase, user.id, sessionId, mode)
    if (pulseContext) {
      systemPrompt += `\n\n${pulseContext}`
    }

    // Pre-checkin warmup: instruction is server-defined, keyed on a boolean flag
    if (precheckin && sessionType === 'ad_hoc') {
      systemPrompt += `\n\n${PRE_CHECKIN_WARMUP_INSTRUCTION}`
    }

    // Ad-hoc context from session metadata (set once at session creation, not per-request)
    if (sessionType === 'ad_hoc' && !precheckin) {
      const meta = sessionCheck?.metadata as Record<string, unknown> | null
      if (meta?.ad_hoc_context && typeof meta.ad_hoc_context === 'string') {
        systemPrompt += `\n\n${(meta.ad_hoc_context as string).slice(0, 2000)}`
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

  // Stream Claude response via SSE
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const messageStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        })

        messageStream.on('text', (text) => {
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
