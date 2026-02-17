import type { FileType } from '@/lib/markdown/constants'

export type MessageRole = 'user' | 'assistant'

export type SessionType = 'life_mapping' | 'weekly_checkin' | 'ad_hoc'

export type PulseContextMode = 'none' | 'onboarding_baseline' | 'checkin_after_rerate' | 'checkin_after_skip'

export type SessionStatus = 'active' | 'completed' | 'abandoned'

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
}

export type StructuredBlock =
  | { type: 'domain_summary'; data: DomainSummary }
  | { type: 'life_map_synthesis'; data: LifeMapSynthesis }
  | { type: 'session_summary'; data: SessionSummary }
  | { type: 'file_update'; data: FileUpdateData }
  | { type: 'reflection_prompt'; data: { content: string } }

export type ParsedSegment =
  | { type: 'text'; content: string }
  | { type: 'block'; blockType: 'domain_summary'; data: DomainSummary }
  | { type: 'block'; blockType: 'life_map_synthesis'; data: LifeMapSynthesis }
  | { type: 'block'; blockType: 'session_summary'; data: SessionSummary }
  | { type: 'block'; blockType: 'file_update'; data: FileUpdateData }
  | { type: 'block'; blockType: 'reflection_prompt'; data: { content: string } }

export interface ParsedMessage {
  segments: ParsedSegment[]
}
