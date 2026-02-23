'use client'

import { useState, useTransition } from 'react'
import type { Priority, OpenThread, EnergyLevel } from '@/types/day-plan'

const ENERGY_LABELS: Record<string, { emoji: string; label: string }> = {
  fired_up: { emoji: '\uD83D\uDD25', label: 'Energized' },
  focused: { emoji: '\uD83D\uDE0A', label: 'Good' },
  neutral: { emoji: '\uD83D\uDE10', label: 'Neutral' },
  low: { emoji: '\uD83D\uDE14', label: 'Low' },
  stressed: { emoji: '\uD83D\uDE23', label: 'Rough' },
}

interface MorningSnapshotCardProps {
  energyLevel: EnergyLevel | null
  morningCompletedAt: string
  priorities: Priority[]
  openThreads: OpenThread[]
  date: string
}

export function MorningSnapshotCard({
  energyLevel,
  morningCompletedAt,
  priorities,
  openThreads,
  date,
}: MorningSnapshotCardProps) {
  const [checkedPriorities, setCheckedPriorities] = useState<Set<number>>(() => {
    const initial = new Set<number>()
    for (const p of priorities) {
      if (p.completed) initial.add(p.rank)
    }
    return initial
  })
  const [isPending, startTransition] = useTransition()

  const completedTime = new Date(morningCompletedAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  const energy = energyLevel ? ENERGY_LABELS[energyLevel] : null

  function togglePriority(rank: number) {
    setCheckedPriorities((prev) => {
      const next = new Set(prev)
      if (next.has(rank)) next.delete(rank)
      else next.add(rank)
      return next
    })

    startTransition(async () => {
      try {
        await fetch('/api/day-plan/toggle-priority', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, rank }),
        })
      } catch {
        // Revert on failure
        setCheckedPriorities((prev) => {
          const next = new Set(prev)
          if (next.has(rank)) next.delete(rank)
          else next.add(rank)
          return next
        })
      }
    })
  }

  const activeThreads = openThreads.filter((t) => t.status === 'open')

  return (
    <div
      className="rounded-[18px] p-5 shadow-stone"
      style={{
        backgroundColor: '#F7F3EC',
        border: '1px solid rgba(201, 150, 58, 0.1)',
      }}
    >
      {/* Section header */}
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-warm-gray">
        Morning Snapshot
      </p>

      {/* Energy / status line */}
      <div className="mb-1 flex items-center gap-2">
        <span className="text-base" role="img" aria-label="Morning">
          {'\u2600\uFE0F'}
        </span>
        <p className="text-sm text-warm-dark/70">
          Morning session complete{' '}
          <span className="text-warm-gray/50">{'\u00B7'} {completedTime}</span>
        </p>
      </div>
      {energy && (
        <div className="mb-5 flex items-center gap-2">
          <span className="text-base" role="img" aria-label="Energy">
            {energy.emoji}
          </span>
          <p className="text-sm text-warm-dark/70">{energy.label}</p>
        </div>
      )}

      {/* Divider */}
      <div className="h-px bg-warm-dark/[0.06] mb-4" />

      {/* PRIORITIES subsection */}
      {priorities.length > 0 && (
        <>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-warm-gray/60">
            Priorities
          </p>
          <ul className="space-y-0.5 mb-5" role="list">
            {priorities.map((priority) => {
              const isChecked = checkedPriorities.has(priority.rank)
              return (
                <li key={priority.rank} className="flex items-start gap-3 py-1.5">
                  <button
                    onClick={() => togglePriority(priority.rank)}
                    className="mt-0.5 flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-dp-amber/50 focus-visible:ring-offset-1 rounded"
                    aria-label={`${isChecked ? 'Uncheck' : 'Check'} priority ${priority.rank}: ${priority.text}`}
                    role="checkbox"
                    aria-checked={isChecked}
                    disabled={isPending}
                  >
                    {isChecked ? (
                      <div className="flex h-[20px] w-[20px] items-center justify-center rounded-md bg-dp-amber">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    ) : (
                      <div className="h-[20px] w-[20px] rounded-md border-2 border-warm-dark/20" />
                    )}
                  </button>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-[13px] font-semibold tabular-nums ${isChecked ? 'text-warm-dark/30' : 'text-warm-dark/50'}`}>
                      {priority.rank}.
                    </span>
                    <span className={`text-sm leading-snug ${isChecked ? 'text-warm-dark/35 line-through decoration-warm-dark/20' : 'text-warm-dark'}`}>
                      {priority.text}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="h-px bg-warm-dark/[0.06] mb-4" />
        </>
      )}

      {/* OPEN THREADS subsection */}
      {activeThreads.length > 0 && (
        <>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-warm-gray/60">
            Open Threads
          </p>
          <div className="space-y-0">
            {activeThreads.map((thread, i) => (
              <div
                key={thread.text}
                className={`py-2.5 ${i < activeThreads.length - 1 ? 'border-b border-warm-dark/[0.05]' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm leading-snug text-warm-dark">{thread.text}</p>
                  <button className="flex-shrink-0 text-xs font-medium text-clay whitespace-nowrap">
                    explore {'\u2192'}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-warm-gray/45">
                  {thread.provenance_label}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
