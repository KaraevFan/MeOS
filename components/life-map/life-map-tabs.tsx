'use client'

import { useState } from 'react'
import { SegmentedControl, type Tab } from './segmented-control'
import { SynthesisSection } from './synthesis-section'
import { DomainGrid } from './domain-grid'
import { LifePlanView } from './life-plan-view'
import type { LifeMap, LifeMapDomain } from '@/types/database'
import type { PulseCheckRating } from '@/types/pulse-check'
import type { Commitment } from '@/lib/markdown/extract'

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
  lifePlanData: LifePlanData
}

export function LifeMapTabs({
  lifeMap,
  domains,
  baselineRatings,
  lifePlanData,
}: LifeMapTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('where-i-am')

  const hasLifePlan = (lifePlanData.commitments.length > 0) || lifePlanData.quarterTheme != null

  // If no life plan data, render "Where I Am" content directly without tabs
  if (!hasLifePlan) {
    return (
      <div className="space-y-lg">
        <SynthesisSection lifeMap={lifeMap} />
        <DomainGrid domains={domains} baselineRatings={baselineRatings} />
      </div>
    )
  }

  return (
    <>
      <SegmentedControl activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'where-i-am' ? (
        <div className="space-y-lg">
          <SynthesisSection lifeMap={lifeMap} />
          <DomainGrid domains={domains} baselineRatings={baselineRatings} />
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
