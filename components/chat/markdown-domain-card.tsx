'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { FileUpdateData } from '@/types/chat'

const STATUS_COLORS: Record<string, string> = {
  thriving: 'bg-status-thriving',
  stable: 'bg-status-stable',
  needs_attention: 'bg-status-attention',
  in_crisis: 'bg-status-crisis',
}

const STATUS_LABELS: Record<string, string> = {
  thriving: 'Thriving',
  stable: 'Stable',
  needs_attention: 'Needs attention',
  in_crisis: 'In crisis',
}

/** Known section headings in domain file markdown */
const SECTION_HEADINGS = [
  { heading: 'Current State', label: 'Current state' },
  { heading: "What's Working", label: "What's working" },
  { heading: 'Key Tension', label: 'Key tension' },
  { heading: 'Stated Intention', label: 'Stated intention' },
] as const

interface ParsedSection {
  label: string
  content: string
}

function parseSections(markdown: string): { status?: string; sections: ParsedSection[] } {
  const lines = markdown.split('\n')
  const sections: ParsedSection[] = []
  let status: string | undefined

  let currentLabel: string | null = null
  let currentLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    // Check for status in frontmatter-style line
    if (trimmed.startsWith('status:')) {
      status = trimmed.slice(7).trim()
      continue
    }

    // Check for ## heading
    const headingMatch = trimmed.match(/^##\s+(.+)$/)
    if (headingMatch) {
      // Save previous section
      if (currentLabel && currentLines.length > 0) {
        sections.push({ label: currentLabel, content: currentLines.join('\n').trim() })
      }

      const headingText = headingMatch[1]
      const known = SECTION_HEADINGS.find(
        (s) => headingText.toLowerCase() === s.heading.toLowerCase()
      )
      currentLabel = known ? known.label : headingText
      currentLines = []
      continue
    }

    // Skip # top-level headings (domain name)
    if (trimmed.startsWith('# ')) continue

    if (currentLabel) {
      currentLines.push(line)
    }
  }

  // Save last section
  if (currentLabel && currentLines.length > 0) {
    sections.push({ label: currentLabel, content: currentLines.join('\n').trim() })
  }

  return { status, sections }
}

/** Render inline markdown (bold, italic) */
function renderInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
}

/** Clean and render a section's content */
function SectionContent({ content, isItalic }: { content: string; isItalic?: boolean }) {
  // Split into lines, clean up list prefixes
  const lines = content.split('\n').filter((l) => l.trim())
  const isList = lines.some((l) => l.trim().startsWith('- ') || l.trim().startsWith('s - '))

  if (isList) {
    return (
      <ul className="text-sm text-text space-y-0.5">
        {lines.map((line, i) => {
          const cleaned = line.trim().replace(/^s\s*-\s*/, '').replace(/^-\s*/, '')
          return (
            <li key={i} className="flex items-start gap-1.5">
              <span className="text-primary mt-0.5">&bull;</span>
              <span
                className={isItalic ? 'italic' : ''}
                dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(cleaned) }}
              />
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <p
      className={cn('text-sm text-text', isItalic && 'italic')}
      dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(content) }}
    />
  )
}

interface MarkdownDomainCardProps {
  data: FileUpdateData
}

export function MarkdownDomainCard({ data }: MarkdownDomainCardProps) {
  const [expanded, setExpanded] = useState(true)
  const { status, sections } = parseSections(data.content)

  const statusKey = status?.toLowerCase().replace(/\s+/g, '_')

  return (
    <div className="w-full bg-bg-card rounded-lg shadow-md p-4 animate-fade-up relative">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-bold text-text">{data.name || 'Domain'}</h3>
        <div className="flex items-center gap-2">
          {statusKey && (
            <div className="flex items-center gap-1.5">
              <div className={cn('w-2 h-2 rounded-full', STATUS_COLORS[statusKey] || 'bg-status-stable')} />
              <span className="text-xs font-medium text-text-secondary">
                {STATUS_LABELS[statusKey] || status}
              </span>
            </div>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-text-secondary hover:text-text p-1 transition-colors"
            aria-label={expanded ? 'Collapse card' : 'Expand card'}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn('transition-transform', expanded ? 'rotate-180' : '')}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Sections */}
      {expanded && (
        <div className="space-y-3">
          {sections.map((section, i) => (
            <div key={i}>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-0.5">
                {section.label}
              </p>
              <SectionContent
                content={section.content}
                isItalic={section.label.toLowerCase() === 'key tension'}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
