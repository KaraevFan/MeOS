import { createClient } from '@/lib/supabase/server'
import { getDayPlanWithCaptures } from '@/lib/supabase/day-plan-queries'
import { getUserTimezone } from '@/lib/get-user-timezone'
import { getLocalDateString } from '@/lib/dates'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const QuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/**
 * GET /api/day-plan?date=2026-02-20
 * Returns day plan + captures for a specific date.
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

    const tz = await getUserTimezone(supabase, user.id)
    const data = await getDayPlanWithCaptures(supabase, user.id, parsed.data.date, tz)

    // Historical dates are immutable — allow browser caching to avoid refetches on swipe
    const todayStr = getLocalDateString(tz)
    const isHistorical = parsed.data.date < todayStr
    const headers: HeadersInit = isHistorical
      ? { 'Cache-Control': 'private, max-age=3600' }
      : { 'Cache-Control': 'private, no-cache' }

    return NextResponse.json(data, { headers })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
