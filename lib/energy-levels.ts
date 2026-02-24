/** Canonical energy levels used across the app */
export type EnergyLevel = 'energized' | 'good' | 'neutral' | 'low' | 'rough'

/** Display labels with emoji */
export const ENERGY_DISPLAY: Record<EnergyLevel, { label: string; emoji: string }> = {
  energized: { label: 'Energized', emoji: '🔥' },
  good: { label: 'Good', emoji: '😊' },
  neutral: { label: 'Neutral', emoji: '😐' },
  low: { label: 'Low', emoji: '😔' },
  rough: { label: 'Rough', emoji: '😤' },
}

/** Map DayPlanDataSchema energy levels to canonical */
export const DAY_PLAN_ENERGY_MAP: Record<string, EnergyLevel> = {
  fired_up: 'energized',
  focused: 'good',
  neutral: 'neutral',
  low: 'low',
  stressed: 'rough',
}

/** Map JournalCard energy levels to canonical */
export const JOURNAL_ENERGY_MAP: Record<string, EnergyLevel> = {
  high: 'energized',
  moderate: 'good',
  low: 'low',
}
