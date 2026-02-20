'use client'

import { useState, useTransition } from 'react'
import type { Capture, CaptureClassification } from '@/types/day-plan'
import { CaptureInput } from './capture-input'

interface CapturedThoughtsProps {
  captures: Capture[]
}

type GroupKey = 'task' | 'thought_idea' | 'tension' | 'uncategorized'

const GROUP_ORDER: GroupKey[] = ['task', 'thought_idea', 'tension', 'uncategorized']
const GROUP_LABELS: Record<GroupKey, string> = {
  task: 'Tasks',
  thought_idea: 'Thoughts & Ideas',
  tension: 'Tensions',
  uncategorized: 'Uncategorized',
}

function groupCaptures(captures: Capture[]): Record<GroupKey, Capture[]> {
  const groups: Record<GroupKey, Capture[]> = {
    task: [],
    thought_idea: [],
    tension: [],
    uncategorized: [],
  }

  for (const capture of captures) {
    switch (capture.classification) {
      case 'task':
        groups.task.push(capture)
        break
      case 'thought':
      case 'idea':
        groups.thought_idea.push(capture)
        break
      case 'tension':
        groups.tension.push(capture)
        break
      default:
        groups.uncategorized.push(capture)
    }
  }

  return groups
}

const BORDER_COLORS: Record<CaptureClassification | 'default', string> = {
  task: 'border-l-warm-gray/30',
  thought: 'border-l-dp-amber',
  idea: 'border-l-sage',
  tension: 'border-l-clay',
  default: 'border-l-warm-gray/20',
}

const TAG_STYLES: Record<CaptureClassification | 'default', string> = {
  task: 'bg-warm-gray/[0.08] text-warm-gray/50',
  thought: 'bg-dp-amber/10 text-dp-amber',
  idea: 'bg-sage/10 text-sage',
  tension: 'bg-clay/10 text-clay',
  default: 'bg-warm-gray/[0.08] text-warm-gray/40',
}

const ACTION_COLORS: Record<string, string> = {
  thought: 'text-dp-amber',
  idea: 'text-sage',
  tension: 'text-clay',
}

function CaptureCard({ capture }: { capture: Capture }) {
  const [isCompleted, setIsCompleted] = useState(capture.completed)
  const [isPending, startTransition] = useTransition()

  const classification = capture.classification ?? 'default'
  const borderColor = BORDER_COLORS[classification as CaptureClassification] ?? BORDER_COLORS.default
  const tagStyle = TAG_STYLES[classification as CaptureClassification] ?? TAG_STYLES.default
  const tagLabel = (capture.classification ?? 'Capture').toUpperCase()
  const isTask = capture.classification === 'task'

  const timestamp = new Date(capture.created_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  function toggleCompleted() {
    setIsCompleted(!isCompleted)
    startTransition(async () => {
      try {
        await fetch('/api/day-plan/toggle-capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ captureId: capture.id }),
        })
      } catch {
        setIsCompleted(isCompleted)
      }
    })
  }

  const actionText = capture.classification === 'tension' ? 'Sit with this' : 'Explore with Sage'
  const actionColor = ACTION_COLORS[capture.classification ?? ''] ?? 'text-dp-amber'

  return (
    <div className={`rounded-[14px] border-l-[3px] ${borderColor} bg-bg shadow-pebble px-4 py-3.5`}>
      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tagStyle}`}>
        {tagLabel}
      </span>

      {isTask ? (
        <div className="mt-2 flex items-start gap-3">
          <button
            onClick={toggleCompleted}
            className="mt-0.5 flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-dp-amber/50 rounded"
            role="checkbox"
            aria-checked={isCompleted}
            aria-label={`Mark task as ${isCompleted ? 'undone' : 'done'}`}
            disabled={isPending}
          >
            {isCompleted ? (
              <div className="flex h-[18px] w-[18px] items-center justify-center rounded-md bg-dp-amber">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            ) : (
              <div className="h-[18px] w-[18px] rounded-md border-2 border-warm-dark/20" />
            )}
          </button>
          <p className={`text-sm leading-relaxed ${isCompleted ? 'text-warm-dark/30 line-through decoration-warm-dark/15' : 'text-warm-dark'}`}>
            {capture.content}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-warm-dark">
          {capture.content}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between">
        <p className="text-[10px] text-warm-gray/40">{timestamp}</p>
        {!isTask && (
          <button className={`text-xs font-medium ${actionColor}`}>
            {actionText} {'\u2192'}
          </button>
        )}
      </div>
    </div>
  )
}

export function CapturedThoughts({ captures }: CapturedThoughtsProps) {
  const [localCaptures, setLocalCaptures] = useState(captures)
  const groups = groupCaptures(localCaptures)

  function handleCaptureAdded(capture: Capture) {
    setLocalCaptures((prev) => [...prev, capture])
  }

  const hasCaptures = localCaptures.length > 0

  return (
    <div>
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-warm-gray">
        Captured Thoughts
      </p>

      <CaptureInput onCaptureAdded={handleCaptureAdded} />

      {!hasCaptures && (
        <p className="mt-3 px-1 text-sm text-warm-gray/50">
          Thoughts you capture during the day will appear here.
        </p>
      )}

      {GROUP_ORDER.map((groupKey) => {
        const group = groups[groupKey]
        if (group.length === 0) return null

        return (
          <div key={groupKey} className="mt-3">
            <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest text-warm-gray/40">
              {GROUP_LABELS[groupKey]} {'\u00B7'} {group.length}
            </p>
            <div className="space-y-2">
              {group.map((capture) => (
                <CaptureCard key={capture.id} capture={capture} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
