import type { SupabaseClient } from '@supabase/supabase-js'
import { ALL_DOMAINS } from '@/lib/constants'
import type { DomainName } from '@/types/chat'

export type SessionState =
  | 'new_user'
  | 'mapping_in_progress'
  | 'mapping_complete'
  | 'checkin_due'
  | 'checkin_overdue'
  | 'mid_conversation'

export interface SessionStateResult {
  state: SessionState
  activeSessionId?: string
  activeSessionType?: string
  lastCompletedSessionId?: string
  nextCheckinAt?: string
  unexploredDomains?: DomainName[]
  userName?: string
}

export async function detectSessionState(
  supabase: SupabaseClient,
  userId: string
): Promise<SessionStateResult> {
  // Fetch user profile + active session + latest completed session in parallel
  const [userResult, activeSessionResult, lastCompletedResult] = await Promise.all([
    supabase
      .from('users')
      .select('onboarding_completed, next_checkin_at, email')
      .eq('id', userId)
      .single(),
    supabase
      .from('sessions')
      .select('id, session_type, status, domains_explored, created_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('sessions')
      .select('id, completed_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const user = userResult.data
  const activeSession = activeSessionResult.data
  const lastCompleted = lastCompletedResult.data

  // Extract first name from email
  const email = user?.email || ''
  const userName = email.split('@')[0]?.split(/[._+-]/)[0] || undefined

  // 1. New user
  if (!user?.onboarding_completed) {
    return { state: 'new_user', userName }
  }

  // 2. Active session
  if (activeSession) {
    // Check if session has messages (meaning conversation started)
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', activeSession.id)
      .eq('role', 'user')

    const hasUserMessages = (count ?? 0) > 0

    if (hasUserMessages) {
      return {
        state: 'mid_conversation',
        activeSessionId: activeSession.id,
        activeSessionType: activeSession.session_type,
        userName,
      }
    }

    // Session exists but no user messages — might be mapping_in_progress
    if (activeSession.session_type === 'life_mapping' && activeSession.domains_explored?.length) {
      const explored = new Set(activeSession.domains_explored as string[])
      const unexplored = ALL_DOMAINS.filter((d) => !explored.has(d))
      return {
        state: 'mapping_in_progress',
        activeSessionId: activeSession.id,
        unexploredDomains: unexplored,
        userName,
      }
    }
  }

  // 3. No active session, onboarding complete — check for check-in timing
  const nextCheckinAt = user?.next_checkin_at

  if (nextCheckinAt) {
    const checkinDate = new Date(nextCheckinAt)
    const now = new Date()
    const diffMs = checkinDate.getTime() - now.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)

    if (diffHours < -24) {
      return {
        state: 'checkin_overdue',
        nextCheckinAt,
        lastCompletedSessionId: lastCompleted?.id,
        userName,
      }
    }

    if (diffHours <= 24) {
      return {
        state: 'checkin_due',
        nextCheckinAt,
        lastCompletedSessionId: lastCompleted?.id,
        userName,
      }
    }
  }

  return {
    state: 'mapping_complete',
    nextCheckinAt: nextCheckinAt || undefined,
    lastCompletedSessionId: lastCompleted?.id,
    userName,
  }
}
