'use client'

import { useState } from 'react'
import { SegmentedControl, type Tab } from './segmented-control'
import { SynthesisSection } from './synthesis-section'
import { DomainGrid } from './domain-grid'
import { LifePlanView } from './life-plan-view'
import type { LifeMap, LifeMapDomain } from '@/types/database'
import type { PulseCheckRating } from '@/types/pulse-check'
import type { Commitment } from '@/lib/markdown/extract'
import type { TrendDirection } from '@/lib/supabase/pulse-check'

export interface LifePlanData {
  quarterTheme: string | null
  commitments: Commitment[]
  thingsToProtect: string[]
  boundaries: string[]
}

interface LifeMapTabsProps {
  lifeMap: LifeMap
  domains: LifeMapDomain[]
  baselineRatings: PulseCheckRating[]
  domainTrends?: Record<string, TrendDirection | null>
  lifePlanData: LifePlanData
  changedSinceLastCheckin?: string[]
}

function ChangedSinceCheckin({ domains }: { domains: string[] }) {
  if (domains.length === 0) return null
  return (
    <div className="bg-primary/5 border border-primary/15 rounded-lg p-4">
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
        What changed since last check-in
      </p>
      <ul className="space-y-1 text-sm text-text">
        {domains.map((domain) => (
          <li key={domain} className="flex items-start gap-2">
            <span className="mt-0.5 text-primary">&#8226;</span>
            <span>{domain}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function LifeMapTabs({
  lifeMap,
  domains,
  baselineRatings,
  domainTrends,
  lifePlanData,
  changedSinceLastCheckin = [],
}: LifeMapTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('where-i-am')

  const hasLifePlan = (lifePlanData.commitments.length > 0) || lifePlanData.quarterTheme != null

  // If no life plan data, render "Where I Am" content directly without tabs
  if (!hasLifePlan) {
    return (
      <div className="space-y-lg">
        <ChangedSinceCheckin domains={changedSinceLastCheckin} />
        <SynthesisSection lifeMap={lifeMap} />
        <DomainGrid domains={domains} baselineRatings={baselineRatings} domainTrends={domainTrends} />
      </div>
    )
  }

  return (
    <>
      <SegmentedControl activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'where-i-am' ? (
        <div className="space-y-lg">
          <ChangedSinceCheckin domains={changedSinceLastCheckin} />
          <SynthesisSection lifeMap={lifeMap} />
          <DomainGrid domains={domains} baselineRatings={baselineRatings} domainTrends={domainTrends} />
        </div>
      ) : (
        <LifePlanView
          quarterTheme={lifePlanData.quarterTheme}
          commitments={lifePlanData.commitments}
          thingsToProtect={lifePlanData.thingsToProtect}
          boundaries={lifePlanData.boundaries}
        />
      )}
    </>
  )
}
