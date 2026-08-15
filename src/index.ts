/**
 * dsh-desktop-safe-market host plugin: mounts the `safeMarket` Typert Remote
 * service (the reduced community plugin catalog plus the market's own durable
 * settings) and registers its strict Typert manifest. The client half ships
 * in the same package (`./client`); the web server serves it under
 * /plugins/dsh-desktop-safe-market/client.js.
 *
 * The plugin installs nothing. Its whole job is to put a reviewed shortlist in
 * front of the user and hand a security-review prompt to a session the user
 * then confirms — the install itself is the agent's work, under the user's eye.
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
// Type-only: brings the `ctx.typert` Context merge into this program.
import type {} from '@deepseek-ai/dsh-typert-registry'
// Type-only: brings the `ctx.settings` Context merge in.
import type {} from '@deepseek-ai/dsh-settings'
import { createCatalogSource } from './catalog.ts'
import { SafeMarketRuntime } from './runtime.ts'
import { registerSafeMarketSettings } from './settings.ts'
import { TYPERT_MANIFEST } from './typert.ts'
import type { SafeMarketSettingsUpdate } from './contract.ts'

/** Cordis plugin name (the Loader entry and client bundle id). */
export const name = 'dsh-desktop-safe-market'

/** Services required before load: the Typert registry and the settings provider. */
export const inject = ['typert', 'settings']

export type {
  MarketCatalog,
  MarketCatalogResult,
  MarketCategory,
  MarketPlugin,
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
}

/**
 * Configuration schema. Both fields are deployment-varying: a fork can point
 * the market at its own curation, and a smaller list suits a smaller window.
 */
export const Config = z.object({
  catalogBase: z.string().default(DEFAULT_CATALOG_BASE),
  marketSize: z.natural().min(1).default(100),
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
  const catalog = createCatalogSource({ base: resolved.catalogBase, marketSize: resolved.marketSize })
  new SafeMarketRuntime(ctx, catalog, readSettings, writeSettings)

  // Strict endpoint registration: the gateway resolves the market's calls
  // from this manifest, independent of decorator marker state.
  ctx.effect(() => {
    const dispose = ctx.typert.register(TYPERT_MANIFEST)
    return () => { void dispose() }
  }, 'dsh-desktop-safe-market: typert manifest')
}
