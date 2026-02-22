import { createClient } from '@/lib/supabase/server'
import { hasCalendarIntegration } from '@/lib/calendar/google-calendar'
import { NextResponse } from 'next/server'

/**
 * GET /api/calendar/status
 * Returns whether the authenticated user has a calendar integration connected.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const connected = await hasCalendarIntegration(user.id)
    return NextResponse.json({ connected })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
