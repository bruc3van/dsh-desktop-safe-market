/**
 * The market's durable domain: the reduced catalog and the ETags that let the
 * next read ask conditionally.
 *
 * Caching the reduction rather than the crawl is the point. The snapshot is
 * 2.4 MB and moves once a day; what the browser needs is the ~100 rows it was
 * reduced to. Keeping those on disk means a Host restart costs two 304s
 * instead of a full download, and a Host that cannot reach GitHub at all
 * still opens the market with the last catalog it saw.
 */
import { z } from 'zod'
import { defineDomain } from '@deepseek-ai/dsh-storage-domain'
import { marketCatalogSchema } from './contract.ts'

/** The durable state: one catalog, plus what it was fetched with. */
export const safeMarketDomainState = z.object({
  /** The last reduction, or null before the first successful read. */
  catalog: z.union([marketCatalogSchema, z.null()]),
  /** ETag of `repositories.json` when the catalog was derived. */
  repositoriesEtag: z.string(),
  /** ETag of `curated.json` when the catalog was derived. */
  curatedEtag: z.string(),
  /**
   * The market size the catalog was reduced with. A deployment that changes
   * `marketSize` must not keep serving a list cut to the old number.
   */
  marketSize: z.number().int().min(1),
  /** The catalog base the reduction came from, for the same reason. */
  catalogBase: z.string(),
})

/** Durable market state inferred from {@link safeMarketDomainState}. */
export type SafeMarketDomainState = z.infer<typeof safeMarketDomainState>

/** The empty state a first run opens with. */
export const initialDomainState: SafeMarketDomainState = {
  catalog: null,
  repositoriesEtag: '',
  curatedEtag: '',
  marketSize: 0,
  catalogBase: '',
}

/**
 * The `safe-market` domain spec: one global singleton, no tables. The plugin
 * opens this through `ctx.storageDomain`; the spec object is the single
 * source of the domain's identity, version, and schema.
 */
export const safeMarketDomainSpec = defineDomain({
  // Domain names are `/^[a-z][a-z0-9_]*$/` — no hyphen, unlike the settings
  // namespace and the package name. A mismatch throws at module load, which
  // fails the whole plugin tree, not just this plugin.
  name: 'safe_market',
  version: 1,
  global: { schema: safeMarketDomainState, initial: initialDomainState },
  tables: {},
})
