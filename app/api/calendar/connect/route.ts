import { createClient } from '@/lib/supabase/server'
import { generateCalendarAuthUrl } from '@/lib/calendar/google-calendar'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

/**
 * GET /api/calendar/connect
 * Initiates incremental Google OAuth for calendar.readonly scope.
 * Generates a CSRF state token, stores it in an httpOnly cookie,
 * and redirects the user to Google's consent screen.
 */
export async function GET(request: Request) {
  // Guard: Calendar OAuth requires Google credentials
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('[calendar/connect] Calendar OAuth credentials not configured')
    return NextResponse.json(
      { error: 'Calendar integration is not available.' },
      { status: 503 }
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { origin } = new URL(request.url)
  const redirectUri = `${origin}/api/calendar/callback`

  // Generate CSRF state token
  const state = randomBytes(32).toString('hex')

  const authUrl = generateCalendarAuthUrl(redirectUri, state)

  const response = NextResponse.redirect(authUrl)

  // Store state in httpOnly cookie for verification in callback
  response.cookies.set('calendar_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/calendar/callback',
    maxAge: 600, // 10 minutes
  })

  return response
}
