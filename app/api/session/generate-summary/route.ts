import { createClient } from '@/lib/supabase/server'
import { updateSessionSummary } from '@/lib/supabase/sessions'
import { captureException } from '@/lib/monitoring/sentry'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/** Strip structured block tags from message content to prevent prompt injection. */
function stripBlockTags(text: string): string {
  return text.replace(
    /\[\/?(FILE_UPDATE|DOMAIN_SUMMARY|LIFE_MAP_SYNTHESIS|SESSION_SUMMARY|SUGGESTED_REPLIES|INLINE_CARD|INTENTION_CARD|DAY_PLAN_DATA)[^\]]*\]/g,
    ''
  )
}

const SUMMARY_PROMPT = `You are summarizing a conversation session. Based on the messages below, generate a concise summary.

Output ONLY valid JSON matching this exact structure (no markdown, no explanation):
{
  "summary": "1-2 sentence summary of what was discussed and any outcomes",
  "themes": ["theme1", "theme2"],
  "sentiment": "positive|neutral|mixed|negative",
  "energy_level": 3
}

Rules:
- summary: Human-readable 1-2 sentence overview. Focus on what the user explored or decided.
- themes: 2-4 key themes as short phrases (e.g., "career direction", "morning routine", "energy management")
- sentiment: Overall emotional tone of the session
- energy_level: 1-5 scale (1=very low, 5=very high) based on user's expressed energy/mood`

export async function POST(request: Request) {
  const supabase = await createClient()

  let body: { sessionId: string }

  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { sessionId } = body

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'sessionId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Load session to verify it exists and get type
  const { data: session } = await supabase
    .from('sessions')
    .select('id, session_type, ai_summary')
    .eq('id', sessionId)
    .single()

  if (!session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Idempotency: skip if summary already exists
  if (session.ai_summary) {
    return new Response(JSON.stringify({ ok: true, skipped: 'already_generated' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Load recent messages for context
  const { data: messages } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(20)

  if (!messages || messages.length === 0) {
    return new Response(JSON.stringify({ ok: true, skipped: 'no_messages' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const conversationText = messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Sage'}: ${stripBlockTags(m.content).slice(0, 500)}`)
      .join('\n\n')

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: SUMMARY_PROMPT,
      messages: [{
        role: 'user',
        content: `Session type: ${session.session_type}\n\nConversation:\n${conversationText}`,
      }],
    })

    const responseText = response.content[0].type === 'text' ? response.content[0].text : ''

    let result: { summary: string; themes: string[]; sentiment: string; energy_level: number }
    try {
      result = JSON.parse(responseText)
    } catch {
      // Fallback if JSON parsing fails
      result = {
        summary: 'Session completed.',
        themes: [],
        sentiment: 'neutral',
        energy_level: 3,
      }
    }

    await updateSessionSummary(
      supabase,
      sessionId,
      result.summary,
      result.themes,
      [],
      result.sentiment,
      result.energy_level
    )

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    captureException(err, {
      tags: { route: '/api/session/generate-summary' },
      extra: { sessionId },
    })
    return new Response(JSON.stringify({ error: 'Generation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
