'use client'

import { useState, useRef, useEffect } from 'react'
import type { LifeMapSynthesis } from '@/types/chat'

interface SynthesisCardProps {
  synthesis: LifeMapSynthesis
  isInline?: boolean
}

export function SynthesisCard({ synthesis, isInline = false }: SynthesisCardProps) {
  const [expanded, setExpanded] = useState(!isInline)
  const [needsToggle, setNeedsToggle] = useState(false)
  const narrativeRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Check if narrative is long enough to need collapsing (more than ~3 lines)
  useEffect(() => {
    if (isInline && narrativeRef.current) {
      // 3 lines at ~1.6 line-height with 14px font = ~67px
      setNeedsToggle(narrativeRef.current.scrollHeight > 70)
    }
  }, [isInline, synthesis.narrative])

  return (
    <div className="w-full bg-bg-card rounded-lg shadow-md p-5 border-l-4 border-l-primary animate-fade-up">
      <h3 className="text-lg font-bold text-text mb-4">Your Life Map</h3>

      {/* Narrative — collapsible in chat view */}
      {synthesis.narrative && (
        <div className="mb-4">
          <div
            ref={narrativeRef}
            className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
            style={{
              maxHeight: isInline && !expanded ? '4.2em' : contentRef.current?.scrollHeight ? `${contentRef.current.scrollHeight}px` : '1000px',
            }}
          >
            <div ref={contentRef}>
              <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{synthesis.narrative}</p>
            </div>
          </div>
          {isInline && needsToggle && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs font-medium text-primary hover:text-primary-hover mt-1 transition-colors"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      )}

      {/* Primary Compounding Engine */}
      {synthesis.primaryCompoundingEngine && (
        <div className="mb-4 bg-primary/10 rounded-md px-3 py-2">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-0.5">
            Primary compounding engine
          </p>
          <p className="text-sm text-text font-bold">{synthesis.primaryCompoundingEngine}</p>
        </div>
      )}

      {/* Quarterly Priorities */}
      {synthesis.quarterlyPriorities.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
            Quarterly priorities
          </p>
          <ol className="text-sm text-text space-y-1">
            {synthesis.quarterlyPriorities.map((priority, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-primary font-bold">{i + 1}.</span>
                <span>{priority.replace(/^\d+[\)\.]\s*/, '')}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Key Tensions */}
      {synthesis.keyTensions.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
            Key tensions to watch
          </p>
          <ul className="text-sm text-text space-y-1">
            {synthesis.keyTensions.map((tension, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-accent-terra mt-0.5">&bull;</span>
                <span>{tension}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Anti-Goals */}
      {synthesis.antiGoals.length > 0 && (
        <div>
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
            Anti-goals
          </p>
          <ul className="text-sm text-text space-y-1">
            {synthesis.antiGoals.map((goal, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-text-secondary mt-0.5">&times;</span>
                <span>{goal}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
