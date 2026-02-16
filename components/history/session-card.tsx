import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { Session } from '@/types/database'

const SESSION_TYPE_LABELS: Record<string, string> = {
  life_mapping: 'Life Mapping',
  weekly_checkin: 'Weekly Check-In',
  monthly_review: 'Monthly Review',
  quarterly_review: 'Quarterly Review',
  ad_hoc: 'Conversation',
}

interface SessionCardProps {
  session: Session
}

export function SessionCard({ session }: SessionCardProps) {
  const typeLabel = SESSION_TYPE_LABELS[session.session_type] || session.session_type
  const isCompleted = session.status === 'completed'
  const date = new Date(session.created_at)

  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <Link
      href={`/history/${session.id}`}
      className="block bg-bg-card rounded-lg shadow-sm border border-border p-4 transition-all duration-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            {typeLabel}
          </span>
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full',
            isCompleted
              ? 'text-status-thriving bg-status-thriving/10'
              : 'text-text-secondary bg-border/50'
          )}>
            {isCompleted ? 'Completed' : 'Incomplete'}
          </span>
        </div>
        <span className="text-[11px] text-text-secondary flex-shrink-0">
          {formattedDate}, {formattedTime}
        </span>
      </div>

      {session.ai_summary && (
        <p className="text-sm text-text line-clamp-2 mb-2">
          {session.ai_summary}
        </p>
      )}

      {session.key_themes && session.key_themes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {session.key_themes.slice(0, 4).map((theme, i) => (
            <span
              key={i}
              className="text-[11px] text-text-secondary bg-bg px-2 py-0.5 rounded-full border border-border"
            >
              {theme}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}
