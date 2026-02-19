'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface RadarChartProps {
  domains: string[]
  ratings: Record<number, number>
  maxRating: number
  /** SVG size in pixels (default 320) */
  size?: number
  /** Domain names that have been fully explored (shown with full opacity dots) */
  exploredDomains?: string[]
  /** Abbreviated display labels (falls back to domains[] if omitted) */
  labels?: string[]
}

const ease = [0.25, 0.46, 0.45, 0.94] as const

export function RadarChart({ domains, ratings, maxRating, size = 320, exploredDomains, labels }: RadarChartProps) {
  const [animationProgress, setAnimationProgress] = useState(0)

  const numAxes = domains.length
  const center = size / 2
  const maxRadius = size * 0.375 // ~120px at 320, ~75px at 200
  const labelRadius = maxRadius + (size * 0.0875) // ~28px at 320, ~17.5px at 200

  useEffect(() => {
    const timer = setTimeout(() => setAnimationProgress(1), 100)
    return () => clearTimeout(timer)
  }, [])

  const exploredSet = exploredDomains ? new Set(exploredDomains) : null

  function getPoint(index: number, value: number) {
    const angle = (Math.PI * 2 * index) / numAxes - Math.PI / 2
    const radius = (value / maxRating) * maxRadius * animationProgress
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    }
  }

  function getAxisEnd(index: number) {
    const angle = (Math.PI * 2 * index) / numAxes - Math.PI / 2
    return {
      x: center + maxRadius * Math.cos(angle),
      y: center + maxRadius * Math.sin(angle),
    }
  }

  function getLabelPosition(index: number) {
    const angle = (Math.PI * 2 * index) / numAxes - Math.PI / 2
    const x = center + labelRadius * Math.cos(angle)
    const y = center + labelRadius * Math.sin(angle)
    let anchor = 'middle'
    if (Math.cos(angle) < -0.1) anchor = 'end'
    else if (Math.cos(angle) > 0.1) anchor = 'start'
    return { x, y, anchor }
  }

  const dataPoints = domains.map((_, i) => {
    const value = ratings[i] ?? 0
    return getPoint(i, value)
  })

  const dataPath =
    dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'

  const rings = [0.25, 0.5, 0.75, 1]
  const fontSize = Math.max(8, size * 0.033) // Scale font with size, min 8px

  return (
    <motion.div
      className="w-full flex justify-center"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {/* Grid rings */}
        {rings.map((scale) => {
          const ringPoints = domains.map((_, i) => {
            const angle = (Math.PI * 2 * i) / numAxes - Math.PI / 2
            const r = maxRadius * scale
            return {
              x: center + r * Math.cos(angle),
              y: center + r * Math.sin(angle),
            }
          })
          const ringPath =
            ringPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
          return (
            <path
              key={`ring-${scale}`}
              d={ringPath}
              fill="none"
              stroke="#B8A99A"
              strokeWidth="0.75"
              opacity={0.25}
            />
          )
        })}

        {/* Axis lines */}
        {domains.map((_, i) => {
          const end = getAxisEnd(i)
          return (
            <line
              key={`axis-${i}`}
              x1={center}
              y1={center}
              x2={end.x}
              y2={end.y}
              stroke="#B8A99A"
              strokeWidth="0.75"
              opacity={0.3}
            />
          )
        })}

        {/* Data polygon */}
        <motion.path
          d={dataPath}
          fill="#D4A574"
          fillOpacity={0.2}
          stroke="#D4A574"
          strokeWidth="2"
          strokeLinejoin="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        />

        {/* Data points — explored domains get full opacity, rated-only get 50% */}
        {dataPoints.map((p, i) => {
          const isExplored = exploredSet ? exploredSet.has(domains[i]) : true
          return (
            <motion.circle
              key={`point-${i}`}
              cx={p.x}
              cy={p.y}
              r={isExplored ? 3.5 : 2.5}
              fill="#D4A574"
              stroke="#FAF7F2"
              strokeWidth="1.5"
              opacity={isExplored ? 1 : 0.5}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: isExplored ? 1 : 0.5 }}
              transition={{
                delay: 0.5 + i * 0.06,
                type: 'spring',
                damping: 15,
                stiffness: 200,
              }}
            />
          )
        })}

        {/* Domain labels */}
        {domains.map((domain, i) => {
          const pos = getLabelPosition(i)
          return (
            <motion.text
              key={`label-${i}`}
              x={pos.x}
              y={pos.y}
              textAnchor={pos.anchor as 'start' | 'middle' | 'end'}
              dominantBaseline="central"
              fill="#8B7D6B"
              fontSize={fontSize}
              fontWeight="500"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 + i * 0.05, duration: 0.4 }}
            >
              {(labels ?? domains)[i]}
            </motion.text>
          )
        })}
      </svg>
    </motion.div>
  )
}
