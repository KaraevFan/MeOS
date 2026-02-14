'use client'

import { useState } from 'react'
import { SegmentedControl, type Tab } from './segmented-control'
import { SynthesisSection } from './synthesis-section'
import { DomainGrid } from './domain-grid'
import { LifePlanView } from './life-plan-view'
import type { LifeMap, LifeMapDomain } from '@/types/database'
import type { PulseCheckRating } from '@/types/pulse-check'
import type { Commitment } from '@/lib/markdown/extract'

interface LifeMapTabsProps {
  lifeMap: LifeMap
  domains: LifeMapDomain[]
  baselineRatings: PulseCheckRating[]
  quarterTheme: string | null
  commitments: Commitment[]
  thingsToProtect: string[]
  lifePlanBoundaries: string[]
}

export function LifeMapTabs({
  lifeMap,
  domains,
  baselineRatings,
  quarterTheme,
  commitments,
  thingsToProtect,
  lifePlanBoundaries,
}: LifeMapTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('where-i-am')

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
          quarterTheme={quarterTheme}
          commitments={commitments}
          thingsToProtect={thingsToProtect}
          boundaries={lifePlanBoundaries}
        />
      )}
    </>
  )
}
