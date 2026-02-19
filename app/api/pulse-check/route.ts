import { createClient } from '@/lib/supabase/server'
import { savePulseCheckRatings } from '@/lib/supabase/pulse-check'
import { z } from 'zod'

const VALID_RATINGS = ['thriving', 'good', 'okay', 'struggling', 'in_crisis'] as const

const PulseCheckSchema = z.object({
  sessionId: z.string().uuid(),
  ratings: z.array(z.object({
    domain: z.string().min(1).max(100),
    rating: z.enum(VALID_RATINGS),
    ratingNumeric: z.number().int().min(1).max(5),
  })).min(1).max(10),
  isBaseline: z.boolean(),
})

/**
 * POST /api/pulse-check
 *
 * Writes pulse check ratings for a session. Used by both:
 *   - Onboarding baseline (isBaseline: true) — 8 domains, first time
 *   - Weekly check-in re-rating (isBaseline: false) — after Sage emits [PULSE_CHECK]
 *
 * Provides agent-native parity: agents can submit ratings without loading the UI.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: z.infer<typeof PulseCheckSchema>
  try {
    const raw = await request.json()
    body = PulseCheckSchema.parse(raw)
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { sessionId, ratings, isBaseline } = body

  // Validate session ownership
  const { data: session } = await supabase
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // Map to PulseCheckRating — domainKey is derived from domain name (matches pulse-check.ts internal helper)
    const pulseRatings = ratings.map((r) => ({
      ...r,
      domainKey: r.domain.toLowerCase().replace(/[^a-z]+/g, '_').replace(/(^_|_$)/g, ''),
    }))
    await savePulseCheckRatings(supabase, sessionId, user.id, pulseRatings, isBaseline)
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to save ratings' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
