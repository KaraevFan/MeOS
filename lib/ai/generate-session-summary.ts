import type { SupabaseClient } from '@supabase/supabase-js'
import { updateSessionSummary } from '@/lib/supabase/sessions'
import { stripBlockTags } from '@/lib/ai/sanitize'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SummaryResponseSchema = z.object({
  summary: z.string(),
  themes: z.array(z.string()),
  sentiment: z.enum(['positive', 'neutral', 'mixed', 'negative']),
  energy_level: z.number().int().min(1).max(5),
})

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

/**
 * Generate an AI summary for a completed session.
 * Requires an authenticated Supabase client with access to the session.
 * Idempotent — skips if summary already exists.
 */
export async function generateSessionSummary(
  supabase: SupabaseClient,
  sessionId: string
): Promise<void> {
  const { data: session } = await supabase
    .from('sessions')
    .select('id, session_type, ai_summary')
    .eq('id', sessionId)
    .single()

  if (!session) return
  if (session.ai_summary) return

  const { data: messages } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(20)

  if (!messages || messages.length === 0) return

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

  let rawParsed: unknown
  try {
    rawParsed = JSON.parse(responseText)
  } catch {
    rawParsed = null
  }

  const validated = SummaryResponseSchema.safeParse(rawParsed)
  const result = validated.success
    ? validated.data
    : { summary: 'Session completed.', themes: [] as string[], sentiment: 'neutral' as const, energy_level: 3 }

  await updateSessionSummary(
    supabase,
    sessionId,
    result.summary,
    result.themes,
    [],
    result.sentiment,
    result.energy_level
  )
}
