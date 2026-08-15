/**
 * The client-side Typert Remote contribution for the safeMarket host service:
 * mounts the shared strict descriptors into `ctx.remote.safeMarket`. The
 * descriptors and codecs come from the shared contract module, so the browser
 * bundle and the host manifest stay on one wire definition.
 */
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { SAFE_MARKET_INVOCATIONS } from '../contract.ts'
import type {
  MarketCatalogResult,
  MarketEnvironment,
  MarketSkillsResult,
  SafeMarketSettings,
  SafeMarketSettingsUpdate,
} from '../contract.ts'

/** The safeMarket Remote namespace's client contribution. */
export const SAFE_MARKET_REMOTE: TypertRemoteContribution = {
  package: 'dsh-desktop-safe-market',
  descriptors: SAFE_MARKET_INVOCATIONS,
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  // Typed face of the mounted namespace. Note: the runtime access is NOT the
  // dotted `ctx.remote.safeMarket` read — that path walks the cordis fiber
  // chain and stops at the Loader's runtime-less internal forks between a
  // plugin entry and the root fiber. The plugin resolves the namespace
  // service through `ctx.reflect.get('remote.safeMarket')` instead
  // (see client/index.ts).
  /** The `safeMarket` namespace face mounted under `ctx.remote.safeMarket`. */
  interface TypertRemoteNamespace$736166654d61726b6574 {
    getCatalog: (force: boolean, signal?: AbortSignal) => Promise<RemoteResult<MarketCatalogResult>>
    listSkills: (signal?: AbortSignal) => Promise<RemoteResult<MarketSkillsResult>>
    describe: () => Promise<RemoteResult<MarketEnvironment>>
    getSettings: () => Promise<RemoteResult<SafeMarketSettings>>
    updateSettings: (update: SafeMarketSettingsUpdate) => Promise<RemoteResult<SafeMarketSettings>>
  }
  interface TypertRemoteMap {
    'safeMarket/getCatalog': (force: boolean, signal?: AbortSignal) => Promise<RemoteResult<MarketCatalogResult>>
    'safeMarket/listSkills': (signal?: AbortSignal) => Promise<RemoteResult<MarketSkillsResult>>
    'safeMarket/describe': () => Promise<RemoteResult<MarketEnvironment>>
    'safeMarket/getSettings': () => Promise<RemoteResult<SafeMarketSettings>>
    'safeMarket/updateSettings': (update: SafeMarketSettingsUpdate) => Promise<RemoteResult<SafeMarketSettings>>
  }
  interface TypertRemoteNamespaceMap {
    safeMarket: TypertRemoteNamespace$736166654d61726b6574
  }
}
