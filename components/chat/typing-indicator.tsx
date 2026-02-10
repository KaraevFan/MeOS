'use client'

export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-bg-sage border-l-[3px] border-l-accent-sage rounded-lg px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}
