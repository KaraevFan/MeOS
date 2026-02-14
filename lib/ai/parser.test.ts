import { describe, it, expect } from 'vitest'
import { parseMessage, parseStreamingChunk } from './parser'

describe('parseMessage', () => {
  it('returns plain text when no structured blocks', () => {
    const result = parseMessage('Hello, how are you doing today?')
    expect(result.segments).toHaveLength(1)
    expect(result.segments[0]).toEqual({ type: 'text', content: 'Hello, how are you doing today?' })
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
    expect(result.segments).toHaveLength(3)

    expect(result.segments[0]).toEqual({ type: 'text', content: "Great, let me summarize what I'm hearing." })
    expect(result.segments[2]).toEqual({ type: 'text', content: 'Want to explore another area?' })

    const block = result.segments[1]
    expect(block.type).toBe('block')
    if (block.type === 'block') {
      expect(block.blockType).toBe('domain_summary')
      if (block.blockType === 'domain_summary') {
        expect(block.data.domain).toBe('Career / Work')
        expect(block.data.currentState).toBe('Senior PM at a mid-stage startup, 2 years in. Competent but not excited.')
        expect(block.data.whatsWorking).toEqual(['Good at the craft', 'team respects you'])
        expect(block.data.whatsNotWorking).toEqual(["Feeling like building someone else's dream"])
        expect(block.data.keyTension).toBe('Security vs. entrepreneurial ambition')
        expect(block.data.statedIntention).toBe('Explore starting something on the side within 3 months')
        expect(block.data.status).toBe('needs_attention')
      }
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
    expect(result.segments).toHaveLength(3)
    expect(result.segments[0]).toEqual({ type: 'text', content: "Here's what I captured:" })
    expect(result.segments[1].type).toBe('block')
    expect(result.segments[2]).toEqual({ type: 'text', content: 'Shall we continue?' })
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
    expect(result.segments).toHaveLength(1)

    const block = result.segments[0]
    expect(block.type).toBe('block')
    if (block.type === 'block') {
      expect(block.blockType).toBe('life_map_synthesis')
      if (block.blockType === 'life_map_synthesis') {
        expect(block.data.narrative).toBe("You're at a crossroads. Career stability masks creative restlessness.")
        expect(block.data.primaryCompoundingEngine).toBe('Building a creative side project')
        expect(block.data.quarterlyPriorities).toEqual(['Launch side project', 'Fix sleep', 'Reconnect with friends'])
        expect(block.data.keyTensions).toEqual(['Security vs. ambition', 'Solitude vs. connection'])
        expect(block.data.antiGoals).toEqual(["Don't optimize for promotion", "Don't start another course"])
      }
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
    expect(result.segments).toHaveLength(1)

    const block = result.segments[0]
    expect(block.type).toBe('block')
    if (block.type === 'block') {
      expect(block.blockType).toBe('session_summary')
      if (block.blockType === 'session_summary') {
        expect(block.data.date).toBe('2026-02-10')
        expect(block.data.sentiment).toBe('Reflective and hopeful')
        expect(block.data.energyLevel).toBe(3)
        expect(block.data.keyThemes).toEqual(['Career transition', 'Creative expression'])
        expect(block.data.commitments).toEqual(['Start side project research this week'])
        expect(block.data.lifeMapUpdates).toBe('Career domain updated to needs_attention')
        expect(block.data.patternsObserved).toBe('Third week mentioning creative restlessness')
      }
    }
  })

  it('handles malformed block with no closing tag gracefully', () => {
    const content = `Here's what I got:

[DOMAIN_SUMMARY]
Domain: Career / Work
Current state: Doing well
No closing tag here`

    const result = parseMessage(content)
    expect(result.segments).toHaveLength(1)
    expect(result.segments[0].type).toBe('text')
    if (result.segments[0].type === 'text') {
      expect(result.segments[0].content).toBe(content)
    }
  })

  it('handles malformed block with missing fields gracefully', () => {
    const content = `[DOMAIN_SUMMARY]
Domain: Finances
Current state: Tight but manageable
[/DOMAIN_SUMMARY]`

    const result = parseMessage(content)
    expect(result.segments).toHaveLength(1)

    const block = result.segments[0]
    expect(block.type).toBe('block')
    if (block.type === 'block' && block.blockType === 'domain_summary') {
      expect(block.data.domain).toBe('Finances')
      expect(block.data.currentState).toBe('Tight but manageable')
      expect(block.data.whatsWorking).toEqual([])
      expect(block.data.whatsNotWorking).toEqual([])
      expect(block.data.keyTension).toBe('')
      expect(block.data.statedIntention).toBe('')
      expect(block.data.status).toBe('stable')
    }
  })

  // --- Multi-block tests ---

  it('parses two domain summaries in one message with text between', () => {
    const content = `Here are both domains:

[DOMAIN_SUMMARY]
Domain: Career / Work
Current state: PM at startup
What's working: Good craft
What's not working: Not excited
Key tension: Security vs ambition
Stated intention: Start side project
Status: needs_attention
[/DOMAIN_SUMMARY]

Now let's look at finances.

[DOMAIN_SUMMARY]
Domain: Finances
Current state: Tight but manageable
What's working: No debt
What's not working: Low savings
Key tension: Spending vs saving
Stated intention: Build emergency fund
Status: stable
[/DOMAIN_SUMMARY]

What else would you like to explore?`

    const result = parseMessage(content)
    expect(result.segments).toHaveLength(5)
    expect(result.segments[0]).toEqual({ type: 'text', content: 'Here are both domains:' })
    expect(result.segments[1].type).toBe('block')
    expect(result.segments[2]).toEqual({ type: 'text', content: "Now let's look at finances." })
    expect(result.segments[3].type).toBe('block')
    expect(result.segments[4]).toEqual({ type: 'text', content: 'What else would you like to explore?' })

    if (result.segments[1].type === 'block') {
      expect(result.segments[1].blockType).toBe('domain_summary')
      if (result.segments[1].blockType === 'domain_summary') {
        expect(result.segments[1].data.domain).toBe('Career / Work')
      }
    }
    if (result.segments[3].type === 'block') {
      expect(result.segments[3].blockType).toBe('domain_summary')
      if (result.segments[3].blockType === 'domain_summary') {
        expect(result.segments[3].data.domain).toBe('Finances')
      }
    }
  })

  it('parses three domain summaries back-to-back', () => {
    const content = `[DOMAIN_SUMMARY]
Domain: Career / Work
Current state: OK
What's working: Craft
What's not working: Energy
Key tension: Balance
Stated intention: Rest
Status: stable
[/DOMAIN_SUMMARY]
[DOMAIN_SUMMARY]
Domain: Health / Body
Current state: Fine
What's working: Exercise
What's not working: Sleep
Key tension: Time
Stated intention: Sleep earlier
Status: needs_attention
[/DOMAIN_SUMMARY]
[DOMAIN_SUMMARY]
Domain: Finances
Current state: Tight
What's working: No debt
What's not working: Savings
Key tension: Spending
Stated intention: Save more
Status: stable
[/DOMAIN_SUMMARY]`

    const result = parseMessage(content)
    const blocks = result.segments.filter((s) => s.type === 'block')
    expect(blocks).toHaveLength(3)
    if (blocks[0].type === 'block' && blocks[0].blockType === 'domain_summary') {
      expect(blocks[0].data.domain).toBe('Career / Work')
    }
    if (blocks[1].type === 'block' && blocks[1].blockType === 'domain_summary') {
      expect(blocks[1].data.domain).toBe('Health / Body')
    }
    if (blocks[2].type === 'block' && blocks[2].blockType === 'domain_summary') {
      expect(blocks[2].data.domain).toBe('Finances')
    }
  })

  it('handles mixed block types (domain + synthesis)', () => {
    const content = `[DOMAIN_SUMMARY]
Domain: Career / Work
Current state: OK
What's working: Craft
What's not working: Energy
Key tension: Balance
Stated intention: Rest
Status: stable
[/DOMAIN_SUMMARY]

[LIFE_MAP_SYNTHESIS]
Narrative: Overall picture
Primary compounding engine: Side project
Quarterly priorities: Build, Rest, Connect
Key tensions: Work vs rest
Anti-goals: No overcommitting
[/LIFE_MAP_SYNTHESIS]`

    const result = parseMessage(content)
    const blocks = result.segments.filter((s) => s.type === 'block')
    expect(blocks).toHaveLength(2)
    if (blocks[0].type === 'block') expect(blocks[0].blockType).toBe('domain_summary')
    if (blocks[1].type === 'block') expect(blocks[1].blockType).toBe('life_map_synthesis')
  })

  it('handles malformed second block (first renders, second falls back to text)', () => {
    const content = `[DOMAIN_SUMMARY]
Domain: Career / Work
Current state: OK
What's working: Craft
What's not working: Energy
Key tension: Balance
Stated intention: Rest
Status: stable
[/DOMAIN_SUMMARY]

[DOMAIN_SUMMARY]
Domain: Broken block no closing tag`

    const result = parseMessage(content)
    expect(result.segments).toHaveLength(2)
    expect(result.segments[0].type).toBe('block')
    expect(result.segments[1].type).toBe('text')
    if (result.segments[1].type === 'text') {
      expect(result.segments[1].content).toContain('Broken block no closing tag')
    }
  })

  it('handles no blocks (pure text message)', () => {
    const result = parseMessage('Just a regular message with no blocks at all.')
    expect(result.segments).toHaveLength(1)
    expect(result.segments[0]).toEqual({ type: 'text', content: 'Just a regular message with no blocks at all.' })
  })

  // --- FILE_UPDATE block tests ---

  it('parses a FILE_UPDATE block with type and name', () => {
    const content = `Here's your career update:

[FILE_UPDATE type="domain" name="Career / Work"]
# Career

## Current State
Senior PM at a startup, feeling stuck.

## What's Working
- Good at the craft
- Team respects you

## Key Tension
Security vs. entrepreneurial ambition.
[/FILE_UPDATE]

What else?`

    const result = parseMessage(content)
    expect(result.segments).toHaveLength(3)
    expect(result.segments[0]).toEqual({ type: 'text', content: "Here's your career update:" })
    expect(result.segments[2]).toEqual({ type: 'text', content: 'What else?' })

    const block = result.segments[1]
    expect(block.type).toBe('block')
    if (block.type === 'block') {
      expect(block.blockType).toBe('file_update')
      if (block.blockType === 'file_update') {
        expect(block.data.fileType).toBe('domain')
        expect(block.data.name).toBe('Career / Work')
        expect(block.data.content).toContain('# Career')
        expect(block.data.content).toContain('Senior PM at a startup')
      }
    }
  })

  it('parses a FILE_UPDATE block without name (singleton file)', () => {
    const content = `[FILE_UPDATE type="overview"]
# Life Map Overview

## Narrative Summary
Solo founder exploring MeOS while working full-time.

## Your North Star
**Career transition** -- because financial independence unlocks everything else.
[/FILE_UPDATE]`

    const result = parseMessage(content)
    expect(result.segments).toHaveLength(1)

    const block = result.segments[0]
    expect(block.type).toBe('block')
    if (block.type === 'block' && block.blockType === 'file_update') {
      expect(block.data.fileType).toBe('overview')
      expect(block.data.name).toBeUndefined()
      expect(block.data.content).toContain('Life Map Overview')
    }
  })

  it('parses multiple FILE_UPDATE blocks in one message', () => {
    const content = `[FILE_UPDATE type="domain" name="Career / Work"]
# Career
## Current State
Doing well.
[/FILE_UPDATE]

[FILE_UPDATE type="domain" name="Health / Body"]
# Health
## Current State
Need more sleep.
[/FILE_UPDATE]

[FILE_UPDATE type="overview"]
# Life Map Overview
## Narrative Summary
Updated after check-in.
[/FILE_UPDATE]`

    const result = parseMessage(content)
    const blocks = result.segments.filter((s) => s.type === 'block')
    expect(blocks).toHaveLength(3)

    if (blocks[0].type === 'block' && blocks[0].blockType === 'file_update') {
      expect(blocks[0].data.fileType).toBe('domain')
      expect(blocks[0].data.name).toBe('Career / Work')
    }
    if (blocks[1].type === 'block' && blocks[1].blockType === 'file_update') {
      expect(blocks[1].data.fileType).toBe('domain')
      expect(blocks[1].data.name).toBe('Health / Body')
    }
    if (blocks[2].type === 'block' && blocks[2].blockType === 'file_update') {
      expect(blocks[2].data.fileType).toBe('overview')
      expect(blocks[2].data.name).toBeUndefined()
    }
  })

  it('handles malformed FILE_UPDATE with no closing tag', () => {
    const content = `Here's a partial block:

[FILE_UPDATE type="domain" name="Career / Work"]
# Career
Incomplete block`

    const result = parseMessage(content)
    expect(result.segments).toHaveLength(1)
    expect(result.segments[0].type).toBe('text')
  })

  it('handles mixed FILE_UPDATE and legacy blocks', () => {
    const content = `[FILE_UPDATE type="domain" name="Career / Work"]
# Career
## Current State
Updated via new format.
[/FILE_UPDATE]

[DOMAIN_SUMMARY]
Domain: Health / Body
Current state: Fine
What's working: Exercise
What's not working: Sleep
Key tension: Time
Stated intention: Sleep earlier
Status: stable
[/DOMAIN_SUMMARY]`

    const result = parseMessage(content)
    const blocks = result.segments.filter((s) => s.type === 'block')
    expect(blocks).toHaveLength(2)
    if (blocks[0].type === 'block') expect(blocks[0].blockType).toBe('file_update')
    if (blocks[1].type === 'block') expect(blocks[1].blockType).toBe('domain_summary')
  })

  it('parses FILE_UPDATE with life-plan type', () => {
    const content = `[FILE_UPDATE type="life-plan"]
# Life Plan -- Q1 2026

## Quarter Theme
Building the bridge.

## Active Commitments

### Have the conversation with my manager
**Why it matters:** Directly addresses career plateau.
**Status:** in_progress

#### Next Steps
- [x] Draft talking points
- [ ] Schedule the 1:1
[/FILE_UPDATE]`

    const result = parseMessage(content)
    expect(result.segments).toHaveLength(1)

    const block = result.segments[0]
    if (block.type === 'block' && block.blockType === 'file_update') {
      expect(block.data.fileType).toBe('life-plan')
      expect(block.data.content).toContain('Quarter Theme')
      expect(block.data.content).toContain('Active Commitments')
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
    expect(result.completedBlock?.type).toBe('domain_summary')
  })

  it('detects pending FILE_UPDATE block during streaming', () => {
    const result = parseStreamingChunk('Here we go:\n\n[FILE_UPDATE type="domain" name="Career / Work"]\n# Career')
    expect(result.displayText).toBe('Here we go:')
    expect(result.pendingBlock).toBe(true)
    expect(result.completedBlock).toBeNull()
  })

  it('returns completed FILE_UPDATE block when closing tag detected', () => {
    const accumulated = `Summary:

[FILE_UPDATE type="domain" name="Health / Body"]
# Health
## Current State
Good overall.
[/FILE_UPDATE]

Next?`

    const result = parseStreamingChunk(accumulated)
    expect(result.displayText).toBe('Summary:')
    expect(result.pendingBlock).toBe(false)
    expect(result.completedBlock).not.toBeNull()
    expect(result.completedBlock?.type).toBe('file_update')
    if (result.completedBlock?.type === 'file_update') {
      expect(result.completedBlock.data.fileType).toBe('domain')
      expect(result.completedBlock.data.name).toBe('Health / Body')
    }
  })
})
