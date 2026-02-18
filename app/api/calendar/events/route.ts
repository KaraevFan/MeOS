import { createClient } from '@/lib/supabase/server'
import { getCalendarEvents } from '@/lib/calendar/google-calendar'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const QuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/**
 * GET /api/calendar/events?date=2026-02-19
 * Returns today's calendar events for the authenticated user.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parsed = QuerySchema.safeParse({ date: searchParams.get('date') })
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid date parameter. Use YYYY-MM-DD format.' }, { status: 400 })
    }

    const events = await getCalendarEvents(user.id, parsed.data.date)
    return NextResponse.json({ events })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
