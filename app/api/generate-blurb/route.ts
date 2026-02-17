import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface BlurbRequest {
  ratings: Record<string, number>
  domains: string[]
}

/**
 * Generate a 1-2 sentence observation about pulse check ratings using Claude Haiku.
 * Lightweight one-shot generation — no session management or streaming.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: BlurbRequest = await request.json()
    const { ratings, domains } = body

    if (!ratings || !domains || domains.length === 0) {
      return NextResponse.json({ error: 'Missing ratings or domains' }, { status: 400 })
    }

    // Format ratings for the prompt
    const ratingsText = domains
      .map((domain) => {
        const score = ratings[domain] ?? 3
        const label = score <= 1 ? 'in crisis' : score <= 2 ? 'struggling' : score <= 3 ? 'okay' : score <= 4 ? 'good' : 'thriving'
        return `- ${domain}: ${score}/5 (${label})`
      })
      .join('\n')

    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        messages: [
          {
            role: 'user',
            content: `Here are someone's life domain self-ratings (1=in crisis, 5=thriving):\n\n${ratingsText}\n\nGenerate a 1-2 sentence warm observation about what stands out. Be specific about contrasts, patterns, or areas of strength/struggle. Don't give advice — just observe. Use "you" voice.`,
          },
        ],
      })

      const blurb = response.content[0].type === 'text' ? response.content[0].text : ''
      return NextResponse.json({ blurb })
    } catch {
      // Fallback: generate a template-based blurb
      const blurb = generateFallbackBlurb(ratings, domains)
      return NextResponse.json({ blurb, fallback: true })
    }
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function generateFallbackBlurb(ratings: Record<string, number>, domains: string[]): string {
  const entries = domains.map((d) => ({ domain: d, score: ratings[d] ?? 3 }))
  const sorted = [...entries].sort((a, b) => a.score - b.score)
  const lowest = sorted[0]
  const highest = sorted[sorted.length - 1]

  if (lowest.score === highest.score) {
    return `You rated everything around ${lowest.score}/5 — a pretty even landscape. Sometimes that means things are stable, sometimes it means nothing's getting enough attention.`
  }

  return `${highest.domain} is where you feel strongest at ${highest.score}/5, while ${lowest.domain} at ${lowest.score}/5 seems to need the most attention. That contrast tells a story.`
}
