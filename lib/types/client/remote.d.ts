/**
 * The client-side Typert Remote contribution for the safeMarket host service:
 * mounts the shared strict descriptors into `ctx.remote.safeMarket`. The
 * descriptors and codecs come from the shared contract module, so the browser
 * bundle and the host manifest stay on one wire definition.
 */
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import type { MarketCatalogResult, MarketEnvironment, MarketInstalledResult, MarketSkillsResult, SafeMarketSettings, SafeMarketSettingsUpdate, SetInstalledEnabledUpdate, UninstallInstalledUpdate } from '../contract.ts';
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
        listInstalled: () => Promise<RemoteResult<MarketInstalledResult>>;
        setInstalledEnabled: (update: SetInstalledEnabledUpdate) => Promise<RemoteResult<MarketInstalledResult>>;
        uninstallInstalled: (update: UninstallInstalledUpdate) => Promise<RemoteResult<MarketInstalledResult>>;
    }
    interface TypertRemoteMap {
        'safeMarket/getCatalog': (force: boolean, signal?: AbortSignal) => Promise<RemoteResult<MarketCatalogResult>>;
        'safeMarket/listSkills': (agentId: string, signal?: AbortSignal) => Promise<RemoteResult<MarketSkillsResult>>;
        'safeMarket/describe': () => Promise<RemoteResult<MarketEnvironment>>;
        'safeMarket/getSettings': () => Promise<RemoteResult<SafeMarketSettings>>;
        'safeMarket/updateSettings': (update: SafeMarketSettingsUpdate) => Promise<RemoteResult<SafeMarketSettings>>;
        'safeMarket/listInstalled': () => Promise<RemoteResult<MarketInstalledResult>>;
        'safeMarket/setInstalledEnabled': (update: SetInstalledEnabledUpdate) => Promise<RemoteResult<MarketInstalledResult>>;
        'safeMarket/uninstallInstalled': (update: UninstallInstalledUpdate) => Promise<RemoteResult<MarketInstalledResult>>;
    }
    interface TypertRemoteNamespaceMap {
        safeMarket: TypertRemoteNamespace$736166654d61726b6574;
    }
}
