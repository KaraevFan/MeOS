/** Sage-facing descriptions of each intent — used for context injection in first conversation */
export const INTENT_CONTEXT_LABELS: Record<string, string> = {
  intentional: 'things are good and they want to be more intentional',
  new_start: "they're starting something new",
  stuck: "they're feeling stuck or scattered",
  tough_time: "they're going through a tough time",
  exploring: "they're just exploring",
  // Legacy intents (backward compat)
  scattered: "they're feeling scattered",
  transition: "they're going through a transition",
  clarity: 'they want more clarity on what matters',
  curious: "they're just curious",
}
