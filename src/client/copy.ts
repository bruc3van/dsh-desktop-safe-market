/**
 * The translate face the section's pages share.
 *
 * The slot renderer hands the registered component a `t` bound to this
 * plugin's namespace; the pages below the section are ordinary components, so
 * they take that face as a prop rather than reaching for a second binding.
 */
import type { SafeMarketLocaleKey } from './locales.ts'

/** Translate one key of this plugin's namespace, with optional interpolation. */
export type MarketLocale = (key: SafeMarketLocaleKey, params?: Record<string, string>) => string
