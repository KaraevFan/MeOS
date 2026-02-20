/** Energy levels from the morning session Step 1 */
export type EnergyLevel = 'fired_up' | 'focused' | 'neutral' | 'low' | 'stressed'

/** Capture classification types from AI classification */
export type CaptureClassification = 'thought' | 'task' | 'idea' | 'tension'

/** Capture source — where the capture originated */
export type CaptureSource = 'manual' | 'morning_session' | 'conversation'

/** Priority item stored in day_plans.priorities JSONB */
export interface Priority {
  rank: number
  text: string
  completed: boolean
}

/** Open thread stored in day_plans.open_threads JSONB */
export interface OpenThread {
  text: string
  source_session_type: string
  source_date: string
  provenance_label: string
  status: 'open' | 'resolved'
  resolved_at: string | null
}

/** Evening reflection data stored in day_plans.evening_reflection JSONB */
export interface EveningReflection {
  mood: string | null
  energy: string | null
  went_well: string[]
  carry_forward: string[]
  sage_synthesis: string | null
}

/** Day plan row from the day_plans table */
export interface DayPlan {
  id: string
  user_id: string
  date: string
  intention: string | null
  energy_level: EnergyLevel | null
  morning_session_id: string | null
  morning_completed_at: string | null
  evening_session_id: string | null
  evening_completed_at: string | null
  evening_reflection: EveningReflection | null
  open_threads: OpenThread[]
  priorities: Priority[]
  briefing_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

/** Capture row from the captures table */
export interface Capture {
  id: string
  user_id: string
  day_plan_id: string | null
  content: string
  classification: CaptureClassification | null
  auto_tags: string[]
  source: CaptureSource
  explored: boolean
  completed: boolean
  created_at: string
}

/** Day plan with its associated captures — used by the Day Plan view */
export interface DayPlanWithCaptures {
  dayPlan: DayPlan | null
  captures: Capture[]
  streak: number
}
