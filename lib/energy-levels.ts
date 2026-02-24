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

type DayPlanEnergyKey = 'fired_up' | 'focused' | 'neutral' | 'low' | 'stressed'
type JournalEnergyKey = 'high' | 'moderate' | 'low'

const DAY_PLAN_ENERGY_MAP: Record<DayPlanEnergyKey, EnergyLevel> = {
  fired_up: 'energized',
  focused: 'good',
  neutral: 'neutral',
  low: 'low',
  stressed: 'rough',
}

const JOURNAL_ENERGY_MAP: Record<JournalEnergyKey, EnergyLevel> = {
  high: 'energized',
  moderate: 'good',
  low: 'low',
}

/** Safely map a day plan energy string to canonical, defaulting to 'neutral' */
export function toDayPlanEnergy(raw: string): EnergyLevel {
  return DAY_PLAN_ENERGY_MAP[raw as DayPlanEnergyKey] ?? 'neutral'
}

/** Safely map a journal energy string to canonical, defaulting to 'neutral' */
export function toJournalEnergy(raw: string): EnergyLevel {
  return JOURNAL_ENERGY_MAP[raw as JournalEnergyKey] ?? 'neutral'
}
