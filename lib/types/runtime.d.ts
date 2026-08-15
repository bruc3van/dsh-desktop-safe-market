/**
 * The safe-market Host Remote service (`ctx.safeMarket`, wire namespace
 * `safeMarket`). Registered as a TypertRemoteService so the Host Gateway
 * exports its `@Remote` methods to the Web client under
 * `/api/safeMarket/<method>`.
 *
 * The catalog read lives here rather than in the browser for two reasons:
 * the crawl is 2.4 MB and the browser needs 100 rows of it, and the rows
 * carry remote text whose sanitizing belongs on one side of the wire, not in
 * every renderer that touches them.
 */
import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { CatalogSource } from './catalog.ts';
import type { SkillReadAgent } from './skills.ts';
import type { MarketCatalogResult, MarketEnvironment, MarketSkillsResult, SafeMarketSettings, SafeMarketSettingsUpdate } from './contract.ts';
/** Market service: the reduced catalog and the plugin's durable settings. */
export declare class SafeMarketRuntime extends TypertRemoteService {
    private readonly catalog;
    private readonly readSettings;
    private readonly writeSettings;
    private readonly readSkills;
    private readonly environment;
    /**
     * Register the service under the `safeMarket` key (the wire namespace).
     * @param ctx - owning cordis context.
     * @param catalog - the catalog reader.
     * @param readSettings - live settings read.
     * @param writeSettings - durable settings write.
     */
    constructor(ctx: Context, catalog: CatalogSource, readSettings: () => SafeMarketSettings, writeSettings: (update: SafeMarketSettingsUpdate) => Promise<SafeMarketSettings>, readSkills: (agent: SkillReadAgent, signal: AbortSignal) => Promise<MarketSkillsResult>, environment: MarketEnvironment);
    /**
     * The deployment facts the browser needs to NAME the install command —
     * which profile an install would change. This plugin never runs it.
     */
    describe(): MarketEnvironment;
    /**
     * The skills the addressed session can currently resolve.
     *
     * Read-only, and deliberately not gated on the market switch: listing what
     * is already installed reaches nothing outside this machine, so it answers
     * whether or not the user has turned the catalog on.
     * @param agent - the live agent resolved from the `agentId` wire field; its
     *   scope chain selects the layers, its session header the workspace.
     * @param signal - caller lifetime; discovery races it.
     * @returns the merged skill list, and whether discovery was complete.
     */
    listSkills(agent: SkillReadAgent, signal: AbortSignal): Promise<MarketSkillsResult>;
    /** Read the resolved durable settings through the plugin-owned wire. */
    getSettings(): SafeMarketSettings;
    /** Persist one settings field and return the resolved section. */
    updateSettings(update: SafeMarketSettingsUpdate): Promise<SafeMarketSettings>;
    /**
     * Read the reduced community catalog.
     *
     * Refuses while the market is off: the switch is what authorizes this Host
     * to reach the snapshot at all, so a disabled market must not be reachable
     * by asking the wire directly.
     * @param force - bypass the refresh interval (a user gesture, not a poll).
     * @param signal - caller lifetime; the reads race it.
     * @returns the catalog, or the reason it could not be read.
     */
    getCatalog(force: boolean, signal: AbortSignal): Promise<MarketCatalogResult>;
}
