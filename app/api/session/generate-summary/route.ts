import { createClient } from '@/lib/supabase/server'
import { generateSessionSummary } from '@/lib/ai/generate-session-summary'
import { captureException } from '@/lib/monitoring/sentry'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

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

  try {
    await generateSessionSummary(supabase, sessionId)
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
