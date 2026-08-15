/**
 * The safeMarket wire contract, shared verbatim by the host manifest
 * (`ctx.typert.register` in typert.ts) and the client contribution
 * (`ctx.remote.$mount` in client/remote.ts). The service exposes the reduced
 * community catalog and the plugin's own durable settings.
 *
 * Everything that crosses this boundary is remote text from a public
 * snapshot. It is reduced and sanitized on the Host — the repository link in
 * particular is rebuilt from `owner/name` rather than carried over from the
 * snapshot — so the browser half only ever renders values this contract has
 * already fixed the shape of.
 */
import { z } from 'zod'
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol'

/** One row of the market: a community plugin the catalog kept. */
export interface MarketPlugin {
  /** `owner/name`, the catalog's identity for the entry. */
  readonly fullName: string
  readonly owner: string
  readonly name: string
  /** Rebuilt from fullName on the Host — never the snapshot's own href. */
  readonly url: string
  readonly description: string
  readonly stars: number
  readonly language: string
  readonly license: string
  /** ISO date of the last push, for the "still maintained" read. */
  readonly pushedAt: string
  readonly category: string
  readonly categoryZh: string
  readonly categoryEn: string
}

/** One category filter, with how many of the kept rows fall under it. */
export interface MarketCategory {
  readonly key: string
  readonly zh: string
  readonly en: string
  readonly count: number
}

/** The reduced catalog the browser renders. */
export interface MarketCatalog {
  readonly items: readonly MarketPlugin[]
  readonly categories: readonly MarketCategory[]
  /** When the upstream crawl ran (the snapshot's own timestamp). */
  readonly fetchedAt: string
  /** When this Host last read the snapshot. */
  readonly refreshedAt: string
  /** How many repositories the crawl saw, before curation and the top cut. */
  readonly scanned: number
}

/** A catalog read: the answer, plus whether it is the last good one. */
export interface MarketCatalogResult {
  readonly catalog: MarketCatalog | null
  /** The catalog is a cached one; this read did not reach the snapshot. */
  readonly stale: boolean
  /** Why the read did not reach the snapshot, when it did not. */
  readonly error: string
}

/** The `safe-market` settings namespace's durable shape. */
export interface SafeMarketSettings {
  /**
   * Whether the market is on. Default false: the tab explains itself and
   * asks first, because turning it on is what starts reaching GitHub.
   */
  readonly enabled: boolean
}

/** One field update sent through the plugin-owned settings Remote. */
export type SafeMarketSettingsUpdate = { readonly field: 'enabled'; readonly value: boolean }

/** Strict wire codec for one market row. */
export const marketPluginSchema = z.object({
  fullName: z.string().min(1),
  owner: z.string().min(1),
  name: z.string().min(1),
  url: z.string().min(1),
  description: z.string(),
  stars: z.number().int().min(0),
  language: z.string(),
  license: z.string(),
  pushedAt: z.string(),
  category: z.string().min(1),
  categoryZh: z.string(),
  categoryEn: z.string(),
}).readonly()

/** Strict wire codec for one category filter. */
export const marketCategorySchema = z.object({
  key: z.string().min(1),
  zh: z.string(),
  en: z.string(),
  count: z.number().int().min(0),
}).readonly()

/** Strict wire codec for the reduced catalog. */
export const marketCatalogSchema = z.object({
  items: z.array(marketPluginSchema),
  categories: z.array(marketCategorySchema),
  fetchedAt: z.string(),
  refreshedAt: z.string(),
  scanned: z.number().int().min(0),
}).readonly()

/** Strict wire codec for one catalog read. */
export const marketCatalogResultSchema = z.object({
  catalog: z.union([marketCatalogSchema, z.null()]),
  stale: z.boolean(),
  error: z.string(),
}).readonly()

/** Strict wire codec for the resolved settings section. */
export const safeMarketSettingsSchema = z.object({
  enabled: z.boolean(),
}).readonly()

/** Strict wire codec for one field update. */
export const safeMarketSettingsUpdateSchema = z.discriminatedUnion('field', [
  z.object({ field: z.literal('enabled'), value: z.boolean() }).readonly(),
])

/** The safeMarket Remote namespace's strict invocation descriptors. */
export const SAFE_MARKET_INVOCATIONS: readonly InvocationDescriptor[] = [
  {
    id: 'dsh-desktop-safe-market#safeMarket/getCatalog',
    service: 'safeMarket',
    namespace: 'safeMarket',
    method: 'getCatalog',
    invocation: { kind: 'direct' },
    parameters: [
      {
        name: 'force',
        wire: 'force',
        source: 'json',
        codec: {
          mode: 'strict',
          typeSymbol: 'dsh-desktop-safe-market#ForceRefresh',
          schema: z.boolean(),
        },
      },
    ],
    cancellation: { parameter: 'signal' },
    result: {
      mode: 'strict',
      typeSymbol: 'dsh-desktop-safe-market#MarketCatalogResult',
      schema: marketCatalogResultSchema,
    },
  },
  {
    id: 'dsh-desktop-safe-market#safeMarket/getSettings',
    service: 'safeMarket',
    namespace: 'safeMarket',
    method: 'getSettings',
    invocation: { kind: 'direct' },
    parameters: [],
    result: {
      mode: 'strict',
      typeSymbol: 'dsh-desktop-safe-market#SafeMarketSettings',
      schema: safeMarketSettingsSchema,
    },
  },
  {
    id: 'dsh-desktop-safe-market#safeMarket/updateSettings',
    service: 'safeMarket',
    namespace: 'safeMarket',
    method: 'updateSettings',
    invocation: { kind: 'direct' },
    parameters: [
      {
        name: 'update',
        wire: 'update',
        source: 'json',
        codec: {
          mode: 'strict',
          typeSymbol: 'dsh-desktop-safe-market#SafeMarketSettingsUpdate',
          schema: safeMarketSettingsUpdateSchema,
        },
      },
    ],
    result: {
      mode: 'strict',
      typeSymbol: 'dsh-desktop-safe-market#SafeMarketSettings',
      schema: safeMarketSettingsSchema,
    },
  },
]
