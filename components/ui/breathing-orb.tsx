'use client'

import { cn } from '@/lib/utils'

interface BreathingOrbProps {
  variant?: 'full' | 'ambient'
  onTap?: () => void
  className?: string
}

const FULL_SIZE = 'w-[200px] h-[200px] max-[600px]:w-[160px] max-[600px]:h-[160px] max-[500px]:w-[140px] max-[500px]:h-[140px]'
const FULL_HALO = 'w-[280px] h-[280px] max-[600px]:w-[224px] max-[600px]:h-[224px] max-[500px]:w-[196px] max-[500px]:h-[196px]'
const AMBIENT_SIZE = 'w-[160px] h-[160px]'
const AMBIENT_HALO = 'w-[224px] h-[224px]'

const haloStyle = {
  background: 'radial-gradient(circle, rgba(252,211,77,0.25) 0%, rgba(252,211,77,0.08) 50%, transparent 70%)',
  animation: 'orb-halo 7s ease-in-out infinite',
} as const

const bodyStyle = {
  background: 'radial-gradient(circle at 40% 35%, #fcd34d 0%, #f59e0b 45%, #d97706 100%)',
  boxShadow: '0 0 60px rgba(245,158,11,0.3), 0 0 120px rgba(217,119,6,0.15), inset 0 -8px 24px rgba(180,83,9,0.2)',
  animation: 'orb-breathe 7s ease-in-out infinite',
} as const

const coreStyle = {
  background: 'radial-gradient(circle at 50% 40%, rgba(255,255,255,0.5) 0%, rgba(252,211,77,0.3) 50%, transparent 70%)',
  animation: 'orb-inner-glow 7s ease-in-out infinite',
  animationDelay: '0.3s',
} as const

const RIPPLE_DELAYS = [0, 2.5]

export function BreathingOrb({ variant = 'full', onTap, className }: BreathingOrbProps) {
  const isAmbient = variant === 'ambient'
  const isInteractive = !!onTap
  const sizeClass = isAmbient ? AMBIENT_SIZE : FULL_SIZE
  const haloClass = isAmbient ? AMBIENT_HALO : FULL_HALO

  const orbContent = (
    <div
      className={cn(
        'orb-animated relative flex items-center justify-center',
        !isInteractive && className,
      )}
    >
      {/* Ripple rings (full variant only) */}
      {!isAmbient && RIPPLE_DELAYS.map((delay) => (
        <div
          key={delay}
          className={cn('absolute rounded-full border border-amber-400/10', sizeClass)}
          style={{
            animation: 'ripple-expand 5s ease-out infinite',
            animationDelay: `${delay}s`,
          }}
        />
      ))}

      {/* Outer halo */}
      <div
        className={cn('absolute rounded-full', haloClass)}
        style={isAmbient ? { ...haloStyle, opacity: 0.3 } : haloStyle}
      />

      {/* Main orb body */}
      <div
        className={cn('relative rounded-full', sizeClass)}
        style={isAmbient ? { ...bodyStyle, opacity: 0.35 } : bodyStyle}
      >
        {/* Inner bright core */}
        <div
          className="absolute top-[20%] left-[25%] w-[45%] h-[45%] rounded-full"
          style={coreStyle}
        />

        {/* Mic icon hint (full variant only) */}
        {!isAmbient && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn('w-8 h-8', isInteractive ? 'text-white/40' : 'text-white/30')}
            >
              <rect x="9" y="2" width="6" height="11" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </div>
        )}
      </div>
    </div>
  )

  if (isInteractive) {
    return (
      <button
        type="button"
        onClick={onTap}
        className={cn(
          'cursor-pointer transition-transform duration-200 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2',
          'rounded-full',
          className,
        )}
        aria-label="Talk to Sage"
        tabIndex={0}
      >
        {orbContent}
      </button>
    )
  }

  if (isAmbient) {
    return (
      <div aria-hidden="true" className="pointer-events-none">
        {orbContent}
      </div>
    )
  }

  // Decorative (no onTap, full variant)
  return (
    <div aria-hidden="true">
      {orbContent}
    </div>
  )
}
