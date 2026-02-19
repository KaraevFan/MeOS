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

/** Canonical short names for all domains. Use everywhere abbreviated names are needed. */
export const DOMAIN_SHORT_NAMES: Record<DomainName, string> = {
  'Career / Work': 'Career',
  'Relationships': 'Relations',
  'Health / Body': 'Health',
  'Finances': 'Finances',
  'Learning / Growth': 'Learning',
  'Creative Pursuits': 'Creative',
  'Play / Fun / Adventure': 'Play',
  'Meaning / Purpose': 'Purpose',
}

export const SESSION_STALE_HOURS = 24

/** Tab bar height in pixels — used by BottomTabBar (h-[84px]) and ChatContainer (bottom offset) */
export const TAB_BAR_HEIGHT_PX = 84
