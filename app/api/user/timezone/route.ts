import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

const TimezoneSchema = z.object({
  timezone: z.string().min(1).max(100).refine(isValidTimezone, 'Invalid IANA timezone identifier'),
})

/** POST /api/user/timezone — Persist the user's detected IANA timezone to the DB. */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as unknown
    const parsed = TimezoneSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 })
    }

    await supabase
      .from('users')
      .update({ timezone: parsed.data.timezone })
      .eq('id', user.id)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[user/timezone] Error:', error)
    return NextResponse.json({ error: 'Failed to update timezone' }, { status: 500 })
  }
}
