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
  searchParams: Promise<{ type?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const params = await searchParams
  const requestedType = params.type === 'weekly_checkin' ? 'weekly_checkin' : undefined

  // Detect session state server-side
  const sessionState = await detectSessionState(supabase, user.id)

  // Determine session type based on state + URL params
  let sessionType: SessionType = 'life_mapping'
  if (requestedType === 'weekly_checkin') {
    sessionType = 'weekly_checkin'
  } else if (sessionState.state === 'checkin_due' || sessionState.state === 'checkin_overdue') {
    sessionType = 'weekly_checkin'
  }

  // Read commitments for weekly check-in pinned context card
  let commitments: Commitment[] = []
  if (sessionType === 'weekly_checkin') {
    try {
      const ufs = new UserFileSystem(supabase, user.id)
      const lifePlan = await ufs.readLifePlan()
      if (lifePlan) {
        commitments = extractCommitments(lifePlan.content)
      }
    } catch {
      // Graceful fallback — no pinned card
    }
  }

  return (
    <div className="fixed inset-0 bottom-16 pb-[env(safe-area-inset-bottom)]">
      <ChatView
        userId={user.id}
        sessionType={sessionType}
        initialSessionState={sessionState}
        initialCommitments={commitments}
      />
    </div>
  )
}
