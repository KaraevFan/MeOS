'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface RadarChartProps {
  domains: string[]
  ratings: Record<number, number>
  maxRating: number
}

const ease = [0.25, 0.46, 0.45, 0.94] as const

export function RadarChart({ domains, ratings, maxRating }: RadarChartProps) {
  const [animationProgress, setAnimationProgress] = useState(0)

  const numAxes = domains.length
  const centerX = 160
  const centerY = 160
  const maxRadius = 120
  const labelRadius = maxRadius + 28

  useEffect(() => {
    const timer = setTimeout(() => setAnimationProgress(1), 100)
    return () => clearTimeout(timer)
  }, [])

  function getPoint(index: number, value: number) {
    const angle = (Math.PI * 2 * index) / numAxes - Math.PI / 2
    const radius = (value / maxRating) * maxRadius * animationProgress
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    }
  }

  function getAxisEnd(index: number) {
    const angle = (Math.PI * 2 * index) / numAxes - Math.PI / 2
    return {
      x: centerX + maxRadius * Math.cos(angle),
      y: centerY + maxRadius * Math.sin(angle),
    }
  }

  function getLabelPosition(index: number) {
    const angle = (Math.PI * 2 * index) / numAxes - Math.PI / 2
    const x = centerX + labelRadius * Math.cos(angle)
    const y = centerY + labelRadius * Math.sin(angle)
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

  return (
    <motion.div
      className="w-full flex justify-center"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease }}
    >
      <svg width="320" height="320" viewBox="0 0 320 320" className="overflow-visible">
        {/* Grid rings */}
        {rings.map((scale) => {
          const ringPoints = domains.map((_, i) => {
            const angle = (Math.PI * 2 * i) / numAxes - Math.PI / 2
            const r = maxRadius * scale
            return {
              x: centerX + r * Math.cos(angle),
              y: centerY + r * Math.sin(angle),
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
              x1={centerX}
              y1={centerY}
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

        {/* Data points */}
        {dataPoints.map((p, i) => (
          <motion.circle
            key={`point-${i}`}
            cx={p.x}
            cy={p.y}
            r={3.5}
            fill="#D4A574"
            stroke="#FAF7F2"
            strokeWidth="1.5"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              delay: 0.5 + i * 0.06,
              type: 'spring',
              damping: 15,
              stiffness: 200,
            }}
          />
        ))}

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
              fontSize="10.5"
              fontWeight="500"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 + i * 0.05, duration: 0.4 }}
            >
              {domain}
            </motion.text>
          )
        })}
      </svg>
    </motion.div>
  )
}
