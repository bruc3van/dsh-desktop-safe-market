/**
 * The catalog source: the curated market published by awesome-dsh-plugin.
 *
 * Every editorial decision — who is excluded, how rows are categorized, how
 * the list is balanced across categories — happens upstream. This plugin
 * reads the single published `market.json` (the daily crawl reduced there to
 * a balanced list of at most 300 entries) and answers the browser by
 * truncating that order to the configured market size, so the two sides of
 * the integration never disagree about the selection rule. The crawl that
 * feeds the market stays upstream; this side downloads a small curated file,
 * not a 2.4 MB snapshot plus a curation sidecar.
 *
 * The published body is still remote text from a public file and is treated
 * as hostile here: slugs are shape-checked, links are rebuilt from the slug,
 * branch names are kept only when they match the safe pattern, and every
 * field is re-truncated before the browser sees it.
 */
import type { MarketCatalog } from './contract.ts';
/**
 * Where a parsed catalog survives a restart. The catalog source neither opens
 * nor closes this — the plugin body owns the domain's lifecycle and hands the
 * source a narrow port, so a deployment without durable storage can still run
 * the market from memory alone.
 */
export interface CatalogCache {
    /** The last parse and the ETag it was derived with. */
    read: () => {
        catalog: MarketCatalog | null;
        marketEtag: string;
    };
    /** Persist a fresh parse. Failures are the cache's own business. */
    write: (next: {
        catalog: MarketCatalog;
        marketEtag: string;
    }) => void;
}
/** Deployment-varying knobs the plugin config owns. */
export interface CatalogOptions {
    /** Base URL holding `market.json`. */
    readonly base: string;
    /** How many plugins the market shows. */
    readonly marketSize: number;
    /** Durable seat for the parse; absent means memory-only. */
    readonly cache?: CatalogCache;
}
/**
 * Parse the published market into the catalog the browser renders. The
 * publisher's order IS the balance — every category places its best entry
 * before any places its second — so rows are kept in file order and truncated
 * to the requested size; nothing is re-ranked here.
 * @param body - the parsed `market.json` body.
 * @param marketSize - how many rows the browser shows.
 * @returns the parsed, validated, truncated catalog.
 * @throws when the body is not a market this plugin understands.
 */
export declare function deriveMarket(body: unknown, marketSize: number): MarketCatalog;
/** The catalog reader: memory first, then the network. */
export interface CatalogSource {
    /**
     * Read the catalog.
     * @param force - bypass the refresh interval (a user gesture, not a poll).
     * @param signal - caller lifetime.
     */
    read: (force: boolean, signal?: AbortSignal) => Promise<{
        catalog: MarketCatalog | null;
        stale: boolean;
        error: string;
    }>;
}
/**
 * Build the catalog reader.
 * @param options - the base URL, the market size, and the durable seat.
 * @returns the reader.
 */
export declare function createCatalogSource(options: CatalogOptions): CatalogSource;
