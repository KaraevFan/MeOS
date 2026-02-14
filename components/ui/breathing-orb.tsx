'use client'

import { cn } from '@/lib/utils'

interface BreathingOrbProps {
  variant: 'hero' | 'interactive' | 'ambient'
  onTap?: () => void
  className?: string
}

const sizes = {
  hero: 'w-[200px] h-[200px] max-[600px]:w-[160px] max-[600px]:h-[160px] max-[500px]:w-[140px] max-[500px]:h-[140px]',
  interactive: 'w-[200px] h-[200px] max-[600px]:w-[160px] max-[600px]:h-[160px] max-[500px]:w-[140px] max-[500px]:h-[140px]',
  ambient: 'w-[160px] h-[160px]',
}

const haloSizes = {
  hero: 'w-[280px] h-[280px] max-[600px]:w-[224px] max-[600px]:h-[224px] max-[500px]:w-[196px] max-[500px]:h-[196px]',
  interactive: 'w-[280px] h-[280px] max-[600px]:w-[224px] max-[600px]:h-[224px] max-[500px]:w-[196px] max-[500px]:h-[196px]',
  ambient: 'w-[224px] h-[224px]',
}

export function BreathingOrb({ variant, onTap, className }: BreathingOrbProps) {
  const showRipples = variant === 'hero' || variant === 'interactive'
  const showMic = variant === 'hero' || variant === 'interactive'
  const isAmbient = variant === 'ambient'
  const micOpacity = variant === 'interactive' ? 'text-white/40' : 'text-white/30'

  const orbContent = (
    <div
      className={cn(
        'orb-animated relative flex items-center justify-center',
        className,
      )}
      style={{ willChange: 'transform, opacity' }}
    >
      {/* Ripple rings */}
      {showRipples && (
        <>
          {[0, 1.6, 3.2].map((delay) => (
            <div
              key={delay}
              className={cn(
                'absolute rounded-full border border-amber-400/10',
                sizes[variant],
              )}
              style={{
                animation: 'ripple-expand 5s ease-out infinite',
                animationDelay: `${delay}s`,
              }}
            />
          ))}
        </>
      )}

      {/* Outer halo */}
      <div
        className={cn('absolute rounded-full', haloSizes[variant])}
        style={{
          background: 'radial-gradient(circle, rgba(252,211,77,0.25) 0%, rgba(252,211,77,0.08) 50%, transparent 70%)',
          animation: 'orb-halo 7s ease-in-out infinite',
          opacity: isAmbient ? 0.3 : undefined,
        }}
      />

      {/* Main orb body */}
      <div
        className={cn('relative rounded-full', sizes[variant])}
        style={{
          background: 'radial-gradient(circle at 40% 35%, #fcd34d 0%, #f59e0b 45%, #d97706 100%)',
          boxShadow: '0 0 60px rgba(245,158,11,0.3), 0 0 120px rgba(217,119,6,0.15), inset 0 -8px 24px rgba(180,83,9,0.2)',
          animation: 'orb-breathe 7s ease-in-out infinite',
          opacity: isAmbient ? 0.35 : undefined,
        }}
      >
        {/* Inner bright core */}
        <div
          className="absolute top-[20%] left-[25%] w-[45%] h-[45%] rounded-full"
          style={{
            background: 'radial-gradient(circle at 50% 40%, rgba(255,255,255,0.5) 0%, rgba(252,211,77,0.3) 50%, transparent 70%)',
            animation: 'orb-inner-glow 7s ease-in-out infinite',
            animationDelay: '0.3s',
          }}
        />

        {/* Mic icon hint */}
        {showMic && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn('w-8 h-8', micOpacity)}
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

  if (variant === 'interactive') {
    return (
      <button
        type="button"
        onClick={onTap}
        className={cn(
          'cursor-pointer transition-transform duration-200 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2',
          'rounded-full',
        )}
        role="button"
        aria-label="Begin life mapping"
        tabIndex={0}
      >
        {orbContent}
      </button>
    )
  }

  if (isAmbient) {
    return (
      <div aria-hidden="true" className={cn('pointer-events-none', className)}>
        {orbContent}
      </div>
    )
  }

  // hero variant
  return (
    <div aria-hidden="true">
      {orbContent}
    </div>
  )
}
