import type { DomainName } from '@/types/chat'

/** Storage bucket name for user markdown files */
export const STORAGE_BUCKET = 'user-files'

/** Allowed file path prefixes (security whitelist) */
export const ALLOWED_PATH_PREFIXES = [
  'life-map/',
  'life-plan/',
  'check-ins/',
  'sage/',
  'daily-logs/',
  'day-plans/',
  'captures/',
] as const

/** Strict path regex: lowercase alphanumeric, hyphens, underscores, max 3 directory levels, ending in .md */
export const SAFE_PATH_REGEX = /^[a-z0-9\-_]+(?:\/[a-z0-9\-_]+){0,2}\.md$/

/** Domain display name to filename mapping */
export const DOMAIN_FILE_MAP: Record<DomainName, string> = {
  'Career / Work': 'career',
  'Relationships': 'relationships',
  'Health / Body': 'health',
  'Finances': 'finances',
  'Learning / Growth': 'learning',
  'Creative Pursuits': 'creative-pursuits',
  'Play / Fun / Adventure': 'play',
  'Meaning / Purpose': 'meaning',
}

/** Reverse mapping: filename to domain display name */
export const FILE_TO_DOMAIN_MAP: Record<string, DomainName> = Object.fromEntries(
  Object.entries(DOMAIN_FILE_MAP).map(([domain, file]) => [file, domain as DomainName])
) as Record<string, DomainName>

/** File type identifiers used in [FILE_UPDATE] blocks and file_index */
export const FILE_TYPES = {
  DOMAIN: 'domain',
  OVERVIEW: 'overview',
  LIFE_PLAN: 'life-plan',
  CHECK_IN: 'check-in',
  SAGE_CONTEXT: 'sage-context',
  SAGE_PATTERNS: 'sage-patterns',
  SESSION_INSIGHTS: 'session-insights',
  DAILY_LOG: 'daily-log',
  DAY_PLAN: 'day-plan',
  WEEKLY_PLAN: 'weekly-plan',
  CAPTURE: 'capture',
} as const

export type FileType = (typeof FILE_TYPES)[keyof typeof FILE_TYPES]

/** Session type to allowed write paths mapping (security: prevents prompt injection writes) */
export const SESSION_WRITE_PERMISSIONS: Record<string, string[]> = {
  life_mapping: [
    'life-map/',
    'life-plan/current.md',
    'sage/',
  ],
  weekly_checkin: [
    'check-ins/',
    'life-plan/current.md',
    'life-plan/weekly.md',
    'life-map/',
    'sage/',
  ],
  open_conversation: [
    'day-plans/',
    'daily-logs/',
    'check-ins/',
    'life-map/',
    'life-plan/current.md',
    'life-plan/weekly.md',
    'sage/',
    'captures/',
  ],
  close_day: [
    'daily-logs/',
    'sage/context.md',
    'captures/',
  ],
  open_day: [
    'day-plans/',
    'sage/context.md',
  ],
  quick_capture: [
    'captures/',
  ],
}

/** Maximum FILE_UPDATE blocks per message (rate limit) */
export const MAX_FILE_UPDATE_BLOCKS_PER_MESSAGE = 10
