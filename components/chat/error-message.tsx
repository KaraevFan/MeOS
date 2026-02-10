interface ErrorMessageProps {
  retryCount: number
  onRetry: () => void
}

export function ErrorMessage({ retryCount, onRetry }: ErrorMessageProps) {
  const maxRetriesReached = retryCount >= 3

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-lg px-4 py-3 bg-bg-card border border-accent-terra/20">
        <p className="text-accent-terra text-sm">
          {maxRetriesReached
            ? "Sage is having trouble right now. Your conversation is saved \u2014 come back and pick up where you left off."
            : "Sage couldn\u2019t respond. Tap to retry."}
        </p>
        {!maxRetriesReached && (
          <button
            onClick={onRetry}
            className="mt-2 text-sm text-primary font-medium hover:underline"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  )
}
