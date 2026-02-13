export type PulseRating = 'thriving' | 'good' | 'okay' | 'struggling' | 'in_crisis'

export interface PulseCheckRating {
  domain: string       // e.g., "Career / Work"
  domainKey: string    // e.g., "career_work"
  rating: PulseRating
  ratingNumeric: number // 5, 4, 3, 2, 1
}

export interface PulseCheckResult {
  ratings: PulseCheckRating[]
  sessionId: string
  isBaseline: boolean
}

export const PULSE_RATING_MAP: Record<PulseRating, number> = {
  thriving: 5,
  good: 4,
  okay: 3,
  struggling: 2,
  in_crisis: 1,
}

export const PULSE_DOMAINS = [
  { label: 'Career / Work', key: 'career_work' },
  { label: 'Relationships', key: 'relationships' },
  { label: 'Health / Body', key: 'health_body' },
  { label: 'Finances', key: 'finances' },
  { label: 'Learning / Growth', key: 'learning_growth' },
  { label: 'Creative Pursuits', key: 'creative_pursuits' },
  { label: 'Play / Fun / Adventure', key: 'play_fun_adventure' },
  { label: 'Meaning / Purpose', key: 'meaning_purpose' },
] as const

export const PULSE_RATING_OPTIONS: { label: string; value: PulseRating; numeric: number }[] = [
  { label: 'Thriving', value: 'thriving', numeric: 5 },
  { label: 'Good', value: 'good', numeric: 4 },
  { label: 'Okay', value: 'okay', numeric: 3 },
  { label: 'Struggling', value: 'struggling', numeric: 2 },
  { label: 'In Crisis', value: 'in_crisis', numeric: 1 },
]
