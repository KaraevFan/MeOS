import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChatView } from '@/components/chat/chat-view'
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
  const sessionType = (params.type === 'weekly_checkin' ? 'weekly_checkin' : 'life_mapping') as SessionType

  return (
    <div className="fixed inset-0 bottom-16 pb-[env(safe-area-inset-bottom)]">
      <ChatView userId={user.id} sessionType={sessionType} />
    </div>
  )
}
