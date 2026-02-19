'use client'

import type { FileUpdateData } from '@/types/chat'

interface JournalCardProps {
  data: FileUpdateData
}

const ENERGY_INDICATORS: Record<string, { label: string; color: string }> = {
  high: { label: 'High energy', color: 'bg-accent-sage' },
  moderate: { label: 'Moderate energy', color: 'bg-primary' },
  low: { label: 'Low energy', color: 'bg-accent-terra' },
}

function extractFirstParagraph(content: string): string {
  const lines = content.split('\n').filter((l) => l.trim() && !l.startsWith('#'))
  return lines[0]?.trim() ?? ''
}

/** Always use the client's current date — Sage's name attr may contain hallucinated dates. */
function formatDate(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

export function JournalCard({ data }: JournalCardProps) {
  const energy = data.attributes?.energy
  const moodSignal = data.attributes?.mood_signal
  const domainsTouched = data.attributes?.domains_touched?.split(',').map((s) => s.trim()).filter(Boolean) ?? []
  const summary = extractFirstParagraph(data.content)
  const energyInfo = energy ? ENERGY_INDICATORS[energy] : null

  return (
    <div className="w-full max-w-[95%] rounded-2xl bg-bg-sage/60 border border-border p-5 shadow-sm animate-fade-up">
      {/* Header: date + energy */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-medium text-text-secondary tracking-wide">
          {formatDate()}
        </span>
        {energyInfo && (
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${energyInfo.color}`} />
            <span className="text-[12px] text-text-secondary">
              {moodSignal ? moodSignal.replace(/-/g, ' ') : energyInfo.label}
            </span>
          </div>
        )}
      </div>

      {/* Summary */}
      {summary && (
        <p className="text-[15px] text-text leading-relaxed mb-3">
          {summary}
        </p>
      )}

      {/* Domain tags */}
      {domainsTouched.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {domainsTouched.map((domain) => (
            <span
              key={domain}
              className="px-2.5 py-0.5 text-[12px] font-medium text-text-secondary bg-bg rounded-full border border-border"
            >
              {domain}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <p className="text-[12px] text-text-secondary/60 pt-2 border-t border-border/50">
        This feeds into your next check-in
      </p>
    </div>
  )
}
