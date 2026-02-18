import { describe, it, expect } from 'vitest'
import { resolveFileUpdatePath } from './file-write-handler'
import { SESSION_WRITE_PERMISSIONS } from './constants'
import { generateCaptureFrontmatter, generateDayPlanFrontmatter } from './frontmatter'
import type { FileUpdateData } from '@/types/chat'

describe('resolveFileUpdatePath — day-plan', () => {
  it('resolves day-plan with name to correct path', () => {
    const update: FileUpdateData = {
      fileType: 'day-plan',
      name: '2026-02-18',
      content: '## Intention\n"Focus on the proposal"',
    }
    expect(resolveFileUpdatePath(update)).toBe('day-plans/2026-02-18.md')
  })

  it('resolves day-plan without name to today\'s date path', () => {
    const update: FileUpdateData = {
      fileType: 'day-plan',
      content: '## Intention\n"Something"',
    }
    const result = resolveFileUpdatePath(update)
    expect(result).toMatch(/^day-plans\/\d{4}-\d{2}-\d{2}\.md$/)
  })
})

describe('SESSION_WRITE_PERMISSIONS — captures', () => {
  it('allows quick_capture to write to captures/', () => {
    const perms = SESSION_WRITE_PERMISSIONS['quick_capture']
    expect(perms).toBeDefined()
    expect(perms.some((p) => 'captures/2026-02-18-141500.md'.startsWith(p))).toBe(true)
  })

  it('denies quick_capture writing to daily-logs/', () => {
    const perms = SESSION_WRITE_PERMISSIONS['quick_capture']
    expect(perms.some((p) => 'daily-logs/2026-02-18-journal.md'.startsWith(p))).toBe(false)
  })

  it('denies quick_capture writing to life-map/', () => {
    const perms = SESSION_WRITE_PERMISSIONS['quick_capture']
    expect(perms.some((p) => 'life-map/career.md'.startsWith(p))).toBe(false)
  })

  it('allows close_day to write to captures/ (for folded_into_journal)', () => {
    const perms = SESSION_WRITE_PERMISSIONS['close_day']
    expect(perms.some((p) => 'captures/2026-02-18-141500.md'.startsWith(p))).toBe(true)
  })

  it('allows open_day to write to day-plans/', () => {
    const perms = SESSION_WRITE_PERMISSIONS['open_day']
    expect(perms).toBeDefined()
    expect(perms.some((p) => 'day-plans/2026-02-18.md'.startsWith(p))).toBe(true)
  })

  it('denies open_day writing to captures/', () => {
    const perms = SESSION_WRITE_PERMISSIONS['open_day']
    expect(perms.some((p) => 'captures/2026-02-18-141500.md'.startsWith(p))).toBe(false)
  })
})

describe('generateCaptureFrontmatter', () => {
  it('generates default capture frontmatter', () => {
    const fm = generateCaptureFrontmatter('2026-02-18')
    expect(fm.date).toBe('2026-02-18')
    expect(fm.type).toBe('capture')
    expect(fm.input_mode).toBe('text')
    expect(fm.classification).toBeNull()
    expect(fm.auto_tags).toEqual([])
    expect(fm.folded_into_journal).toBe(false)
    expect(fm.timestamp).toBeDefined()
  })

  it('applies overrides to capture frontmatter', () => {
    const fm = generateCaptureFrontmatter('2026-02-18', {
      input_mode: 'voice',
      timestamp: '2026-02-18T14:15:00Z',
      classification: 'task',
      auto_tags: ['work', 'urgent'],
    })
    expect(fm.input_mode).toBe('voice')
    expect(fm.timestamp).toBe('2026-02-18T14:15:00Z')
    expect(fm.classification).toBe('task')
    expect(fm.auto_tags).toEqual(['work', 'urgent'])
    expect(fm.folded_into_journal).toBe(false)
  })

  it('allows folded_into_journal override', () => {
    const fm = generateCaptureFrontmatter('2026-02-18', {
      folded_into_journal: true,
    })
    expect(fm.folded_into_journal).toBe(true)
  })
})

describe('generateDayPlanFrontmatter', () => {
  it('generates default day plan frontmatter', () => {
    const fm = generateDayPlanFrontmatter('2026-02-18')
    expect(fm.date).toBe('2026-02-18')
    expect(fm.type).toBe('day-plan')
    expect(fm.status).toBe('active')
    expect(fm.intention).toBeUndefined()
    expect(fm.checkin_response).toBeUndefined()
  })

  it('applies intention override', () => {
    const fm = generateDayPlanFrontmatter('2026-02-18', {
      intention: 'Focus on the proposal',
    })
    expect(fm.intention).toBe('Focus on the proposal')
  })

  it('applies checkin_response override', () => {
    const fm = generateDayPlanFrontmatter('2026-02-18', {
      checkin_response: 'yes',
    })
    expect(fm.checkin_response).toBe('yes')
  })

  it('applies carried_forward_from override', () => {
    const fm = generateDayPlanFrontmatter('2026-02-18', {
      carried_forward_from: '2026-02-17',
    })
    expect(fm.carried_forward_from).toBe('2026-02-17')
  })
})

describe('FILE_UPDATE parser — day-plan with intention attribute', () => {
  // These tests verify the parser correctly extracts the intention attribute
  // from the FILE_UPDATE tag. The parser test file already covers the general
  // FILE_UPDATE parsing; these test the specific day-plan + intention case.

  it('parser extracts intention from day-plan FILE_UPDATE tag', async () => {
    const { parseMessage } = await import('@/lib/ai/parser')

    const content = `Locked in. I'll have this waiting for you tonight.

[FILE_UPDATE type="day-plan" name="2026-02-18" intention="Focus on the proposal"]
## Intention
"Focus on the proposal"

## Focus Blocks
- 08:00–10:00  Deep work on proposal
[/FILE_UPDATE]`

    const result = parseMessage(content)
    const block = result.segments.find((s) => s.type === 'block')
    expect(block).toBeDefined()
    if (block?.type === 'block' && block.blockType === 'file_update') {
      expect(block.data.fileType).toBe('day-plan')
      expect(block.data.name).toBe('2026-02-18')
      expect(block.data.attributes?.intention).toBe('Focus on the proposal')
    }
  })
})
