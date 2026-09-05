/** Review scope selected for the next installation or upgrade draft. */
export type ReviewMode = 'full' | 'compact'

export const DEFAULT_REVIEW_MODE: ReviewMode = 'compact'

export function reviewPromptKey(mode: ReviewMode, upgrade: boolean): 'prompt' | 'prompt.upgrade' | 'prompt.compact' | 'prompt.compact.upgrade' {
  if (mode === 'compact') return upgrade ? 'prompt.compact.upgrade' : 'prompt.compact'
  return upgrade ? 'prompt.upgrade' : 'prompt'
}
