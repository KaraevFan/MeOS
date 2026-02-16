import { createClient } from '@/lib/supabase/server'
import { buildConversationContext } from '@/lib/ai/context'
import Anthropic from '@anthropic-ai/sdk'
import type { SessionType } from '@/types/chat'

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

  // Parse request body
  let body: {
    sessionId: string
    sessionType: SessionType
    messages: { role: 'user' | 'assistant'; content: string }[]
    pulseCheckContext?: string
  }

  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { sessionId, sessionType, messages, pulseCheckContext } = body

  // Validate session ownership
  const { data: sessionCheck } = await supabase
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!sessionCheck) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Validate session type
  const VALID_SESSION_TYPES: ReadonlySet<string> = new Set(['life_mapping', 'weekly_checkin', 'ad_hoc'])
  if (!VALID_SESSION_TYPES.has(sessionType)) {
    return new Response(JSON.stringify({ error: 'Invalid session type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Build system prompt with context
  let systemPrompt: string
  try {
    systemPrompt = await buildConversationContext(sessionType, user.id)

    // Inject pulse check context if provided (length-limited to prevent prompt injection abuse)
    // TODO: Reconstruct pulse context server-side from DB instead of accepting client text
    if (pulseCheckContext && typeof pulseCheckContext === 'string') {
      const MAX_PULSE_CONTEXT_LENGTH = 1000
      const sanitized = pulseCheckContext.slice(0, MAX_PULSE_CONTEXT_LENGTH)
      systemPrompt += `\n\n${sanitized}`
    }
  } catch {
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
