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
} from './frontmatter'
import {
  DomainFileFrontmatterSchema,
  OverviewFileFrontmatterSchema,
  LifePlanFileFrontmatterSchema,
  CheckInFileFrontmatterSchema,
  SageContextFrontmatterSchema,
  PatternsFrontmatterSchema,
} from '@/types/markdown-files'
import type {
  DomainFileFrontmatter,
  OverviewFileFrontmatter,
  LifePlanFileFrontmatter,
  CheckInFileFrontmatter,
  SageContextFrontmatter,
  PatternsFrontmatter,
  ParsedMarkdownFile,
} from '@/types/markdown-files'
import type { DomainName } from '@/types/chat'

const MAX_RETRIES = 2
const RETRY_DELAYS = [1000, 3000]

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
      // File not found is expected — return null gracefully
      if (error.message?.includes('not found') || error.message?.includes('Object not found')) {
        return null
      }
      console.error(`[UserFileSystem] Read error for ${path}:`, error.message)
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

    const fileContent = matter.stringify(sanitizedContent, frontmatter)
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
   * Check if a file exists in storage.
   */
  async fileExists(path: string): Promise<boolean> {
    const result = await this.readFile(path)
    return result !== null
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

  /**
   * List check-in files, sorted newest first. Returns filenames (not full paths).
   */
  async listCheckIns(limit?: number): Promise<string[]> {
    const files = await this.listFiles('check-ins/')
    const sorted = files.sort().reverse()
    return limit ? sorted.slice(0, limit) : sorted
  }

  // ============================================
  // Validated write operations
  // ============================================

  async writeDomain(
    domainFilename: string,
    content: string,
    overrides?: Partial<DomainFileFrontmatter>
  ): Promise<void> {
    const existing = await this.readDomain(domainFilename)
    const frontmatter = generateDomainFrontmatter(
      existing?.frontmatter ?? null,
      { domain: domainFilename, ...overrides }
    )
    await this.writeFile(`life-map/${domainFilename}.md`, frontmatter, content)
    await this.updateFileIndex(`life-map/${domainFilename}.md`, FILE_TYPES.DOMAIN, frontmatter, domainFilename)
  }

  async writeOverview(content: string, overrides?: Partial<OverviewFileFrontmatter>): Promise<void> {
    const existing = await this.readOverview()
    const frontmatter = generateOverviewFrontmatter(
      existing?.frontmatter ?? null,
      { user_id: this.userId, ...overrides }
    )
    await this.writeFile('life-map/_overview.md', frontmatter, content)
    await this.updateFileIndex('life-map/_overview.md', FILE_TYPES.OVERVIEW, frontmatter)
  }

  async writeLifePlan(content: string, overrides?: Partial<LifePlanFileFrontmatter>): Promise<void> {
    const existing = await this.readLifePlan()
    const frontmatter = generateLifePlanFrontmatter(
      existing?.frontmatter ?? null,
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

  async writeSageContext(content: string, overrides?: Partial<SageContextFrontmatter>): Promise<void> {
    const existing = await this.readSageContext()
    const frontmatter = generateSageContextFrontmatter(
      existing?.frontmatter ?? null,
      overrides ?? {}
    )
    await this.writeFile('sage/context.md', frontmatter, content)
    await this.updateFileIndex('sage/context.md', FILE_TYPES.SAGE_CONTEXT, frontmatter)
  }

  async writePatterns(content: string, overrides?: Partial<PatternsFrontmatter>): Promise<void> {
    const existing = await this.readPatterns()
    const frontmatter = generatePatternsFrontmatter(
      existing?.frontmatter ?? null,
      overrides ?? {}
    )
    await this.writeFile('sage/patterns.md', frontmatter, content)
    await this.updateFileIndex('sage/patterns.md', FILE_TYPES.SAGE_PATTERNS, frontmatter)
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
    try {
      await this.supabase.from('file_index').upsert(
        {
          user_id: this.userId,
          file_path: filePath,
          file_type: fileType,
          domain_name: domainName ?? null,
          status: (frontmatter.status as string) ?? null,
          quarter: (frontmatter.quarter as string) ?? null,
          last_updated: new Date().toISOString(),
          version: (frontmatter.version as number) ?? 1,
          frontmatter,
        },
        { onConflict: 'user_id,file_path' }
      )
    } catch (err) {
      // Index update is best-effort — don't fail the write
      console.error('[UserFileSystem] Index update failed:', err)
    }
  }

  /**
   * Rebuild the entire file index by reading all files. Used for recovery.
   */
  async rebuildIndex(): Promise<void> {
    const prefixes = ['life-map/', 'life-plan/', 'check-ins/', 'sage/']
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
      throw new Error(`[UserFileSystem] Path traversal rejected: ${path}`)
    }

    // Check against safe regex
    if (!SAFE_PATH_REGEX.test(path)) {
      throw new Error(`[UserFileSystem] Invalid path format: ${path}`)
    }

    // Check against allowed prefixes
    const isAllowed = ALLOWED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))
    if (!isAllowed) {
      throw new Error(`[UserFileSystem] Path outside allowed prefixes: ${path}`)
    }
  }

  private inferFileType(filePath: string): string {
    if (filePath === 'life-map/_overview.md') return FILE_TYPES.OVERVIEW
    if (filePath.startsWith('life-map/')) return FILE_TYPES.DOMAIN
    if (filePath.startsWith('life-plan/')) return FILE_TYPES.LIFE_PLAN
    if (filePath.startsWith('check-ins/')) return FILE_TYPES.CHECK_IN
    if (filePath === 'sage/context.md') return FILE_TYPES.SAGE_CONTEXT
    if (filePath === 'sage/patterns.md') return FILE_TYPES.SAGE_PATTERNS
    return 'unknown'
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
