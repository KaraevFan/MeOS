'use client'

import { useState, useRef, useEffect } from 'react'
import type { FileUpdateData } from '@/types/chat'
import { escapeHtml, renderInlineMarkdownToHtml } from '@/lib/markdown/render-inline'

interface MarkdownSynthesisCardProps {
  data: FileUpdateData
}

/** Extract sections from overview markdown content */
function extractOverviewSections(markdown: string): { narrative: string; sections: { label: string; items: string[] }[] } {
  const lines = markdown.split('\n')
  let narrative = ''
  const sections: { label: string; items: string[] }[] = []

  let currentLabel: string | null = null
  let currentItems: string[] = []
  let collectingNarrative = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip # top-level heading
    if (trimmed.startsWith('# ')) continue

    const headingMatch = trimmed.match(/^##\s+(.+)$/)
    if (headingMatch) {
      // Save previous section
      if (currentLabel && currentItems.length > 0) {
        sections.push({ label: currentLabel, items: currentItems })
      }
      currentLabel = headingMatch[1]
      currentItems = []
      collectingNarrative = currentLabel.toLowerCase().includes('narrative') ||
        currentLabel.toLowerCase().includes('overview')
      continue
    }

    if (collectingNarrative && trimmed) {
      narrative += (narrative ? '\n' : '') + trimmed
    } else if (currentLabel && trimmed) {
      // Clean list items
      const cleaned = trimmed.replace(/^-\s*/, '').replace(/^s\s*-\s*/, '').replace(/^\d+[\)\.]\s*/, '')
      if (cleaned) currentItems.push(cleaned)
    }
  }

  // Save last section
  if (currentLabel && currentItems.length > 0) {
    sections.push({ label: currentLabel, items: currentItems })
  }

  return { narrative, sections }
}

export function MarkdownSynthesisCard({ data }: MarkdownSynthesisCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [needsToggle, setNeedsToggle] = useState(false)
  const narrativeRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const { narrative, sections } = extractOverviewSections(data.content)

  useEffect(() => {
    if (narrativeRef.current) {
      setNeedsToggle(narrativeRef.current.scrollHeight > 70)
    }
  }, [narrative])

  return (
    <div className="w-full bg-bg-card rounded-lg shadow-md p-5 border-l-4 border-l-primary animate-fade-up">
      <h3 className="text-lg font-bold text-text mb-4">Your Life Map</h3>

      {/* Narrative */}
      {narrative && (
        <div className="mb-4">
          <div
            ref={narrativeRef}
            className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
            style={{
              maxHeight: !expanded ? '4.2em' : contentRef.current?.scrollHeight ? `${contentRef.current.scrollHeight}px` : '1000px',
            }}
          >
            <div ref={contentRef}>
              <div
                className="text-sm text-text leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderInlineMarkdownToHtml(escapeHtml(narrative)) }}
              />
            </div>
          </div>
          {needsToggle && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs font-medium text-primary hover:text-primary-hover mt-1 transition-colors"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      )}

      {/* Sections */}
      {sections.map((section, i) => (
        <div key={i} className="mb-4 last:mb-0">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
            {section.label}
          </p>
          <ul className="text-sm text-text space-y-1">
            {section.items.map((item, j) => (
              <li key={j} className="flex items-start gap-1.5">
                <span className="text-primary mt-0.5">&bull;</span>
                <span dangerouslySetInnerHTML={{ __html: renderInlineMarkdownToHtml(escapeHtml(item)) }} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
