'use client'

import { cn } from '@/lib/utils'

interface ExitConfirmationSheetProps {
  open: boolean
  isOnboarding: boolean
  onPause: () => void
  onContinue: () => void
}

export function ExitConfirmationSheet({ open, isOnboarding, onPause, onContinue }: ExitConfirmationSheetProps) {
  const title = isOnboarding
    ? 'Save & finish later?'
    : 'Pause this session?'

  const body = isOnboarding
    ? 'Your progress is saved. Next time you open the app, we\'ll pick up exactly where you left off.'
    : 'You can pick up where you left off — Sage will be here.'

  const pauseLabel = isOnboarding ? 'Save & finish later' : 'Pause & Exit'

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[40] bg-text/20"
          onClick={onContinue}
        />
      )}

      {/* Bottom sheet — constrained to 430px container */}
      <div
        className={cn(
          'fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-[50]',
          'bg-bg-card rounded-t-2xl shadow-md px-6 pt-5 pb-8',
          'transition-transform duration-200 ease-out',
          open ? 'translate-y-0' : 'translate-y-full'
        )}
        style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}
      >
        {/* Handle */}
        <div className="flex justify-center mb-5">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <h3 className="text-base font-semibold text-text mb-2">{title}</h3>
        <p className="text-sm text-text-secondary mb-6 leading-relaxed">{body}</p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onPause}
            className="w-full h-12 rounded-xl text-sm font-medium text-white bg-primary hover:bg-primary/90 transition-colors active:scale-[0.98]"
          >
            {pauseLabel}
          </button>
          <button
            onClick={onContinue}
            className="w-full h-12 rounded-xl text-sm font-medium text-text-secondary bg-bg-card border border-border hover:bg-warm-bg transition-colors active:scale-[0.98]"
          >
            Keep Going
          </button>
        </div>
      </div>
    </>
  )
}
