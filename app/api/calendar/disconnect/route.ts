import { createClient } from '@/lib/supabase/server'
import { revokeAndRemoveIntegration } from '@/lib/calendar/google-calendar'
import { NextResponse } from 'next/server'

/**
 * POST /api/calendar/disconnect
 * Revokes Google token (best-effort) and removes calendar integration.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await revokeAndRemoveIntegration(user.id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}
