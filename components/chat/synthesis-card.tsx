'use client'

import type { LifeMapSynthesis } from '@/types/chat'

interface SynthesisCardProps {
  synthesis: LifeMapSynthesis
}

export function SynthesisCard({ synthesis }: SynthesisCardProps) {
  return (
    <div className="w-full bg-bg-card rounded-lg shadow-md p-5 border-l-4 border-l-primary animate-fade-up">
      <h3 className="text-lg font-bold text-text mb-4">Your Life Map</h3>

      {/* Narrative */}
      {synthesis.narrative && (
        <div className="mb-4">
          <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{synthesis.narrative}</p>
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
                <span>{priority}</span>
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
            Explicitly not doing now
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
