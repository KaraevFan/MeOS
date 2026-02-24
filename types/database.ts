export interface User {
  id: string
  email: string | null
  display_name: string | null
  created_at: string
  onboarding_completed: boolean
  sage_persona_notes: string | null
  next_checkin_at: string | null
}

export interface LifeMap {
  id: string
  user_id: string
  is_current: boolean
  narrative_summary: string | null
  primary_compounding_engine: string | null
  quarterly_priorities: string[] | null
  key_tensions: string[] | null
  anti_goals: string[] | null
  failure_modes: string[] | null
  identity_statements: string[] | null
  created_at: string
  updated_at: string
}

export interface LifeMapDomain {
  id: string
  life_map_id: string
  domain_name: string
  current_state: string | null
  whats_working: string[] | null
  whats_not_working: string[] | null
  desires: string[] | null
  tensions: string[] | null
  stated_intentions: string[] | null
  status: 'thriving' | 'stable' | 'needs_attention' | 'in_crisis' | null
  preview_line: string | null
  updated_at: string
}

export interface Session {
  id: string
  user_id: string
  session_type: 'life_mapping' | 'weekly_checkin' | 'monthly_review' | 'quarterly_review' | 'ad_hoc' | 'close_day' | 'open_day' | 'quick_capture'
  status: 'active' | 'completed' | 'abandoned' | 'expired'
  ai_summary: string | null
  sentiment: string | null
  key_themes: string[] | null
  commitments_made: string[] | null
  energy_level: number | null
  domains_explored: string[] | null
  metadata: Record<string, unknown> | null
  created_at: string
  completed_at: string | null
  updated_at: string
}

export interface Message {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  has_structured_block: boolean
  created_at: string
}

export interface Pattern {
  id: string
  user_id: string
  pattern_type: 'recurring_theme' | 'sentiment_trend' | 'consistency' | 'avoidance'
  description: string | null
  first_detected: string
  occurrence_count: number
  related_domain: string | null
  is_active: boolean
}

export interface PushSubscription {
  id: string
  user_id: string
  endpoint: string
  keys: Record<string, string>
  created_at: string
}
