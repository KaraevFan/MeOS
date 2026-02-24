import type { FileType } from '@/lib/markdown/constants'

export type MessageRole = 'user' | 'assistant'

export type SessionType = 'life_mapping' | 'weekly_checkin' | 'open_conversation' | 'close_day' | 'open_day' | 'quick_capture'

/** Structured arc types that can be entered within an open conversation */
export type StructuredArcType = 'open_day' | 'close_day' | 'weekly_checkin' | 'life_mapping'

export interface CompletedArc {
  type: StructuredArcType
  completed_at: string
}

export interface SessionMetadata {
  active_mode?: StructuredArcType | null
  completed_arcs?: CompletedArc[]
  ad_hoc_context?: string
  [key: string]: unknown
}

export type PulseContextMode = 'none' | 'onboarding_baseline' | 'checkin_after_rerate' | 'checkin_after_skip'

export type SessionStatus = 'active' | 'completed' | 'abandoned' | 'expired'

export type DomainStatus = 'thriving' | 'stable' | 'needs_attention' | 'in_crisis'

export type DomainName =
  | 'Career / Work'
  | 'Relationships'
  | 'Health / Body'
  | 'Finances'
  | 'Learning / Growth'
  | 'Creative Pursuits'
  | 'Play / Fun / Adventure'
  | 'Meaning / Purpose'

export interface ChatMessage {
  id: string
  sessionId: string
  role: MessageRole
  content: string
  hasStructuredBlock: boolean
  createdAt: string
}

export interface DomainSummary {
  domain: DomainName
  currentState: string
  whatsWorking: string[]
  whatsNotWorking: string[]
  keyTension: string
  statedIntention: string
  status: DomainStatus
}

export interface LifeMapSynthesis {
  narrative: string
  primaryCompoundingEngine: string
  quarterlyPriorities: string[]
  keyTensions: string[]
  antiGoals: string[]
}

export interface SessionSummary {
  date: string
  sentiment: string
  energyLevel: number | null
  keyThemes: string[]
  commitments: string[]
  lifeMapUpdates: string
  patternsObserved: string
}

/** Semantic identifier from [FILE_UPDATE] blocks. System resolves to file path. */
export interface FileUpdateData {
  /** File type: "domain", "overview", "life-plan", "check-in", "sage-context", "sage-patterns", "session-insights" */
  fileType: FileType
  /** Semantic name, e.g., "Career / Work" for domains, or absent for singleton files */
  name?: string
  /** Resolved file path (populated by resolver, not parser) */
  resolvedPath?: string
  /** Markdown body content (no frontmatter) */
  content: string
  /** One-line preview for domain cards (parsed from FILE_UPDATE tag attribute) */
  previewLine?: string
  /** Domain status override (parsed from FILE_UPDATE tag attribute) */
  status?: DomainStatus
  /** Additional attributes from FILE_UPDATE tag (energy, mood_signal, etc.) */
  attributes?: Record<string, string>
}

/** AI-driven suggested reply buttons (parsed from [SUGGESTED_REPLIES] blocks) */
export interface SuggestedRepliesData {
  replies: string[]
}

/** Inline structured card rendered in conversation (parsed from [INLINE_CARD] blocks) */
export type InlineCardData =
  | { cardType: 'calendar'; items: string[] }

/** Interactive carried-intention card with Keep/Change buttons (parsed from [INTENTION_CARD] blocks) */
export interface IntentionCardData {
  intention: string
}

/** Structured day plan data emitted by Sage at end of morning session (parsed from [DAY_PLAN_DATA] blocks) */
export interface DayPlanDataBlock {
  energy_level?: 'fired_up' | 'focused' | 'neutral' | 'low' | 'stressed'
  intention?: string
  priorities?: { rank: number; text: string; completed: boolean }[]
  open_threads?: { text: string; source_session_type?: string; source_date?: string; provenance_label?: string; status: 'open' | 'resolved' }[]
  coaching_note?: string
}

export type StructuredBlock =
  | { type: 'domain_summary'; data: DomainSummary }
  | { type: 'life_map_synthesis'; data: LifeMapSynthesis }
  | { type: 'session_summary'; data: SessionSummary }
  | { type: 'file_update'; data: FileUpdateData }
  | { type: 'reflection_prompt'; data: { content: string } }
  | { type: 'suggested_replies'; data: SuggestedRepliesData }
  | { type: 'inline_card'; data: InlineCardData }
  | { type: 'intention_card'; data: IntentionCardData }
  | { type: 'day_plan_data'; data: DayPlanDataBlock }

export type ParsedSegment =
  | { type: 'text'; content: string }
  | { type: 'block'; blockType: 'domain_summary'; data: DomainSummary }
  | { type: 'block'; blockType: 'life_map_synthesis'; data: LifeMapSynthesis }
  | { type: 'block'; blockType: 'session_summary'; data: SessionSummary }
  | { type: 'block'; blockType: 'file_update'; data: FileUpdateData }
  | { type: 'block'; blockType: 'reflection_prompt'; data: { content: string } }
  | { type: 'block'; blockType: 'suggested_replies'; data: SuggestedRepliesData }
  | { type: 'block'; blockType: 'inline_card'; data: InlineCardData }
  | { type: 'block'; blockType: 'intention_card'; data: IntentionCardData }
  | { type: 'block'; blockType: 'day_plan_data'; data: DayPlanDataBlock }

export interface ParsedMessage {
  segments: ParsedSegment[]
}
