/**
 * The client-side Typert Remote contribution for the safeMarket host service:
 * mounts the shared strict descriptors into `ctx.remote.safeMarket`. The
 * descriptors and codecs come from the shared contract module, so the browser
 * bundle and the host manifest stay on one wire definition.
 */
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import type { MarketCatalogResult, MarketEnvironment, MarketSkillsResult, SafeMarketSettings, SafeMarketSettingsUpdate } from '../contract.ts';
/** The safeMarket Remote namespace's client contribution. */
export declare const SAFE_MARKET_REMOTE: TypertRemoteContribution;
declare module '@deepseek-ai/dsh-typert-protocol' {
    /** The `safeMarket` namespace face mounted under `ctx.remote.safeMarket`. */
    interface TypertRemoteNamespace$736166654d61726b6574 {
        getCatalog: (force: boolean, signal?: AbortSignal) => Promise<RemoteResult<MarketCatalogResult>>;
        listSkills: (agentId: string, signal?: AbortSignal) => Promise<RemoteResult<MarketSkillsResult>>;
        describe: () => Promise<RemoteResult<MarketEnvironment>>;
        getSettings: () => Promise<RemoteResult<SafeMarketSettings>>;
        updateSettings: (update: SafeMarketSettingsUpdate) => Promise<RemoteResult<SafeMarketSettings>>;
    }
    interface TypertRemoteMap {
        'safeMarket/getCatalog': (force: boolean, signal?: AbortSignal) => Promise<RemoteResult<MarketCatalogResult>>;
        'safeMarket/listSkills': (agentId: string, signal?: AbortSignal) => Promise<RemoteResult<MarketSkillsResult>>;
        'safeMarket/describe': () => Promise<RemoteResult<MarketEnvironment>>;
        'safeMarket/getSettings': () => Promise<RemoteResult<SafeMarketSettings>>;
        'safeMarket/updateSettings': (update: SafeMarketSettingsUpdate) => Promise<RemoteResult<SafeMarketSettings>>;
    }
    interface TypertRemoteNamespaceMap {
        safeMarket: TypertRemoteNamespace$736166654d61726b6574;
    }
}
