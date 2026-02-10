import type {
  ParsedMessage,
  StructuredBlock,
  DomainSummary,
  LifeMapSynthesis,
  SessionSummary,
  DomainStatus,
  DomainName,
} from '@/types/chat'

const BLOCK_TAGS = [
  { open: '[DOMAIN_SUMMARY]', close: '[/DOMAIN_SUMMARY]', type: 'domain_summary' as const },
  { open: '[LIFE_MAP_SYNTHESIS]', close: '[/LIFE_MAP_SYNTHESIS]', type: 'life_map_synthesis' as const },
  { open: '[SESSION_SUMMARY]', close: '[/SESSION_SUMMARY]', type: 'session_summary' as const },
]

const VALID_STATUSES: DomainStatus[] = ['thriving', 'stable', 'needs_attention', 'in_crisis']

function parseKeyValueLines(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const colonIndex = trimmed.indexOf(':')
    if (colonIndex === -1) continue

    const key = trimmed.slice(0, colonIndex).trim()
    const value = trimmed.slice(colonIndex + 1).trim()
    result[key] = value
  }

  return result
}

function parseCommaSeparated(value: string | undefined): string[] {
  if (!value) return []
  return value.split(',').map((s) => s.trim()).filter(Boolean)
}

function parseDomainSummary(fields: Record<string, string>): DomainSummary {
  const statusRaw = (fields['Status'] || '').toLowerCase().trim()
  const status: DomainStatus = VALID_STATUSES.includes(statusRaw as DomainStatus)
    ? (statusRaw as DomainStatus)
    : 'stable'

  return {
    domain: (fields['Domain'] || '') as DomainName,
    currentState: fields['Current state'] || '',
    whatsWorking: parseCommaSeparated(fields["What's working"]),
    whatsNotWorking: parseCommaSeparated(fields["What's not working"]),
    keyTension: fields['Key tension'] || '',
    statedIntention: fields['Stated intention'] || '',
    status,
  }
}

function parseLifeMapSynthesis(fields: Record<string, string>): LifeMapSynthesis {
  return {
    narrative: fields['Narrative'] || '',
    primaryCompoundingEngine: fields['Primary compounding engine'] || '',
    quarterlyPriorities: parseCommaSeparated(fields['Quarterly priorities']),
    keyTensions: parseCommaSeparated(fields['Key tensions']),
    antiGoals: parseCommaSeparated(fields['Anti-goals']),
  }
}

function parseSessionSummaryData(fields: Record<string, string>): SessionSummary {
  const energyRaw = fields['Energy level']
  const energyLevel = energyRaw ? parseInt(energyRaw, 10) : null

  return {
    date: fields['Date'] || '',
    sentiment: fields['Sentiment'] || '',
    energyLevel: energyLevel && !isNaN(energyLevel) ? energyLevel : null,
    keyThemes: parseCommaSeparated(fields['Key themes']),
    commitments: parseCommaSeparated(fields['Commitments']),
    lifeMapUpdates: fields['Life map updates'] || '',
    patternsObserved: fields['Patterns observed'] || '',
  }
}

function parseBlockContent(type: 'domain_summary' | 'life_map_synthesis' | 'session_summary', content: string): StructuredBlock {
  const fields = parseKeyValueLines(content)

  switch (type) {
    case 'domain_summary':
      return { type, data: parseDomainSummary(fields) }
    case 'life_map_synthesis':
      return { type, data: parseLifeMapSynthesis(fields) }
    case 'session_summary':
      return { type, data: parseSessionSummaryData(fields) }
  }
}

export function parseMessage(content: string): ParsedMessage {
  for (const tag of BLOCK_TAGS) {
    const openIndex = content.indexOf(tag.open)
    if (openIndex === -1) continue

    const closeIndex = content.indexOf(tag.close, openIndex)
    if (closeIndex === -1) {
      // Malformed — no closing tag, return as plain text
      return { textBefore: content, block: null, textAfter: '' }
    }

    const textBefore = content.slice(0, openIndex).trim()
    const blockContent = content.slice(openIndex + tag.open.length, closeIndex)
    const textAfter = content.slice(closeIndex + tag.close.length).trim()

    const block = parseBlockContent(tag.type, blockContent)

    return { textBefore, block, textAfter }
  }

  return { textBefore: content, block: null, textAfter: '' }
}

export function parseStreamingChunk(accumulated: string): {
  displayText: string
  pendingBlock: boolean
  completedBlock: StructuredBlock | null
} {
  for (const tag of BLOCK_TAGS) {
    const openIndex = accumulated.indexOf(tag.open)
    if (openIndex === -1) continue

    const closeIndex = accumulated.indexOf(tag.close, openIndex)
    if (closeIndex === -1) {
      // Opening tag found but no closing tag yet — block is pending
      return {
        displayText: accumulated.slice(0, openIndex).trim(),
        pendingBlock: true,
        completedBlock: null,
      }
    }

    // Both tags found — block is complete
    const textBefore = accumulated.slice(0, openIndex).trim()
    const blockContent = accumulated.slice(openIndex + tag.open.length, closeIndex)
    const block = parseBlockContent(tag.type, blockContent)

    return {
      displayText: textBefore,
      pendingBlock: false,
      completedBlock: block,
    }
  }

  // No opening tag found
  return {
    displayText: accumulated,
    pendingBlock: false,
    completedBlock: null,
  }
}
