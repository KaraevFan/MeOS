import type { SessionType, CompletedArc, SessionMetadata } from '@/types/chat'

/** Display labels for session types (title case) — used in history views */
export const SESSION_TYPE_LABELS: Record<string, string> = {
  life_mapping: 'Life Mapping',
  weekly_checkin: 'Weekly Check-In',
  monthly_review: 'Monthly Review',
  quarterly_review: 'Quarterly Review',
  open_conversation: 'Conversation',
  close_day: 'Evening Reflection',
  open_day: 'Morning Session',
  quick_capture: 'Quick Capture',
}

/** Display labels for session types (lowercase) — used in inline text */
export const SESSION_TYPE_LABELS_LOWER: Record<SessionType, string> = {
  life_mapping: 'life mapping',
  weekly_checkin: 'weekly check-in',
  open_conversation: 'conversation',
  close_day: 'evening reflection',
  open_day: 'morning session',
  quick_capture: 'quick capture',
}

/**
 * Derive the display label for a session, accounting for completed arcs
 * within open_conversation sessions.
 */
export function getSessionDisplayLabel(
  sessionType: string,
  metadata?: SessionMetadata | Record<string, unknown> | null,
): string {
  if (sessionType === 'open_conversation' && metadata) {
    const arcs: CompletedArc[] = Array.isArray(metadata.completed_arcs) ? metadata.completed_arcs as CompletedArc[] : []
    if (arcs.length > 0) {
      const latest = arcs[arcs.length - 1]
      if (latest.mode && SESSION_TYPE_LABELS[latest.mode]) {
        return `${SESSION_TYPE_LABELS[latest.mode]} + Conversation`
      }
    }
  }
  return SESSION_TYPE_LABELS[sessionType] || sessionType
}
