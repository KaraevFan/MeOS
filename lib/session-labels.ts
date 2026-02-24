import type { SessionType } from '@/types/chat'

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
