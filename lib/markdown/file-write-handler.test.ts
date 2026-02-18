import { describe, it, expect } from 'vitest'
import { resolveFileUpdatePath } from './file-write-handler'
import { SESSION_WRITE_PERMISSIONS } from './constants'
import type { FileUpdateData } from '@/types/chat'

describe('resolveFileUpdatePath', () => {
  it('resolves daily-log with name to correct path', () => {
    const update: FileUpdateData = {
      fileType: 'daily-log',
      name: '2026-02-18',
      content: '# Evening Reflection\nGood day.',
    }
    expect(resolveFileUpdatePath(update)).toBe('daily-logs/2026-02-18-journal.md')
  })

  it('resolves daily-log without name to today\'s date path', () => {
    const update: FileUpdateData = {
      fileType: 'daily-log',
      content: '# Evening Reflection',
    }
    const result = resolveFileUpdatePath(update)
    expect(result).toMatch(/^daily-logs\/\d{4}-\d{2}-\d{2}-journal\.md$/)
  })

  it('resolves domain type with valid name', () => {
    const update: FileUpdateData = {
      fileType: 'domain',
      name: 'Career / Work',
      content: '# Career',
    }
    expect(resolveFileUpdatePath(update)).toBe('life-map/career.md')
  })

  it('resolves overview type', () => {
    const update: FileUpdateData = {
      fileType: 'overview',
      content: '# Overview',
    }
    expect(resolveFileUpdatePath(update)).toBe('life-map/_overview.md')
  })

  it('resolves sage-context type', () => {
    const update: FileUpdateData = {
      fileType: 'sage-context',
      content: '# Context',
    }
    expect(resolveFileUpdatePath(update)).toBe('sage/context.md')
  })

  it('returns null for domain without name', () => {
    const update: FileUpdateData = {
      fileType: 'domain',
      content: '# Career',
    }
    expect(resolveFileUpdatePath(update)).toBeNull()
  })

  it('returns null for unknown file type', () => {
    const update = {
      fileType: 'nonexistent',
      content: 'test',
    } as unknown as FileUpdateData
    expect(resolveFileUpdatePath(update)).toBeNull()
  })
})

describe('SESSION_WRITE_PERMISSIONS', () => {
  it('allows close_day to write to daily-logs/', () => {
    const perms = SESSION_WRITE_PERMISSIONS['close_day']
    expect(perms).toBeDefined()
    expect(perms.some((p) => 'daily-logs/2026-02-18-journal.md'.startsWith(p))).toBe(true)
  })

  it('allows close_day to write to sage/context.md', () => {
    const perms = SESSION_WRITE_PERMISSIONS['close_day']
    expect(perms.some((p) => 'sage/context.md'.startsWith(p) || 'sage/context.md' === p)).toBe(true)
  })

  it('denies close_day writing to life-map/', () => {
    const perms = SESSION_WRITE_PERMISSIONS['close_day']
    expect(perms.some((p) => 'life-map/career.md'.startsWith(p))).toBe(false)
  })

  it('denies close_day writing to check-ins/', () => {
    const perms = SESSION_WRITE_PERMISSIONS['close_day']
    expect(perms.some((p) => 'check-ins/2026-02-18-weekly.md'.startsWith(p))).toBe(false)
  })

  it('allows life_mapping to write to life-map/', () => {
    const perms = SESSION_WRITE_PERMISSIONS['life_mapping']
    expect(perms.some((p) => 'life-map/career.md'.startsWith(p))).toBe(true)
  })

  it('allows weekly_checkin to write to check-ins/', () => {
    const perms = SESSION_WRITE_PERMISSIONS['weekly_checkin']
    expect(perms.some((p) => 'check-ins/2026-02-18-weekly.md'.startsWith(p))).toBe(true)
  })

  it('allows weekly_checkin to write to daily-logs/ (for reference)', () => {
    // weekly_checkin shouldn't write to daily-logs — verify the current config
    const perms = SESSION_WRITE_PERMISSIONS['weekly_checkin']
    const canWrite = perms.some((p) => 'daily-logs/2026-02-18-journal.md'.startsWith(p))
    // This should be false — weekly_checkin doesn't write journals
    expect(canWrite).toBe(false)
  })
})
