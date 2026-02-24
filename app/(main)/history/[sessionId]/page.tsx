import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MessageBubble } from '@/components/chat/message-bubble'
import { parseMessage } from '@/lib/ai/parser'
import { getSessionDisplayLabel } from '@/lib/session-labels'

interface SessionDetailPageProps {
  params: Promise<{ sessionId: string }>
}

export default async function SessionDetailPage({ params }: SessionDetailPageProps) {
  const { sessionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!session) {
    notFound()
  }

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  const typeLabel = getSessionDisplayLabel(session.session_type, session.metadata as Record<string, unknown> | null)
  const date = new Date(session.created_at).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="max-w-lg mx-auto pb-lg">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg border-b border-border px-md py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/history"
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-border/30 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-text truncate">{typeLabel}</p>
            <p className="text-[11px] text-text-secondary">{date}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="px-md pt-md space-y-4">
        {messages && messages.length > 0 ? (
          messages.map((msg) => {
            const parsed = parseMessage(msg.content)
            return (
              <MessageBubble
                key={msg.id}
                message={{
                  id: msg.id,
                  sessionId: sessionId,
                  role: msg.role,
                  content: msg.content,
                  hasStructuredBlock: msg.has_structured_block,
                  createdAt: msg.created_at,
                }}
                parsedContent={parsed}
              />
            )
          })
        ) : (
          <p className="text-sm text-text-secondary text-center py-xl">
            No messages in this session.
          </p>
        )}
      </div>

      {/* Session summary footer */}
      {session.ai_summary && (
        <div className="mx-md mt-lg p-4 bg-bg-sage rounded-lg border border-border">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
            Session summary
          </p>
          <p className="text-sm text-text mb-3">{session.ai_summary}</p>
          <Link
            href={`/chat?type=open_conversation&session_context=${sessionId}`}
            className="inline-flex items-center justify-center w-full h-10 px-4 bg-primary text-white text-sm font-medium rounded-md
                       hover:bg-primary-hover transition-colors"
          >
            Talk to Sage about this
          </Link>
        </div>
      )}
    </div>
  )
}
