export type MessageRole = 'user' | 'assistant'

export type SessionType = 'life_mapping' | 'weekly_checkin'

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

export type StructuredBlock =
  | { type: 'domain_summary'; data: DomainSummary }
  | { type: 'life_map_synthesis'; data: LifeMapSynthesis }
  | { type: 'session_summary'; data: SessionSummary }

export type ParsedSegment =
  | { type: 'text'; content: string }
  | { type: 'block'; blockType: 'domain_summary'; data: DomainSummary }
  | { type: 'block'; blockType: 'life_map_synthesis'; data: LifeMapSynthesis }
  | { type: 'block'; blockType: 'session_summary'; data: SessionSummary }

export interface ParsedMessage {
  segments: ParsedSegment[]
}
