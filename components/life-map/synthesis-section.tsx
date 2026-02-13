import type { LifeMap } from '@/types/database'

interface SynthesisSectionProps {
  lifeMap: LifeMap
}

export function SynthesisSection({ lifeMap }: SynthesisSectionProps) {
  const hasSynthesis = lifeMap.narrative_summary ||
    lifeMap.primary_compounding_engine ||
    (lifeMap.quarterly_priorities && lifeMap.quarterly_priorities.length > 0)

  if (!hasSynthesis) return null

  return (
    <div className="bg-bg-card rounded-lg shadow-sm p-5 border border-border">
      {/* Narrative */}
      {lifeMap.narrative_summary && (
        <div className="mb-4">
          <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">
            {lifeMap.narrative_summary}
          </p>
        </div>
      )}

      {/* Primary Compounding Engine */}
      {lifeMap.primary_compounding_engine && (
        <div className="mb-4 bg-primary/10 rounded-md px-3 py-2">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-0.5">
            Primary compounding engine
          </p>
          <p className="text-sm text-text font-bold">
            {lifeMap.primary_compounding_engine}
          </p>
        </div>
      )}

      {/* Quarterly Priorities */}
      {lifeMap.quarterly_priorities && lifeMap.quarterly_priorities.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
            Quarterly priorities
          </p>
          <ol className="text-sm text-text space-y-1">
            {lifeMap.quarterly_priorities.map((p, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-primary font-bold">{i + 1}.</span>
                <span>{p.replace(/^\d+[\)\.]\s*/, '')}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Key Tensions */}
      {lifeMap.key_tensions && lifeMap.key_tensions.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
            Key tensions
          </p>
          <ul className="text-sm text-text space-y-1">
            {lifeMap.key_tensions.map((t, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-accent-terra mt-0.5">&bull;</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Anti-goals */}
      {lifeMap.anti_goals && lifeMap.anti_goals.length > 0 && (
        <div>
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
            Anti-goals
          </p>
          <ul className="text-sm text-text space-y-1">
            {lifeMap.anti_goals.map((g, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-text-secondary mt-0.5">&times;</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
