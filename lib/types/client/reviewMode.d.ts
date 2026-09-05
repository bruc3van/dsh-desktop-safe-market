/** Review scope selected for the next installation or upgrade draft. */
export type ReviewMode = 'full' | 'compact';
export declare const DEFAULT_REVIEW_MODE: ReviewMode;
export declare function reviewPromptKey(mode: ReviewMode, upgrade: boolean): 'prompt' | 'prompt.upgrade' | 'prompt.compact' | 'prompt.compact.upgrade';
