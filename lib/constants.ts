import type { DomainName } from '@/types/chat'

export const ALL_DOMAINS: DomainName[] = [
  'Career / Work',
  'Relationships',
  'Health / Body',
  'Finances',
  'Learning / Growth',
  'Creative Pursuits',
  'Play / Fun / Adventure',
  'Meaning / Purpose',
]

/**
 * Abbreviated domain labels for spider chart display.
 * Order matches ALL_DOMAINS. Full names are used everywhere else.
 */
export const RADAR_ABBREVIATED_LABELS: string[] = [
  'Career',
  'Relationships',
  'Health',
  'Finances',
  'Learning',
  'Creative',
  'Play',
  'Purpose',
]

export const SESSION_STALE_HOURS = 24
