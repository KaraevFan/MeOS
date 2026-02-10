import { describe, it, expect } from 'vitest'
import { parseMessage, parseStreamingChunk } from './parser'

describe('parseMessage', () => {
  it('returns plain text when no structured blocks', () => {
    const result = parseMessage('Hello, how are you doing today?')
    expect(result.textBefore).toBe('Hello, how are you doing today?')
    expect(result.block).toBeNull()
    expect(result.textAfter).toBe('')
  })

  it('parses a DOMAIN_SUMMARY block correctly', () => {
    const content = `Great, let me summarize what I'm hearing.

[DOMAIN_SUMMARY]
Domain: Career / Work
Current state: Senior PM at a mid-stage startup, 2 years in. Competent but not excited.
What's working: Good at the craft, team respects you
What's not working: Feeling like building someone else's dream
Key tension: Security vs. entrepreneurial ambition
Stated intention: Explore starting something on the side within 3 months
Status: needs_attention
[/DOMAIN_SUMMARY]

Want to explore another area?`

    const result = parseMessage(content)
    expect(result.textBefore).toBe("Great, let me summarize what I'm hearing.")
    expect(result.textAfter).toBe('Want to explore another area?')
    expect(result.block).not.toBeNull()
    expect(result.block!.type).toBe('domain_summary')

    if (result.block!.type === 'domain_summary') {
      const data = result.block!.data
      expect(data.domain).toBe('Career / Work')
      expect(data.currentState).toBe('Senior PM at a mid-stage startup, 2 years in. Competent but not excited.')
      expect(data.whatsWorking).toEqual(['Good at the craft', 'team respects you'])
      expect(data.whatsNotWorking).toEqual(["Feeling like building someone else's dream"])
      expect(data.keyTension).toBe('Security vs. entrepreneurial ambition')
      expect(data.statedIntention).toBe('Explore starting something on the side within 3 months')
      expect(data.status).toBe('needs_attention')
    }
  })

  it('parses text before and after a domain summary block', () => {
    const content = `Here's what I captured:

[DOMAIN_SUMMARY]
Domain: Health / Body
Current state: Doing okay
What's working: Regular walks
What's not working: Poor sleep
Key tension: Work-life balance
Stated intention: Fix sleep schedule
Status: stable
[/DOMAIN_SUMMARY]

Shall we continue?`

    const result = parseMessage(content)
    expect(result.textBefore).toBe("Here's what I captured:")
    expect(result.textAfter).toBe('Shall we continue?')
    expect(result.block).not.toBeNull()
  })

  it('parses a LIFE_MAP_SYNTHESIS block', () => {
    const content = `[LIFE_MAP_SYNTHESIS]
Narrative: You're at a crossroads. Career stability masks creative restlessness.
Primary compounding engine: Building a creative side project
Quarterly priorities: Launch side project, Fix sleep, Reconnect with friends
Key tensions: Security vs. ambition, Solitude vs. connection
Anti-goals: Don't optimize for promotion, Don't start another course
[/LIFE_MAP_SYNTHESIS]`

    const result = parseMessage(content)
    expect(result.block).not.toBeNull()
    expect(result.block!.type).toBe('life_map_synthesis')

    if (result.block!.type === 'life_map_synthesis') {
      const data = result.block!.data
      expect(data.narrative).toBe("You're at a crossroads. Career stability masks creative restlessness.")
      expect(data.primaryCompoundingEngine).toBe('Building a creative side project')
      expect(data.quarterlyPriorities).toEqual(['Launch side project', 'Fix sleep', 'Reconnect with friends'])
      expect(data.keyTensions).toEqual(['Security vs. ambition', 'Solitude vs. connection'])
      expect(data.antiGoals).toEqual(["Don't optimize for promotion", "Don't start another course"])
    }
  })

  it('parses a SESSION_SUMMARY block', () => {
    const content = `[SESSION_SUMMARY]
Date: 2026-02-10
Sentiment: Reflective and hopeful
Energy level: 3
Key themes: Career transition, Creative expression
Commitments: Start side project research this week
Life map updates: Career domain updated to needs_attention
Patterns observed: Third week mentioning creative restlessness
[/SESSION_SUMMARY]`

    const result = parseMessage(content)
    expect(result.block).not.toBeNull()
    expect(result.block!.type).toBe('session_summary')

    if (result.block!.type === 'session_summary') {
      const data = result.block!.data
      expect(data.date).toBe('2026-02-10')
      expect(data.sentiment).toBe('Reflective and hopeful')
      expect(data.energyLevel).toBe(3)
      expect(data.keyThemes).toEqual(['Career transition', 'Creative expression'])
      expect(data.commitments).toEqual(['Start side project research this week'])
      expect(data.lifeMapUpdates).toBe('Career domain updated to needs_attention')
      expect(data.patternsObserved).toBe('Third week mentioning creative restlessness')
    }
  })

  it('handles malformed block with no closing tag gracefully', () => {
    const content = `Here's what I got:

[DOMAIN_SUMMARY]
Domain: Career / Work
Current state: Doing well
No closing tag here`

    const result = parseMessage(content)
    expect(result.textBefore).toBe(content)
    expect(result.block).toBeNull()
    expect(result.textAfter).toBe('')
  })

  it('handles malformed block with missing fields gracefully', () => {
    const content = `[DOMAIN_SUMMARY]
Domain: Finances
Current state: Tight but manageable
[/DOMAIN_SUMMARY]`

    const result = parseMessage(content)
    expect(result.block).not.toBeNull()
    expect(result.block!.type).toBe('domain_summary')

    if (result.block!.type === 'domain_summary') {
      const data = result.block!.data
      expect(data.domain).toBe('Finances')
      expect(data.currentState).toBe('Tight but manageable')
      expect(data.whatsWorking).toEqual([])
      expect(data.whatsNotWorking).toEqual([])
      expect(data.keyTension).toBe('')
      expect(data.statedIntention).toBe('')
      expect(data.status).toBe('stable')
    }
  })
})

describe('parseStreamingChunk', () => {
  it('returns full text when no opening tag seen', () => {
    const result = parseStreamingChunk('Hello, how are')
    expect(result.displayText).toBe('Hello, how are')
    expect(result.pendingBlock).toBe(false)
    expect(result.completedBlock).toBeNull()
  })

  it('returns text before opening tag and marks block as pending', () => {
    const result = parseStreamingChunk('Here we go:\n\n[DOMAIN_SUMMARY]\nDomain: Career')
    expect(result.displayText).toBe('Here we go:')
    expect(result.pendingBlock).toBe(true)
    expect(result.completedBlock).toBeNull()
  })

  it('returns completed block when closing tag detected', () => {
    const accumulated = `Summary:

[DOMAIN_SUMMARY]
Domain: Health / Body
Current state: Good
What's working: Exercise
What's not working: Sleep
Key tension: Time
Stated intention: Sleep earlier
Status: stable
[/DOMAIN_SUMMARY]

Next?`

    const result = parseStreamingChunk(accumulated)
    expect(result.displayText).toBe('Summary:')
    expect(result.pendingBlock).toBe(false)
    expect(result.completedBlock).not.toBeNull()
    expect(result.completedBlock!.type).toBe('domain_summary')
  })
})
