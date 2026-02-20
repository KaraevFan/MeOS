import { createClient } from '@/lib/supabase/server'
import { togglePriorityCompleted } from '@/lib/supabase/day-plan-queries'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const TogglePrioritySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rank: z.number().int().min(1).max(10),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as unknown
  const parsed = TogglePrioritySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const success = await togglePriorityCompleted(supabase, user.id, parsed.data.date, parsed.data.rank)

  if (!success) {
    return NextResponse.json({ error: 'Failed to toggle priority' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
