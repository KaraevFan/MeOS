import type { SupabaseClient } from '@supabase/supabase-js'
import matter from 'gray-matter'
import {
  STORAGE_BUCKET,
  ALLOWED_PATH_PREFIXES,
  SAFE_PATH_REGEX,
  DOMAIN_FILE_MAP,
  FILE_TYPES,
} from './constants'
import {
  generateDomainFrontmatter,
  generateOverviewFrontmatter,
  generateLifePlanFrontmatter,
  generateCheckInFrontmatter,
  generateSageContextFrontmatter,
  generatePatternsFrontmatter,
  generateDailyLogFrontmatter,
  generateDayPlanFrontmatter,
  generateWeeklyPlanFrontmatter,
  generateCaptureFrontmatter,
} from './frontmatter'
import {
  DomainFileFrontmatterSchema,
  OverviewFileFrontmatterSchema,
  LifePlanFileFrontmatterSchema,
  CheckInFileFrontmatterSchema,
  SageContextFrontmatterSchema,
  PatternsFrontmatterSchema,
  DailyLogFrontmatterSchema,
  DayPlanFrontmatterSchema,
  WeeklyPlanFrontmatterSchema,
  CaptureFrontmatterSchema,
} from '@/types/markdown-files'
import type {
  DomainFileFrontmatter,
  OverviewFileFrontmatter,
  LifePlanFileFrontmatter,
  CheckInFileFrontmatter,
  SageContextFrontmatter,
  PatternsFrontmatter,
  DailyLogFrontmatter,
  DayPlanFrontmatter,
  WeeklyPlanFrontmatter,
  CaptureFrontmatter,
  ParsedMarkdownFile,
} from '@/types/markdown-files'
import type { DomainName } from '@/types/chat'

const MAX_RETRIES = 2
const RETRY_DELAYS = [200, 800]

/**
 * Core service for reading/writing markdown files to Supabase Storage.
 * All file operations go through this layer.
 */
export class UserFileSystem {
  private supabase: SupabaseClient
  private userId: string
  private basePath: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
    this.basePath = `users/${userId}`
  }

  // ============================================
  // Core operations
  // ============================================

  /**
   * Read a markdown file from storage. Returns null if file doesn't exist.
   * Uses gray-matter to parse YAML frontmatter + markdown body.
   */
  async readFile(path: string): Promise<ParsedMarkdownFile | null> {
    this.validatePath(path)

    const fullPath = `${this.basePath}/${path}`
    const { data, error } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .download(fullPath)

    if (error) {
      // Most read errors are "file doesn't exist yet" — expected and non-fatal.
      // Only log at debug level to avoid noisy dev console errors.
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[UserFileSystem] Read error for ${path} (likely missing file)`)
      }
      return null
    }

    const text = await data.text()
    const parsed = matter(text)

    return {
      frontmatter: parsed.data as Record<string, unknown>,
      content: parsed.content.trim(),
    }
  }

  /**
   * Write a markdown file to storage. Combines frontmatter + content with gray-matter.
   * Retries up to MAX_RETRIES times on failure.
   */
  async writeFile(path: string, frontmatter: Record<string, unknown>, content: string): Promise<void> {
    this.validatePath(path)

    // Strip any YAML delimiters from content body (security: prevent frontmatter injection)
    const sanitizedContent = content.replace(/^---\s*$/gm, '– – –')

    // Strip undefined values — js-yaml 4.x throws on undefined
    const cleanedFrontmatter = Object.fromEntries(
      Object.entries(frontmatter).filter(([, v]) => v !== undefined)
    )

    const fileContent = matter.stringify(sanitizedContent, cleanedFrontmatter)
    const fullPath = `${this.basePath}/${path}`
    const blob = new Blob([fileContent], { type: 'text/markdown' })

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const { error } = await this.supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fullPath, blob, {
          upsert: true,
          contentType: 'text/markdown',
        })

      if (!error) {
        return
      }

      lastError = new Error(error.message)
      console.warn(`[UserFileSystem] Write attempt ${attempt + 1} failed for ${path}:`, error.message)

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAYS[attempt])
      }
    }

    throw lastError ?? new Error(`Failed to write ${path}`)
  }

  /**
   * List files under a prefix. Returns relative paths (without user prefix).
   */
  async listFiles(prefix: string): Promise<string[]> {
    // Validate prefix is within allowed paths
    if (prefix.includes('..')) {
      throw new Error(`[UserFileSystem] Path traversal rejected: ${prefix}`)
    }
    const isAllowed = ALLOWED_PATH_PREFIXES.some((allowed) => prefix.startsWith(allowed))
    if (!isAllowed) {
      throw new Error(`[UserFileSystem] Prefix outside allowed paths: ${prefix}`)
    }

    const fullPrefix = `${this.basePath}/${prefix}`
    const { data, error } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .list(fullPrefix, { sortBy: { column: 'name', order: 'desc' } })

    if (error) {
      console.error(`[UserFileSystem] List error for ${prefix}:`, error.message)
      return []
    }

    return (data ?? [])
      .filter((item) => item.name.endsWith('.md'))
      .map((item) => `${prefix}${item.name}`)
  }

  /**
   * Check if a file exists in storage (metadata-only, no content download).
   */
  async fileExists(path: string): Promise<boolean> {
    this.validatePath(path)
    const fullPrefix = `${this.basePath}/${path.substring(0, path.lastIndexOf('/') + 1)}`
    const filename = path.substring(path.lastIndexOf('/') + 1)
    const { data } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .list(fullPrefix, { search: filename, limit: 1 })
    return (data?.length ?? 0) > 0
  }

  /**
   * Delete a file from storage.
   */
  async deleteFile(path: string): Promise<void> {
    this.validatePath(path)
    const fullPath = `${this.basePath}/${path}`
    const { error } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .remove([fullPath])

    if (error) {
      console.error(`[UserFileSystem] Delete error for ${path}:`, error.message)
    }
  }

  // ============================================
  // Validated read operations
  // ============================================

  async readDomain(domainFilename: string): Promise<ParsedMarkdownFile<DomainFileFrontmatter> | null> {
    const file = await this.readFile(`life-map/${domainFilename}.md`)
    if (!file) return null

    const parsed = DomainFileFrontmatterSchema.safeParse(file.frontmatter)
    return {
      frontmatter: parsed.success ? parsed.data : file.frontmatter as DomainFileFrontmatter,
      content: file.content,
    }
  }

  async readDomainByName(domainName: DomainName): Promise<ParsedMarkdownFile<DomainFileFrontmatter> | null> {
    const filename = DOMAIN_FILE_MAP[domainName]
    if (!filename) return null
    return this.readDomain(filename)
  }

  async readOverview(): Promise<ParsedMarkdownFile<OverviewFileFrontmatter> | null> {
    const file = await this.readFile('life-map/_overview.md')
    if (!file) return null

    const parsed = OverviewFileFrontmatterSchema.safeParse(file.frontmatter)
    return {
      frontmatter: parsed.success ? parsed.data : file.frontmatter as OverviewFileFrontmatter,
      content: file.content,
    }
  }

  async readLifePlan(): Promise<ParsedMarkdownFile<LifePlanFileFrontmatter> | null> {
    const file = await this.readFile('life-plan/current.md')
    if (!file) return null

    const parsed = LifePlanFileFrontmatterSchema.safeParse(file.frontmatter)
    return {
      frontmatter: parsed.success ? parsed.data : file.frontmatter as LifePlanFileFrontmatter,
      content: file.content,
    }
  }

  async readSageContext(): Promise<ParsedMarkdownFile<SageContextFrontmatter> | null> {
    const file = await this.readFile('sage/context.md')
    if (!file) return null

    const parsed = SageContextFrontmatterSchema.safeParse(file.frontmatter)
    return {
      frontmatter: parsed.success ? parsed.data : file.frontmatter as SageContextFrontmatter,
      content: file.content,
    }
  }

  async readCheckIn(filename: string): Promise<ParsedMarkdownFile<CheckInFileFrontmatter> | null> {
    const file = await this.readFile(`check-ins/${filename}`)
    if (!file) return null

    const parsed = CheckInFileFrontmatterSchema.safeParse(file.frontmatter)
    return {
      frontmatter: parsed.success ? parsed.data : file.frontmatter as CheckInFileFrontmatter,
      content: file.content,
    }
  }

  async readPatterns(): Promise<ParsedMarkdownFile<PatternsFrontmatter> | null> {
    const file = await this.readFile('sage/patterns.md')
    if (!file) return null

    const parsed = PatternsFrontmatterSchema.safeParse(file.frontmatter)
    return {
      frontmatter: parsed.success ? parsed.data : file.frontmatter as PatternsFrontmatter,
      content: file.content,
    }
  }

  async readDailyLog(date: string): Promise<ParsedMarkdownFile<DailyLogFrontmatter> | null> {
    const file = await this.readFile(`daily-logs/${date}-journal.md`)
    if (!file) return null

    const parsed = DailyLogFrontmatterSchema.safeParse(file.frontmatter)
    if (!parsed.success) {
      console.warn('[UserFileSystem] Daily log frontmatter parse failed:', parsed.error.issues)
      return {
        frontmatter: { date, type: 'daily-journal' as const },
        content: file.content,
      }
    }
    return {
      frontmatter: parsed.data,
      content: file.content,
    }
  }

  /**
   * List daily log files, sorted newest first. Returns filenames (not full paths).
   */
  async listDailyLogs(limit?: number): Promise<string[]> {
    const files = await this.listFiles('daily-logs/')
    // listFiles already returns sorted desc by name from storage API
    const filenames = files.map((f) => f.replace('daily-logs/', ''))
    return limit ? filenames.slice(0, limit) : filenames
  }

  async readDayPlan(date: string): Promise<ParsedMarkdownFile<DayPlanFrontmatter> | null> {
    const file = await this.readFile(`day-plans/${date}.md`)
    if (!file) return null

    const parsed = DayPlanFrontmatterSchema.safeParse(file.frontmatter)
    if (!parsed.success) {
      return {
        frontmatter: { date, type: 'day-plan' as const, status: 'active' as const },
        content: file.content,
      }
    }
    return {
      frontmatter: parsed.data,
      content: file.content,
    }
  }

  /**
   * List day plan files, sorted newest first. Returns filenames (not full paths).
   */
  async listDayPlans(limit?: number): Promise<string[]> {
    const files = await this.listFiles('day-plans/')
    const filenames = files.map((f) => f.replace('day-plans/', ''))
    return limit ? filenames.slice(0, limit) : filenames
  }

  async readWeeklyPlan(): Promise<ParsedMarkdownFile<WeeklyPlanFrontmatter> | null> {
    const file = await this.readFile('life-plan/weekly.md')
    if (!file) return null

    const parsed = WeeklyPlanFrontmatterSchema.safeParse(file.frontmatter)
    if (!parsed.success) {
      return {
        frontmatter: { type: 'weekly-plan' as const, week_of: '', last_updated: '', status: 'active' as const, priorities: [], version: 1, schema_version: 1 },
        content: file.content,
      }
    }
    return {
      frontmatter: parsed.data,
      content: file.content,
    }
  }

  async readCapture(filename: string): Promise<ParsedMarkdownFile<CaptureFrontmatter> | null> {
    const file = await this.readFile(`captures/${filename}`)
    if (!file) return null

    const parsed = CaptureFrontmatterSchema.safeParse(file.frontmatter)
    if (!parsed.success) {
      return {
        frontmatter: { date: '', type: 'capture' as const, timestamp: '', input_mode: 'text' as const, classification: null, auto_tags: [], folded_into_journal: false },
        content: file.content,
      }
    }
    return {
      frontmatter: parsed.data,
      content: file.content,
    }
  }

  /**
   * List capture files for a given date (or all captures), sorted newest first.
   * Returns filenames (not full paths).
   */
  async listCaptures(date?: string, limit?: number): Promise<string[]> {
    const files = await this.listFiles('captures/')
    const filenames = files.map((f) => f.replace('captures/', ''))
    // Filter by date prefix if provided (captures are named {date}-{HHmmss}.md)
    const filtered = date ? filenames.filter((f) => f.startsWith(date)) : filenames
    return limit ? filtered.slice(0, limit) : filtered
  }

  /**
   * List check-in files, sorted newest first. Returns filenames (not full paths).
   */
  async listCheckIns(limit?: number): Promise<string[]> {
    const files = await this.listFiles('check-ins/')
    // listFiles already returns sorted desc by name from storage API
    // Strip the prefix so results can be passed directly to readCheckIn()
    const filenames = files.map((f) => f.replace('check-ins/', ''))
    return limit ? filenames.slice(0, limit) : filenames
  }

  // ============================================
  // Validated write operations
  // ============================================

  async writeDomain(
    domainFilename: string,
    content: string,
    overrides?: Partial<DomainFileFrontmatter>,
    existingFrontmatter?: Partial<DomainFileFrontmatter> | null
  ): Promise<void> {
    const existing = existingFrontmatter !== undefined ? existingFrontmatter : (await this.readDomain(domainFilename))?.frontmatter ?? null
    const frontmatter = generateDomainFrontmatter(
      existing,
      { domain: domainFilename, ...overrides }
    )
    await this.writeFile(`life-map/${domainFilename}.md`, frontmatter, content)
    await this.updateFileIndex(`life-map/${domainFilename}.md`, FILE_TYPES.DOMAIN, frontmatter, domainFilename)
  }

  async writeOverview(content: string, overrides?: Partial<OverviewFileFrontmatter>, existingFrontmatter?: Partial<OverviewFileFrontmatter> | null): Promise<void> {
    const existing = existingFrontmatter !== undefined ? existingFrontmatter : (await this.readOverview())?.frontmatter ?? null
    const frontmatter = generateOverviewFrontmatter(
      existing,
      { user_id: this.userId, ...overrides }
    )
    await this.writeFile('life-map/_overview.md', frontmatter, content)
    await this.updateFileIndex('life-map/_overview.md', FILE_TYPES.OVERVIEW, frontmatter)
  }

  async writeLifePlan(content: string, overrides?: Partial<LifePlanFileFrontmatter>, existingFrontmatter?: Partial<LifePlanFileFrontmatter> | null): Promise<void> {
    const existing = existingFrontmatter !== undefined ? existingFrontmatter : (await this.readLifePlan())?.frontmatter ?? null
    const frontmatter = generateLifePlanFrontmatter(
      existing,
      overrides ?? {}
    )
    await this.writeFile('life-plan/current.md', frontmatter, content)
    await this.updateFileIndex('life-plan/current.md', FILE_TYPES.LIFE_PLAN, frontmatter)
  }

  async writeCheckIn(date: string, content: string, metadata: Partial<CheckInFileFrontmatter>): Promise<void> {
    const frontmatter = generateCheckInFrontmatter({ ...metadata, date })
    const sessionType = metadata.type === 'weekly-check-in' ? 'weekly' : metadata.type ?? 'weekly'
    const filename = `${date}-${sessionType}.md`
    await this.writeFile(`check-ins/${filename}`, frontmatter, content)
    await this.updateFileIndex(`check-ins/${filename}`, FILE_TYPES.CHECK_IN, frontmatter)
  }

  async writeDailyLog(date: string, content: string, overrides?: Partial<DailyLogFrontmatter>): Promise<void> {
    const frontmatter = generateDailyLogFrontmatter(date, overrides)
    const filename = `${date}-journal.md`
    await this.writeFile(`daily-logs/${filename}`, frontmatter, content)
    await this.updateFileIndex(`daily-logs/${filename}`, FILE_TYPES.DAILY_LOG, frontmatter)
  }

  async writeDayPlan(date: string, content: string, overrides?: Partial<DayPlanFrontmatter>): Promise<void> {
    const frontmatter = generateDayPlanFrontmatter(date, overrides)
    const filename = `${date}.md`
    await this.writeFile(`day-plans/${filename}`, frontmatter, content)
    await this.updateFileIndex(`day-plans/${filename}`, FILE_TYPES.DAY_PLAN, frontmatter)
  }

  async writeWeeklyPlan(content: string, weekOf: string, overrides?: Partial<WeeklyPlanFrontmatter>): Promise<void> {
    const existing = (await this.readWeeklyPlan())?.frontmatter ?? null
    const frontmatter = generateWeeklyPlanFrontmatter(
      existing,
      { week_of: weekOf, ...overrides }
    )
    await this.writeFile('life-plan/weekly.md', frontmatter, content)
    await this.updateFileIndex('life-plan/weekly.md', FILE_TYPES.WEEKLY_PLAN, frontmatter)
  }

  async writeCapture(date: string, timeCode: string, content: string, overrides?: Partial<CaptureFrontmatter>): Promise<string> {
    const frontmatter = generateCaptureFrontmatter(date, overrides)
    const filename = `${date}-${timeCode}.md`
    await this.writeFile(`captures/${filename}`, frontmatter, content)
    await this.updateFileIndex(`captures/${filename}`, FILE_TYPES.CAPTURE, frontmatter)
    return filename
  }

  /**
   * Update a capture file's frontmatter (e.g., after classification or evening fold).
   * Reads the existing file, merges updates, and re-writes.
   */
  async updateCaptureFrontmatter(filename: string, updates: Partial<CaptureFrontmatter>): Promise<void> {
    const existing = await this.readCapture(filename)
    if (!existing) return

    const merged = { ...existing.frontmatter, ...updates }
    await this.writeFile(`captures/${filename}`, merged, existing.content)
    await this.updateFileIndex(`captures/${filename}`, FILE_TYPES.CAPTURE, merged)
  }

  async writeSageContext(content: string, overrides?: Partial<SageContextFrontmatter>, existingFrontmatter?: Partial<SageContextFrontmatter> | null): Promise<void> {
    const existing = existingFrontmatter !== undefined ? existingFrontmatter : (await this.readSageContext())?.frontmatter ?? null
    const frontmatter = generateSageContextFrontmatter(
      existing,
      overrides ?? {}
    )
    await this.writeFile('sage/context.md', frontmatter, content)
    await this.updateFileIndex('sage/context.md', FILE_TYPES.SAGE_CONTEXT, frontmatter)
  }

  async writePatterns(content: string, overrides?: Partial<PatternsFrontmatter>, existingFrontmatter?: Partial<PatternsFrontmatter> | null): Promise<void> {
    const existing = existingFrontmatter !== undefined ? existingFrontmatter : (await this.readPatterns())?.frontmatter ?? null
    const frontmatter = generatePatternsFrontmatter(
      existing,
      overrides ?? {}
    )
    await this.writeFile('sage/patterns.md', frontmatter, content)
    await this.updateFileIndex('sage/patterns.md', FILE_TYPES.SAGE_PATTERNS, frontmatter)
  }

  /**
   * Write session insights (cross-cutting patterns). No frontmatter needed —
   * this is an ephemeral file overwritten each session and subsumed by the overview during synthesis.
   */
  async writeSessionInsights(content: string): Promise<void> {
    const metadata = { last_updated: new Date().toISOString() }
    await this.writeFile('sage/session-insights.md', metadata, content)
    await this.updateFileIndex('sage/session-insights.md', FILE_TYPES.SESSION_INSIGHTS, metadata)
  }

  // ============================================
  // Index operations
  // ============================================

  /**
   * Update the file_index table after a successful file write.
   * Uses service-level upsert (server component context).
   */
  private async updateFileIndex(
    filePath: string,
    fileType: string,
    frontmatter: Record<string, unknown>,
    domainName?: string
  ): Promise<void> {
    const MAX_RETRIES = 2
    const payload = {
      user_id: this.userId,
      file_path: filePath,
      file_type: fileType,
      domain_name: domainName ?? null,
      status: (frontmatter.status as string) ?? null,
      quarter: (frontmatter.quarter as string) ?? null,
      last_updated: new Date().toISOString(),
      version: (frontmatter.version as number) ?? 1,
      frontmatter,
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { error } = await this.supabase
          .from('file_index')
          .upsert(payload, { onConflict: 'user_id,file_path' })

        if (error) throw error
        return
      } catch (err) {
        if (attempt < MAX_RETRIES) {
          // Exponential backoff: 200ms, 400ms
          await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt)))
          continue
        }
        // Final attempt failed — log structured error but don't crash
        console.error('[UserFileSystem] Index update failed after retries:', {
          filePath,
          fileType,
          userId: this.userId,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  /**
   * Rebuild the entire file index by reading all files. Used for recovery.
   */
  async rebuildIndex(): Promise<void> {
    const prefixes = ['life-map/', 'life-plan/', 'check-ins/', 'sage/', 'daily-logs/', 'day-plans/', 'captures/']
    for (const prefix of prefixes) {
      const files = await this.listFiles(prefix)
      for (const filePath of files) {
        const file = await this.readFile(filePath)
        if (!file) continue

        const fileType = this.inferFileType(filePath)
        const domainName = filePath.startsWith('life-map/') && !filePath.includes('_overview')
          ? filePath.replace('life-map/', '').replace('.md', '')
          : undefined

        await this.updateFileIndex(filePath, fileType, file.frontmatter, domainName)
      }
    }
  }

  // ============================================
  // Path validation & utilities
  // ============================================

  private validatePath(path: string): void {
    // Check for path traversal
    if (path.includes('..')) {
      throw new Error('[UserFileSystem] Path traversal rejected')
    }

    // Check against safe regex
    if (!SAFE_PATH_REGEX.test(path)) {
      throw new Error('[UserFileSystem] Invalid path format')
    }

    // Check against allowed prefixes
    const isAllowed = ALLOWED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))
    if (!isAllowed) {
      throw new Error('[UserFileSystem] Path outside allowed prefixes')
    }
  }

  private inferFileType(filePath: string): string {
    if (filePath === 'life-map/_overview.md') return FILE_TYPES.OVERVIEW
    if (filePath.startsWith('life-map/')) return FILE_TYPES.DOMAIN
    if (filePath === 'life-plan/weekly.md') return FILE_TYPES.WEEKLY_PLAN
    if (filePath.startsWith('life-plan/')) return FILE_TYPES.LIFE_PLAN
    if (filePath.startsWith('check-ins/')) return FILE_TYPES.CHECK_IN
    if (filePath === 'sage/context.md') return FILE_TYPES.SAGE_CONTEXT
    if (filePath === 'sage/patterns.md') return FILE_TYPES.SAGE_PATTERNS
    if (filePath === 'sage/session-insights.md') return FILE_TYPES.SESSION_INSIGHTS
    if (filePath.startsWith('daily-logs/')) return FILE_TYPES.DAILY_LOG
    if (filePath.startsWith('day-plans/')) return FILE_TYPES.DAY_PLAN
    if (filePath.startsWith('captures/')) return FILE_TYPES.CAPTURE
    return 'unknown'
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
