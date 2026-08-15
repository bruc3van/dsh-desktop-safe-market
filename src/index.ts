/**
 * dsh-desktop-safe-market host plugin: mounts the `safeMarket` Typert Remote
 * service (the reduced community plugin catalog, the deployment's resolvable
 * skills, and the market's own durable settings) and registers its strict
 * Typert manifest. The client half ships in the same package (`./client`); the
 * web server serves it under /plugins/dsh-desktop-safe-market/client.js.
 *
 * The plugin installs nothing and runs no command. Its whole job is to put a
 * reviewed shortlist in front of the user and hand a security-review prompt —
 * naming the official install command — to a session the user then confirms.
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
// Type-only: brings the `ctx.typert` Context merge into this program.
import type {} from '@deepseek-ai/dsh-typert-registry'
// Type-only: brings the `ctx.settings` Context merge in.
import type {} from '@deepseek-ai/dsh-settings'
// Type-only: brings the `ctx.storageDomain` Context merge in.
import type {} from '@deepseek-ai/dsh-storage-domain'
import { createCatalogSource, type CatalogCache } from './catalog.ts'
import { SafeMarketRuntime } from './runtime.ts'
import { registerSafeMarketSettings } from './settings.ts'
import { readSkills } from './skills.ts'
import { initialDomainState, safeMarketDomainSpec, type SafeMarketDomainState } from './store.ts'
import { TYPERT_MANIFEST } from './typert.ts'
import type { SafeMarketSettingsUpdate } from './contract.ts'

/** Cordis plugin name (the Loader entry and client bundle id). */
export const name = 'dsh-desktop-safe-market'

/**
 * Services required before load. `skills` and `storageDomain` join the
 * settings and Typert seats: the market lists what this deployment can
 * resolve, and keeps its reduction across restarts.
 */
export const inject = ['typert', 'settings', 'skills', 'storageDomain']

export type {
  MarketCatalog,
  MarketCatalogResult,
  MarketCategory,
  MarketEnvironment,
  MarketPlugin,
  MarketSkill,
  MarketSkillsResult,
  SafeMarketSettings,
} from './contract.ts'

/** The published community catalog this market reads. */
const DEFAULT_CATALOG_BASE = 'https://raw.githubusercontent.com/bruc3van/awesome-dsh-plugin/main/data'

/** Host plugin configuration, validated at load by the Loader. */
export interface Config {
  /** Base URL holding `repositories.json` and `curated.json`. */
  catalogBase: string
  /** How many plugins the market shows. */
  marketSize: number
  /**
   * The profile an install would change. It names the `--profile` argument in
   * the review prompt's install command; the web GUI boots the `web` profile.
   */
  profile: string
}

/**
 * Configuration schema. Every field is deployment-varying: a fork can point
 * the market at its own curation, a smaller list suits a smaller window, and
 * a deployment booting a differently-named profile must not hand the user a
 * command aimed at someone else's.
 */
export const Config = z.object({
  catalogBase: z.string().default(DEFAULT_CATALOG_BASE),
  marketSize: z.natural().min(1).default(100),
  profile: z.string().default('web'),
})

/**
 * Mount the market service.
 * @param ctx - host cordis context.
 * @param config - validated plugin configuration (schema defaults applied).
 */
export function apply(ctx: Context, config?: Config): void {
  const resolved: Config = Config(config ?? {})
  // The durable enable switch: the runtime reads its live value on every
  // call, so toggling it in the Web settings takes effect immediately.
  const settings = registerSafeMarketSettings(ctx)
  const readSettings = () => settings.get()
  const writeSettings = async (update: SafeMarketSettingsUpdate) => {
    await settings.update({ enabled: update.value })
    return settings.get()
  }

  // The reduction's durable seat. The domain opens asynchronously, so the
  // cache port answers from memory until it is there — a market opened in the
  // first moments of boot reads the network once instead of failing.
  let state: SafeMarketDomainState = initialDomainState
  let persist: ((next: SafeMarketDomainState) => void) | undefined
  const cache: CatalogCache = {
    read: () => (
      // A reduction cut with different settings answers a different question.
      state.catalog !== null && state.marketSize === resolved.marketSize && state.catalogBase === resolved.catalogBase
        ? { catalog: state.catalog, repositoriesEtag: state.repositoriesEtag, curatedEtag: state.curatedEtag }
        : { catalog: null, repositoriesEtag: '', curatedEtag: '' }
    ),
    write: (next) => {
      state = {
        catalog: next.catalog,
        repositoriesEtag: next.repositoriesEtag,
        curatedEtag: next.curatedEtag,
        marketSize: resolved.marketSize,
        catalogBase: resolved.catalogBase,
      }
      persist?.(state)
    },
  }

  ctx.effect(async () => {
    const domain = await ctx.storageDomain.open(safeMarketDomainSpec)
    const stored = domain.global.get()
    // Only adopt what the source has not already replaced: a read that landed
    // while the domain was opening is newer than anything on disk.
    if (state.catalog === null) state = stored
    persist = (next) => {
      // Durability is an optimization, and a failed write must not take the
      // market down with it — the reduction is still in memory either way.
      void domain.global.set(next).catch((error: unknown) => {
        console.warn('[dsh-desktop-safe-market] catalog cache write failed:', error)
      })
    }
    return () => {
      persist = undefined
      void domain.close()
    }
  }, 'dsh-desktop-safe-market: catalog cache')

  const catalog = createCatalogSource({ base: resolved.catalogBase, marketSize: resolved.marketSize, cache })
  new SafeMarketRuntime(
    ctx,
    catalog,
    readSettings,
    writeSettings,
    (agent, signal) => readSkills(ctx, agent, signal),
    { profile: resolved.profile },
  )

  // Strict endpoint registration: the gateway resolves the market's calls
  // from this manifest, independent of decorator marker state.
  ctx.effect(() => {
    const dispose = ctx.typert.register(TYPERT_MANIFEST)
    return () => { void dispose() }
  }, 'dsh-desktop-safe-market: typert manifest')
}
