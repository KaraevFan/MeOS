import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { abandonSession } from '@/lib/supabase/sessions'

const Schema = z.object({ sessionId: z.string().uuid() })

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body: unknown = await request.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid sessionId' }), { status: 422 })
  }
  const { sessionId } = parsed.data

  // Verify ownership before mutating
  const { data: session } = await supabase
    .from('sessions')
    .select('user_id')
    .eq('id', sessionId)
    .single()

  if (!session || session.user_id !== user.id) {
    return new Response('Forbidden', { status: 403 })
  }

  await abandonSession(supabase, sessionId, user.id)
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
