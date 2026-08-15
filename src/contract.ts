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

/**
 * The only `owner/name` shape the market keeps. The repository link is
 * rebuilt on the Host from a slug matching this pattern, and the wire codec
 * enforces the same shape, so the "host rebuilds the href" invariant is held
 * by the contract rather than by a comment.
 */
export const REPOSITORY_SLUG_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/

/**
 * The only branch-name shape the review prompt may interpolate. Branches are
 * remote text from a public snapshot: anything outside this pattern (no
 * whitespace, no punctuation beyond `._/-`) could inject instructions into
 * the prompt or steer the tarball path, so the Host falls back to `main` for
 * it. The trailing checks mirror the git ref rules GitHub enforces: no `..`
 * anywhere, no segment may be `.` or end in `.`/`.lock`, and the name must
 * not end in `/` or `.`.
 */
export const BRANCH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/

/** Whether a trimmed branch name is safe to interpolate into the prompt. */
export function isSafeBranchName(value: string): boolean {
  if (!BRANCH_PATTERN.test(value)) return false
  if (value.includes('..') || value.includes('//') || value.endsWith('/') || value.endsWith('.')) return false
  return !value.split('/').some(segment => segment === '.' || segment.endsWith('.lock'))
}

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
  /** The repository's default branch — the install command's fallback ref. */
  readonly defaultBranch: string
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

/** One skill this deployment can currently resolve. */
export interface MarketSkill {
  readonly name: string
  readonly description: string
  readonly whenToUse: string
  /** The provider that owns the skill body (`filesystem`, `runtime`, …). */
  readonly provider: string
  /** Whether the model may invoke it on its own. */
  readonly modelInvocable: boolean
  /** Whether the user may invoke it with `/name`. */
  readonly userInvocable: boolean
}

/** Wire codec: one session identity (branded string on the wire). */
export const sessionIdSchema = z.string().min(1)

/** A skills read: the answer, or the reason there is none. */
export interface MarketSkillsResult {
  readonly skills: readonly MarketSkill[]
  /** False when a provider failed or reported incomplete discovery. */
  readonly complete: boolean
  readonly error: string
}

/**
 * What the browser needs to name the install command. The profile is a
 * deployment fact (the Host is the only side that knows which profile it
 * boots), and the command is the official one — this plugin never runs it.
 */
export interface MarketEnvironment {
  /** The profile whose plugins an install would change. */
  readonly profile: string
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
  fullName: z.string().regex(REPOSITORY_SLUG_PATTERN),
  owner: z.string().min(1),
  name: z.string().min(1),
  // The Host rebuilds this from fullName; the codec makes the invariant
  // machine-checked, so no renderer needs to trust a caller's href.
  url: z.string().regex(/^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/),
  description: z.string(),
  stars: z.number().int().min(0),
  language: z.string(),
  license: z.string(),
  pushedAt: z.string(),
  defaultBranch: z.string().refine(isSafeBranchName),
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
  items: z.array(marketPluginSchema).readonly(),
  categories: z.array(marketCategorySchema).readonly(),
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

/** Strict wire codec for one resolvable skill. */
export const marketSkillSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  whenToUse: z.string(),
  provider: z.string(),
  modelInvocable: z.boolean(),
  userInvocable: z.boolean(),
}).readonly()

/** Strict wire codec for one skills read. */
export const marketSkillsResultSchema = z.object({
  skills: z.array(marketSkillSchema).readonly(),
  complete: z.boolean(),
  error: z.string(),
}).readonly()

/** Strict wire codec for the deployment facts the browser needs. */
export const marketEnvironmentSchema = z.object({
  profile: z.string(),
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
    id: 'dsh-desktop-safe-market#safeMarket/listSkills',
    service: 'safeMarket',
    namespace: 'safeMarket',
    method: 'listSkills',
    invocation: { kind: 'direct' },
    parameters: [
      {
        name: 'agent',
        wire: 'agentId',
        source: 'lookup',
        lookup: 'agent',
        // The type symbol must equal the agent lookup provider's wire identity
        // exactly — the gateway's strict path rejects a mismatched symbol.
        codec: { mode: 'strict', typeSymbol: '@deepseek-ai/dsh-session/types#SessionId', schema: sessionIdSchema },
      },
    ],
    cancellation: { parameter: 'signal' },
    result: {
      mode: 'strict',
      typeSymbol: 'dsh-desktop-safe-market#MarketSkillsResult',
      schema: marketSkillsResultSchema,
    },
  },
  {
    id: 'dsh-desktop-safe-market#safeMarket/describe',
    service: 'safeMarket',
    namespace: 'safeMarket',
    method: 'describe',
    invocation: { kind: 'direct' },
    parameters: [],
    result: {
      mode: 'strict',
      typeSymbol: 'dsh-desktop-safe-market#MarketEnvironment',
      schema: marketEnvironmentSchema,
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
