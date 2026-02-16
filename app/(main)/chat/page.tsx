import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChatView } from '@/components/chat/chat-view'
import { detectSessionState } from '@/lib/supabase/session-state'
import { UserFileSystem } from '@/lib/markdown/user-file-system'
import { extractCommitments } from '@/lib/markdown/extract'
import type { Commitment } from '@/lib/markdown/extract'
import type { SessionType } from '@/types/chat'

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; explore?: string; nudge?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const params = await searchParams
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
  } else if (requestedType === 'ad_hoc') {
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

  return (
    <div className="fixed inset-0 bottom-16 pb-[env(safe-area-inset-bottom)]">
      <ChatView
        userId={user.id}
        sessionType={sessionType}
        initialSessionState={sessionState}
        initialCommitments={commitments}
        exploreDomain={params.explore}
        nudgeContext={nudgeContext}
      />
    </div>
  )
}
