/**
 * The catalog source: the community snapshot published by awesome-dsh-plugin,
 * reduced on the Host to a balanced top 100.
 *
 * The snapshot lives in two files. `repositories.json` is the machine-readable
 * daily crawl (every repository carrying the `dsh-plugin` topic, with its
 * assigned category already applied); `curated.json` carries the human
 * judgement the crawl cannot make — which entries are not plugins at all
 * (competing catalog sites, product repos whose stars belong to something
 * else). The crawl does NOT have those exclusions applied, so a client that
 * read only the first file would put a rival catalog at the top of its own
 * market. Both are therefore read together, and the reduction happens here
 * rather than in the browser: the client receives 100 rows, not 2.4 MB.
 */
import type { MarketCatalog, MarketPlugin } from './contract.ts';
/**
 * Where a reduction survives a restart. The catalog source neither opens nor
 * closes this — the plugin body owns the domain's lifecycle and hands the
 * source a narrow port, so a deployment without durable storage can still run
 * the market from memory alone.
 */
export interface CatalogCache {
    /** The last reduction and the ETags it was derived with. */
    read: () => {
        catalog: MarketCatalog | null;
        repositoriesEtag: string;
        curatedEtag: string;
    };
    /** Persist a fresh reduction. Failures are the cache's own business. */
    write: (next: {
        catalog: MarketCatalog;
        repositoriesEtag: string;
        curatedEtag: string;
    }) => void;
}
/** Deployment-varying knobs the plugin config owns. */
export interface CatalogOptions {
    /** Base URL holding `repositories.json` and `curated.json`. */
    readonly base: string;
    /** How many plugins the market shows. */
    readonly marketSize: number;
    /** Durable seat for the reduction; absent means memory-only. */
    readonly cache?: CatalogCache;
}
/**
 * The market's selection rule. A straight star ranking would hand almost every
 * seat to two or three categories — the crawl's biggest bucket alone holds
 * about a third of the ecosystem — and the point of this view is to answer
 * "what can DSH do", not "what has the most stars". So each category is sorted
 * by stars and the seats are dealt round by round: every category places its
 * best entry before any category places its second. The result is then ordered
 * by stars for display, so the list still reads as a leaderboard.
 * @param pool - every kept row, already sorted by stars descending.
 * @param marketSize - how many seats to deal.
 * @returns the dealt rows, ordered by stars descending.
 */
export declare function selectBalanced(pool: readonly MarketPlugin[], marketSize: number): MarketPlugin[];
/**
 * Reduce one crawl plus its curation into the catalog the browser renders.
 * @param repositoriesJson - the parsed `repositories.json` snapshot.
 * @param curatedJson - the parsed `curated.json` curation.
 * @param marketSize - how many rows the market shows.
 * @returns the reduced catalog.
 */
export declare function deriveCatalog(repositoriesJson: unknown, curatedJson: unknown, marketSize: number): MarketCatalog;
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
