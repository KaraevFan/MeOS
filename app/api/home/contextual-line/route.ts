import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const RequestSchema = z.object({
  timeState: z.enum(['morning', 'evening']),
  yesterdayIntention: z.string().nullable().optional(),
  yesterdayJournalSummary: z.string().nullable().optional(),
  todayIntention: z.string().nullable().optional(),
  todayCaptureCount: z.number().optional(),
  calendarSummary: z.string().nullable().optional(),
})

/**
 * Generate a 1-2 sentence contextual line for the home screen hero card.
 * Uses Claude Haiku for speed and low cost.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as unknown
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { timeState, yesterdayIntention, yesterdayJournalSummary, todayIntention, todayCaptureCount, calendarSummary } = parsed.data

    // Build context for the LLM
    const contextParts: string[] = []
    if (timeState === 'morning') {
      if (yesterdayIntention) contextParts.push(`Yesterday's intention: "${yesterdayIntention}"`)
      if (yesterdayJournalSummary) contextParts.push(`Last night's reflection summary: "${yesterdayJournalSummary}"`)
      if (calendarSummary) contextParts.push(`Calendar: ${calendarSummary}`)
    } else {
      if (todayCaptureCount && todayCaptureCount > 0) contextParts.push(`${todayCaptureCount} quick capture${todayCaptureCount === 1 ? '' : 's'} today`)
      if (todayIntention) contextParts.push(`Morning intention: "${todayIntention}"`)
      if (yesterdayJournalSummary) contextParts.push(`Last journal reflection: "${yesterdayJournalSummary}"`)
    }

    // If no context available, return a fallback
    if (contextParts.length === 0) {
      const fallback = timeState === 'morning'
        ? 'A fresh start. What matters most to you today?'
        : 'Take a moment to notice what today held. Even two minutes counts.'
      return NextResponse.json({ line: fallback, fallback: true })
    }

    const toneGuide = timeState === 'morning'
      ? 'The tone is warm and grounded — like a thoughtful friend who read your journal. Reference specific details from the context. Never be generic or motivational. Speak directly to the person.'
      : 'The tone is reflective and warm — like closing a book at the end of a chapter. Reference what they actually did or intended today. Never be generic. Speak directly to the person.'

    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: `Generate a 1-2 sentence ${timeState} contextual line for a personal daily rhythm app's home screen. This appears on a hero card inviting the user to ${timeState === 'morning' ? 'plan their day' : 'reflect on their day'}.\n\nUser context:\n${contextParts.join('\n')}\n\n${toneGuide}\n\nRespond with just the 1-2 sentence line, nothing else.`,
          },
        ],
      })

      const firstBlock = response.content[0]
      const line = firstBlock?.type === 'text' ? firstBlock.text.trim() : ''
      return NextResponse.json({ line })
    } catch {
      // Fallback to template-based line
      const line = generateFallbackLine(timeState, parsed.data)
      return NextResponse.json({ line, fallback: true })
    }
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function generateFallbackLine(
  timeState: string,
  data: z.infer<typeof RequestSchema>
): string {
  if (timeState === 'morning') {
    if (data.yesterdayIntention && data.yesterdayJournalSummary) {
      return `Yesterday you set out to ${data.yesterdayIntention}. Your reflection flagged some things worth revisiting.`
    }
    if (data.yesterdayIntention) {
      return `Yesterday you set out to ${data.yesterdayIntention}. Let's see what today holds.`
    }
    if (data.calendarSummary) {
      return `${data.calendarSummary}. A good day to be intentional about your time.`
    }
    return 'A fresh start. What matters most to you today?'
  }

  // Evening
  if (data.todayCaptureCount && data.todayCaptureCount > 0) {
    return `You dropped ${data.todayCaptureCount} thought${data.todayCaptureCount === 1 ? '' : 's'} today. Let's make sense of them before you rest.`
  }
  if (data.todayIntention) {
    return `This morning you set out to ${data.todayIntention}. How did it land?`
  }
  return 'Take a moment to notice what today held. Even two minutes counts.'
}
