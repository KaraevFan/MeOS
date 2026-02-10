import { SessionCard } from './session-card'
import type { Session } from '@/types/database'

interface SessionListProps {
  sessions: Session[]
}

export function SessionList({ sessions }: SessionListProps) {
  return (
    <div className="space-y-2">
      {sessions.map((session) => (
        <SessionCard key={session.id} session={session} />
      ))}
    </div>
  )
}
