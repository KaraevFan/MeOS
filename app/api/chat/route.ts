/**
 * SSE Event Protocol:
 * - { text: string }              — Streaming token from Claude
 * - { error: string }             — Error message
 * - { toolCall: { id, name } }    — Tool execution starting (client shows shimmer)
 * - { roundBoundary: true }       — Paragraph break between agentic loop rounds
 * - { showPulseCheck: {...} }     — Split-conversation: render pulse check UI
 * - { showOptions: {...} }        — Split-conversation: render option pills
 * - { domainUpdate: {domain,updatedRating} } — Domain rating updated (spider chart)
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
import { scheduleMidDayNudge } from '@/lib/notifications/schedule-nudge'
import { getToolDefinitions } from '@/lib/ai/tool-definitions'
import { executeTool, type ToolResult } from '@/lib/ai/tool-executor'
import type { ToolExecutionContext } from '@/lib/ai/tool-executor'
import type { SessionType, SessionMetadata, CompletedArc, StructuredArcType, PulseContextMode } from '@/types/chat'
import { generateSessionSummary } from '@/lib/ai/generate-session-summary'
import Anthropic from '@anthropic-ai/sdk'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages/messages'
import { z } from 'zod'

// Vercel serverless function timeout — must be >= MAX_REQUEST_DURATION_MS + buffer
export const maxDuration = 60

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
      return 'The user just re-rated their pulse. Proceed with the closing synthesis: save the closing artifacts using the save_file tool.'
    }

    const ratingsText = rows
      .map((r) => `- ${r.domain_name}: ${r.rating} (${r.rating_numeric}/5)`)
      .join('\n')

    return `The user just re-rated their pulse. Here are the updated ratings:
${ratingsText}

Now proceed with the closing synthesis: save the closing artifacts using the save_file tool.`
  }

  if (mode === 'checkin_after_skip') {
    return 'The user skipped the pulse re-rating. Proceed with the closing synthesis: save the closing artifacts using the save_file tool.'
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

  // Stream Claude response via SSE with agentic tool-use loop
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // open_day sessions start with zero user messages — Sage speaks first.
        // Anthropic API requires ≥1 message, so inject a synthetic user turn.
        const apiMessages: Anthropic.MessageParam[] = messages.length > 0
          ? messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
          : [{ role: 'user' as const, content: `[Start ${sessionType} session]` }]

        // Get tool definitions for this session context
        const toolDefs = getToolDefinitions(sessionType, activeMode)

        // Build tool execution context
        const toolContext: ToolExecutionContext = {
          userId: user.id,
          sessionId,
          sessionType: sessionType as SessionType,
          activeMode,
          timezone,
          supabase,
          metadata: existingMetadata,
          toolCallCount: { value: 0 },
        }

        // Agentic loop: multi-round streaming with tool execution
        const MAX_TOOL_ITERATIONS = 5
        const REQUEST_START = Date.now()
        const MAX_REQUEST_DURATION_MS = 55_000 // 5s buffer before Vercel 60s timeout
        let loopMessages: Anthropic.MessageParam[] = apiMessages
        let iteration = 0
        let consecutiveFailures = 0
        let accumulated = ''

        // Track lifecycle events from tool execution
        let completedViaToolSession = false
        let completedViaToolArc: string | null = null
        let enteredArcViaTool: string | null = null
        let dayPlanIntention: string | null = null

        while (iteration < MAX_TOOL_ITERATIONS) {
          // Wall-clock timeout guard
          if (Date.now() - REQUEST_START > MAX_REQUEST_DURATION_MS) {
            enqueue({ text: '\n\n[Wrapping up — session took longer than expected.]' })
            break
          }

          // First iteration gets full budget for synthesis + tool calls; subsequent rounds need less
          const maxTokens = iteration === 0 ? 4096 : 2048

          const messageStream = anthropic.messages.stream({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: loopMessages,
            tools: toolDefs,
          })

          // Wall-clock timeout: abort stream if insufficient time remains before Vercel timeout
          const elapsed = Date.now() - REQUEST_START
          const remainingMs = MAX_REQUEST_DURATION_MS - elapsed
          const streamTimeout = setTimeout(() => messageStream.controller.abort(), remainingMs)

          // Abort propagation on client disconnect
          const abortHandler = () => messageStream.controller.abort()
          request.signal.addEventListener('abort', abortHandler)

          // Stream text events to client
          messageStream.on('text', (text) => {
            accumulated += text
            enqueue({ text })
          })

          // Wait for stream to complete
          let finalMessage: Anthropic.Message
          try {
            finalMessage = await messageStream.finalMessage()
          } catch (streamError) {
            const msg = streamError instanceof Error ? streamError.message : 'Unknown error'
            enqueue({ error: msg })
            break
          } finally {
            clearTimeout(streamTimeout)
            request.signal.removeEventListener('abort', abortHandler)
          }

          // Handle max_tokens truncation
          if (finalMessage.stop_reason === 'max_tokens') {
            enqueue({ text: '\n\n[Response was cut short. Please continue the conversation.]' })
            break
          }

          // Check for tool calls — only continue loop if Claude explicitly wants tool use
          const toolUseBlocks = finalMessage.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
          )

          if (finalMessage.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
            break
          }

          // Check for split-conversation tools (pause stream, client renders UI)
          const splitTool = toolUseBlocks.find(
            (b) => b.name === 'show_pulse_check' || b.name === 'show_options'
          )
          if (splitTool) {
            const splitInput = splitTool.input as Record<string, unknown>
            if (splitTool.name === 'show_pulse_check') {
              enqueue({
                showPulseCheck: {
                  context: splitInput?.context ?? '',
                  toolUseId: splitTool.id,
                },
              })
            } else {
              enqueue({
                showOptions: {
                  options: splitInput?.options ?? [],
                  toolUseId: splitTool.id,
                },
              })
            }
            break // Client will resume with a new API call containing tool_result
          }

          // Emit toolCall events for client shimmer indicator
          for (const toolUse of toolUseBlocks) {
            enqueue({ toolCall: { id: toolUse.id, name: toolUse.name } })
          }

          // Execute tools: data tools (save_file) first, then lifecycle tools (complete_session, enter_structured_arc).
          // This prevents session completion racing with in-flight file writes.
          const LIFECYCLE_TOOLS = new Set(['complete_session', 'enter_structured_arc'])
          const dataBlocks = toolUseBlocks.filter((b) => !LIFECYCLE_TOOLS.has(b.name))
          const lifecycleBlocks = toolUseBlocks.filter((b) => LIFECYCLE_TOOLS.has(b.name))

          async function executeToolBlock(toolUse: Anthropic.ToolUseBlock) {
            try {
              const result = await executeTool(
                toolUse.name,
                toolUse.input as Record<string, unknown>,
                toolContext
              )
              return {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify(result),
              }
            } catch (error) {
              return {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                is_error: true,
              }
            }
          }

          // Phase 1: data tools in parallel
          const dataResults = await Promise.allSettled(dataBlocks.map(executeToolBlock))
          // Phase 2: lifecycle tools in parallel (after data tools complete)
          const lifecycleResults = await Promise.allSettled(lifecycleBlocks.map(executeToolBlock))

          // Merge results back in original order
          const resultMap = new Map<string, Awaited<ReturnType<typeof executeToolBlock>>>()
          const allSettled = [...dataResults, ...lifecycleResults]
          const allBlocks = [...dataBlocks, ...lifecycleBlocks]
          for (const [i, settled] of allSettled.entries()) {
            const block = allBlocks[i]
            resultMap.set(block.id, settled.status === 'fulfilled'
              ? settled.value
              : { type: 'tool_result' as const, tool_use_id: block.id, content: 'Tool execution failed', is_error: true }
            )
          }

          const resolvedResults = toolUseBlocks.map((b) =>
            resultMap.get(b.id) ?? { type: 'tool_result' as const, tool_use_id: b.id, content: 'Tool execution failed', is_error: true }
          )

          // Track lifecycle events from tool results
          for (const [i, toolUse] of toolUseBlocks.entries()) {
            const result = resolvedResults[i]
            if (result.is_error) continue
            try {
              const parsed = JSON.parse(result.content) as ToolResult
              if (!parsed.success || !parsed.data) continue
              if (toolUse.name === 'complete_session') {
                if (parsed.data.completed_arc) {
                  completedViaToolArc = parsed.data.completed_arc as string
                  // Update context — arc completed, return to base session type
                  toolContext.activeMode = null
                  toolContext.metadata = { ...toolContext.metadata, active_mode: null }
                } else {
                  completedViaToolSession = true
                }
              }
              if (toolUse.name === 'enter_structured_arc' && parsed.data.arc_type) {
                enteredArcViaTool = parsed.data.arc_type as string
                // Update context so subsequent tool calls in this batch use correct permissions
                toolContext.activeMode = parsed.data.arc_type as StructuredArcType
                toolContext.metadata = { ...toolContext.metadata, active_mode: parsed.data.arc_type as StructuredArcType }
              }
              // Emit domain rating updates so the client can update the spider chart live
              if (toolUse.name === 'save_file' && parsed.data.domainUpdate) {
                enqueue({ domainUpdate: parsed.data.domainUpdate })
              }
              // Track day plan intention for post-session mid-day nudge scheduling
              if (toolUse.name === 'save_file') {
                const toolInput = toolUse.input as Record<string, unknown>
                if (toolInput.file_type === 'day-plan') {
                  const attrs = toolInput.attributes as Record<string, unknown> | undefined
                  if (typeof attrs?.intention === 'string') {
                    dayPlanIntention = attrs.intention
                  }
                }
              }
            } catch { /* ignore parse errors */ }
          }

          // Circuit breaker for repeated failures
          const allErrored = resolvedResults.every((r) => r.is_error)
          if (allErrored) {
            consecutiveFailures++
            if (consecutiveFailures >= 2) {
              enqueue({ error: 'Multiple tool executions failed. Please try again.' })
              break
            }
          } else {
            consecutiveFailures = 0
          }

          // Truncate save_file content before re-sending (saves 50-60% tokens)
          const assistantContent = finalMessage.content.map((block) => {
            if (block.type === 'tool_use' && block.name === 'save_file') {
              const blockInput = block.input as Record<string, unknown>
              return {
                ...block,
                input: {
                  ...blockInput,
                  content: `[saved: ${typeof blockInput.content === 'string' ? blockInput.content.length : 0} chars]`,
                },
              }
            }
            return block
          })

          // Truncate all tool result content before re-sending — Claude only needs success/failure
          const truncatedResults = resolvedResults.map((r) => {
            if (r.is_error) return r
            try {
              const parsed = JSON.parse(r.content) as ToolResult
              return { ...r, content: JSON.stringify({ success: parsed.success }) }
            } catch {
              return r
            }
          })

          // Round boundary between agentic loop iterations
          enqueue({ roundBoundary: true })

          // Append assistant message + tool results for next iteration
          loopMessages = [
            ...loopMessages,
            { role: 'assistant' as const, content: assistantContent as ContentBlockParam[] },
            { role: 'user' as const, content: truncatedResults as ContentBlockParam[] },
          ]
          iteration++
        }

        // Emit lifecycle events after all text has been streamed
        if (completedViaToolSession) {
          enqueue({ sessionCompleted: true })
          generateSessionSummary(supabase, sessionId).catch((err) => {
            captureException(err, { tags: { route: '/api/chat', stage: 'summary_generation' }, extra: { sessionId } })
          })

          // Post-session side effects (fire-and-forget — match legacy client-side behavior)
          const effectiveType = toolContext.activeMode ?? sessionType
          try {
            // Mark onboarding complete after life_mapping session completes
            if (effectiveType === 'life_mapping') {
              supabase.from('users').update({ onboarding_completed: true }).eq('id', user.id)
                .then(({ error: updateErr }) => {
                  if (updateErr) captureException(updateErr, { tags: { route: '/api/chat', stage: 'onboarding_complete' } })
                })
            }

            // Schedule mid-day nudge after open_day completes with a day plan intention
            if (effectiveType === 'open_day' && dayPlanIntention) {
              scheduleMidDayNudge(supabase, user.id, dayPlanIntention, timezone).catch((err) => {
                captureException(err, { tags: { route: '/api/chat', stage: 'schedule_nudge' } })
              })
            }
          } catch (sideEffectErr) {
            captureException(sideEffectErr, { tags: { route: '/api/chat', stage: 'post_session_side_effects' } })
          }
        }
        if (completedViaToolArc) {
          enqueue({ arcCompleted: completedViaToolArc })
        }
        if (enteredArcViaTool) {
          enqueue({ modeChange: enteredArcViaTool })
        }

        // Legacy post-stream processing (transition period — skip if tools handled lifecycle)
        if (!completedViaToolSession && !completedViaToolArc && !enteredArcViaTool) {
          try {
            // Re-fetch metadata if tools may have mutated it (prevents stale snapshot clobber)
            const currentMetadata = (iteration > 0)
              ? await supabase.from('sessions').select('metadata').eq('id', sessionId).single()
                  .then(({ data }) => (data?.metadata ?? existingMetadata) as SessionMetadata)
              : existingMetadata

            if (isPendingCloseDay) {
              // close_day Phase B: previous response emitted journal, user confirmed.
              // If this response has no new journal and no suggested replies, session is done.
              const hasNewJournal = accumulated.includes('[FILE_UPDATE type="daily-log"')
              const hasSuggestedReplies = accumulated.includes('[SUGGESTED_REPLIES]')

              if (!hasNewJournal && !hasSuggestedReplies) {
                await completeSession(supabase, sessionId, user.id)
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { pending_completion: _pendingFlag, ...cleanMetadata } = currentMetadata
                await supabase.from('sessions')
                  .update({ metadata: cleanMetadata })
                  .eq('id', sessionId)
                enqueue({ sessionCompleted: true })

                await generateSessionSummary(supabase, sessionId).catch((err) => {
                  captureException(err, { tags: { route: '/api/chat', stage: 'summary_generation' }, extra: { sessionId } })
                })
              }
            } else {
              const signal = detectTerminalArtifact(accumulated, sessionType, activeMode)

              if (signal === 'complete') {
                if (activeMode && sessionType === 'open_conversation') {
                  const completedArcs: CompletedArc[] = Array.isArray(currentMetadata.completed_arcs)
                    ? currentMetadata.completed_arcs as CompletedArc[]
                    : []
                  completedArcs.push({ mode: activeMode, completed_at: new Date().toISOString() })
                  const arcMetadata = {
                    ...currentMetadata,
                    active_mode: null,
                    completed_arcs: completedArcs,
                  }
                  await supabase.from('sessions')
                    .update({ metadata: arcMetadata })
                    .eq('id', sessionId)
                  enqueue({ arcCompleted: activeMode })
                } else {
                  await completeSession(supabase, sessionId, user.id)
                  enqueue({ sessionCompleted: true })

                  await generateSessionSummary(supabase, sessionId).catch((err) => {
                    captureException(err, { tags: { route: '/api/chat', stage: 'summary_generation' }, extra: { sessionId } })
                  })
                }
              } else if (signal === 'pending_completion') {
                await supabase.from('sessions')
                  .update({ metadata: { ...currentMetadata, pending_completion: true } })
                  .eq('id', sessionId)
              }
            }

            // Detect [ENTER_MODE] signal (legacy — skip if arc was entered via tool)
            {
              const enterModeMatch = accumulated.match(/\[ENTER_MODE:\s*(\w+)\]/)
              if (enterModeMatch) {
                const newMode = enterModeMatch[1]
                if (sessionType === 'open_conversation' && !activeMode && VALID_ARC_MODES.includes(newMode as StructuredArcType)) {
                  await supabase.from('sessions')
                    .update({ metadata: { ...currentMetadata, active_mode: newMode } })
                    .eq('id', sessionId)
                  enqueue({ modeChange: newMode })
                }
              }
            }
          } catch (completionError) {
            // Non-fatal: log but don't break the stream
            captureException(completionError, {
              tags: { route: '/api/chat', stage: 'completion_detection' },
              extra: { sessionId, sessionType },
            })
          }
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
