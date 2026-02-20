import { createClient } from '@/lib/supabase/server'
import { toggleCaptureCompleted } from '@/lib/supabase/day-plan-queries'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const ToggleCaptureSchema = z.object({
  captureId: z.string().uuid(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as unknown
  const parsed = ToggleCaptureSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const success = await toggleCaptureCompleted(supabase, parsed.data.captureId, user.id)

  if (!success) {
    return NextResponse.json({ error: 'Failed to toggle capture' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
