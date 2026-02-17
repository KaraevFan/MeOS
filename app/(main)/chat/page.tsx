import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChatView } from '@/components/chat/chat-view'
import { ChatLayout } from '@/components/chat/chat-layout'
import { detectSessionState } from '@/lib/supabase/session-state'
import { UserFileSystem } from '@/lib/markdown/user-file-system'
import { extractCommitments } from '@/lib/markdown/extract'
import type { Commitment } from '@/lib/markdown/extract'
import type { SessionType } from '@/types/chat'

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; explore?: string; nudge?: string; session_context?: string; session?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const params = await searchParams

  // If a specific session ID is provided, load it directly (session resume)
  if (params.session) {
    const { data: targetSession } = await supabase
      .from('sessions')
      .select('id, session_type, status')
      .eq('id', params.session)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (targetSession) {
      const targetType = targetSession.session_type as SessionType

      let targetCommitments: Commitment[] = []
      if (targetType === 'weekly_checkin') {
        try {
          const lifePlan = await new UserFileSystem(supabase, user.id).readLifePlan()
          if (lifePlan) {
            targetCommitments = extractCommitments(lifePlan.content)
          }
        } catch {
          // Graceful fallback
        }
      }

      return (
        <div className="fixed inset-0 bottom-16 pb-[env(safe-area-inset-bottom)]">
          <ChatLayout userId={user.id} sessionType={targetType}>
            <ChatView
              userId={user.id}
              sessionType={targetType}
              resumeSessionId={targetSession.id}
              initialCommitments={targetCommitments}
            />
          </ChatLayout>
        </div>
      )
    }
    // If session not found/not active, fall through to normal routing
  }

  const requestedType = params.type as string | undefined

  // Start life plan read early if we already know it's a check-in from URL param
  const lifePlanPromise = requestedType === 'weekly_checkin'
    ? new UserFileSystem(supabase, user.id).readLifePlan().catch(() => null)
    : null

  // Detect session state in parallel with the life plan read above
  const sessionState = await detectSessionState(supabase, user.id)

  // Determine session type based on state + URL params
  let sessionType: SessionType = 'life_mapping'
  if (requestedType === 'weekly_checkin') {
    sessionType = 'weekly_checkin'
  } else if (requestedType === 'ad_hoc' || params.explore) {
    // Explicit ad-hoc OR domain exploration from Life Map
    sessionType = 'ad_hoc'
  } else if (sessionState.state === 'checkin_due' || sessionState.state === 'checkin_overdue') {
    sessionType = 'weekly_checkin'
  } else if (sessionState.state === 'mapping_complete') {
    // Between check-ins — default to ad-hoc conversation
    sessionType = 'ad_hoc'
  }

  // Read commitments for weekly check-in pinned context card
  let commitments: Commitment[] = []
  if (sessionType === 'weekly_checkin') {
    try {
      const lifePlan = lifePlanPromise
        ? await lifePlanPromise
        : await new UserFileSystem(supabase, user.id).readLifePlan()
      if (lifePlan) {
        commitments = extractCommitments(lifePlan.content)
      }
    } catch {
      // Graceful fallback — no pinned card
    }
  }

  // Load reflection nudge context if navigating from home screen nudge
  let nudgeContext: string | undefined
  if (params.nudge && sessionType === 'ad_hoc') {
    const { data: nudge } = await supabase
      .from('reflection_prompts')
      .select('prompt_text')
      .eq('id', params.nudge)
      .eq('user_id', user.id)
      .single()

    if (nudge) {
      nudgeContext = nudge.prompt_text
    }
  }

  // Load session context if navigating from history "Talk to Sage about this"
  let sessionContext: string | undefined
  if (params.session_context && sessionType === 'ad_hoc') {
    const { data: pastSession } = await supabase
      .from('sessions')
      .select('session_type, ai_summary, key_themes, commitments_made, sentiment, created_at')
      .eq('id', params.session_context)
      .eq('user_id', user.id)
      .single()

    if (pastSession?.ai_summary) {
      const pastDate = new Date(pastSession.created_at).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
      const pastTypeLabel: Record<string, string> = {
        life_mapping: 'life mapping', weekly_checkin: 'weekly check-in', ad_hoc: 'conversation',
      }
      const parts = [
        `The user wants to revisit a past ${pastTypeLabel[pastSession.session_type] || 'session'} from ${pastDate}.`,
        `Session summary: ${pastSession.ai_summary}`,
      ]
      if (pastSession.key_themes?.length) {
        parts.push(`Key themes: ${pastSession.key_themes.join(', ')}`)
      }
      if (pastSession.commitments_made?.length) {
        parts.push(`Commitments discussed: ${pastSession.commitments_made.join(', ')}`)
      }
      if (pastSession.sentiment) {
        parts.push(`Overall sentiment: ${pastSession.sentiment}`)
      }
      parts.push('Open by acknowledging this past session and asking what about it the user wants to explore or revisit. Reference specific details from the summary.')
      sessionContext = parts.join('\n')
    }
  }

  return (
    <div className="fixed inset-0 bottom-16 pb-[env(safe-area-inset-bottom)]">
      <ChatLayout userId={user.id} sessionType={sessionType}>
        <ChatView
          userId={user.id}
          sessionType={sessionType}
          initialSessionState={sessionState}
          initialCommitments={commitments}
          exploreDomain={params.explore}
          nudgeContext={nudgeContext}
          sessionContext={sessionContext}
        />
      </ChatLayout>
    </div>
  )
}
