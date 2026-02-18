import { createClient } from '@/lib/supabase/server'
import { UserFileSystem } from '@/lib/markdown/user-file-system'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const CheckinResponseSchema = z.object({
  response: z.enum(['yes', 'not-yet', 'snooze']),
})

/**
 * POST /api/checkin/respond — Persist a mid-day check-in response.
 * Updates today's day plan frontmatter with the response.
 * For 'yes' and 'not-yet', also writes a quick capture.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as unknown
    const parsed = CheckinResponseSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }

    const { response } = parsed.data
    const ufs = new UserFileSystem(supabase, user.id)
    const todayStr = new Date().toLocaleDateString('en-CA')

    // Read today's day plan to update frontmatter
    const dayPlan = await ufs.readDayPlan(todayStr)
    if (!dayPlan) {
      return NextResponse.json({ error: 'No day plan found for today' }, { status: 404 })
    }

    // Update day plan frontmatter with checkin response
    const updatedFrontmatter = { ...dayPlan.frontmatter, checkin_response: response }
    await ufs.writeDayPlan(todayStr, dayPlan.content, updatedFrontmatter)

    // For 'yes' and 'not-yet', also write a quick capture
    if (response !== 'snooze') {
      const intention = dayPlan.frontmatter.intention ?? 'my intention'
      const captureText = response === 'yes'
        ? `On track with: ${intention}`
        : `Not on track with: ${intention}`
      const now = new Date()
      const timestamp = now.toTimeString().slice(0, 8).replace(/:/g, '')
      await ufs.writeCapture(todayStr, timestamp, captureText, {
        input_mode: 'text' as const,
        timestamp: now.toISOString(),
      })
    }

    return NextResponse.json({ ok: true, response })
  } catch (error) {
    console.error('[checkin/respond] Error:', error)
    return NextResponse.json({ error: 'Failed to save check-in response' }, { status: 500 })
  }
}
