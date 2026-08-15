/**
 * dsh-desktop-safe-market client plugin: the browser half of the safe plugin
 * marketplace. Mounts the safeMarket Remote namespace, contributes the
 * Marketplace tab to the Plugins settings section, and owns the install
 * hand-off — which opens a session in the current or most recent workspace and
 * stages a security-review prompt in its composer.
 *
 * Nothing is sent. The draft is written through the published conversation
 * face and left there: the person at the keyboard reads the prompt and presses
 * Enter, and the install that follows is the agent's work under their eye.
 */
// Type-only: the ctx.remote merge and the forwarded Host-event face.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import {
  createSnapshotStore,
  type ClientContext,
  type ISessions,
  type IWorkspaces,
} from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: the ctx.locale Context merge.
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: brings the settings SlotMap declarations (settings.plugins.tab) in.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { IConversation } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {
  MarketCatalogResult,
  MarketPlugin,
  SafeMarketSettings,
  SafeMarketSettingsUpdate,
} from '../contract.ts'
import { SAFE_MARKET_REMOTE } from './remote.ts'
import { MarketTab, type InstallOutcome, type MarketTabInjected } from './MarketTab.tsx'
import { en, zh, type SafeMarketLocaleKey } from './locales.ts'
import { adoptStyles } from './styles.ts'

export type { MarketTabInjected, MarketTabProps, InstallOutcome } from './MarketTab.tsx'
export type { SafeMarketLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The safe plugin marketplace's copy. */
    'settings.safeMarket': SafeMarketLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.safeMarket'

/** Required services: settings seat, locale, the Remote face, and the session/composer domains. */
export const inject = ['slots', 'locale', 'remote', 'sessions', 'workspaces', 'conversation']

/** How long the hand-off waits for a freshly opened session to own a client scope. */
const SCOPE_WAIT_MS = 4_000
const SCOPE_POLL_MS = 60

/** The mounted safeMarket namespace service's callable face. */
interface SafeMarketFace {
  getCatalog(force: boolean, signal?: AbortSignal): Promise<{ ok: true; value: MarketCatalogResult } | { ok: false; error: { code: string; message: string } }>
  getSettings(): Promise<{ ok: true; value: SafeMarketSettings } | { ok: false; error: { code: string; message: string } }>
  updateSettings(update: SafeMarketSettingsUpdate): Promise<{ ok: true; value: SafeMarketSettings } | { ok: false; error: { code: string; message: string } }>
}

const defaultSettings = (): SafeMarketSettings => ({ enabled: false })

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms) })
}

/**
 * Compose the marketplace surface.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  adoptStyles()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-desktop-safe-market: dictionaries')

  const scope = createSnapshotStore({ value: defaultSettings() })
  let settingsGeneration = 0

  const reportError = (operation: string, error: unknown): void => {
    console.error(`[dsh-desktop-safe-market] ${operation} failed:`, error)
  }

  // The mounted namespace handle resolves through the service store
  // (`ctx.reflect.get`), not through `ctx.remote.safeMarket`: the dotted read
  // walks the cordis fiber chain, which stops at the Loader's runtime-less
  // internal forks between a plugin entry and the root fiber.
  let market: SafeMarketFace | undefined

  const loadSettings = async (): Promise<void> => {
    const remote = market
    if (remote === undefined) return
    const generation = ++settingsGeneration
    try {
      const result = await remote.getSettings()
      if (market !== remote || generation !== settingsGeneration) return
      if (!result.ok) {
        reportError('settings read', result.error)
        return
      }
      scope.set({ value: result.value })
    } catch (error) {
      if (market === remote && generation === settingsGeneration) reportError('settings read', error)
    }
  }

  ctx.effect(async () => {
    const dispose = await ctx.remote.$mount(SAFE_MARKET_REMOTE)
    market = (ctx.reflect as unknown as { get(name: string): unknown }).get('remote.safeMarket') as SafeMarketFace | undefined
    if (market === undefined) {
      throw new Error('dsh-desktop-safe-market: the safeMarket Remote namespace did not mount')
    }
    await loadSettings()
    return () => {
      settingsGeneration += 1
      market = undefined
      void dispose()
    }
  }, 'dsh-desktop-safe-market: remote')

  // Reconnect may have rebuilt the host: the durable switch is re-read rather
  // than assumed to have survived.
  ctx.on('connection/reset', () => { void loadSettings() })

  const setEnabled = async (enabled: boolean): Promise<void> => {
    const remote = market
    if (remote === undefined) {
      reportError('settings update', new Error('the safeMarket Remote is not mounted'))
      return
    }
    const generation = ++settingsGeneration
    try {
      const result = await remote.updateSettings({ field: 'enabled', value: enabled })
      if (market !== remote || generation !== settingsGeneration) return
      if (!result.ok) {
        reportError('settings update', result.error)
        return
      }
      scope.set({ value: result.value })
    } catch (error) {
      if (market === remote && generation === settingsGeneration) reportError('settings update', error)
    }
  }

  const loadCatalog = async (force: boolean): Promise<MarketCatalogResult> => {
    const remote = market
    if (remote === undefined) throw new Error('the safeMarket Remote is not mounted')
    const result = await remote.getCatalog(force)
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    return result.value
  }

  /**
   * The install hand-off. Every step goes through a published service face:
   * the workspace domain resolves and connects the target, the session domain
   * navigates to it, and the conversation face writes the draft. Nothing here
   * reads the DOM, and nothing here sends.
   */
  const install = async (target: MarketPlugin, prompt: string): Promise<InstallOutcome> => {
    const workspaces = ctx.get('workspaces') as IWorkspaces
    const sessions = ctx.get('sessions') as unknown as ISessions
    const conversation = ctx.get('conversation') as IConversation

    // The same target rule the shell's own New Session action uses: the
    // current session's workspace, then the recency projection.
    const workspaceState = workspaces.list.getSnapshot()
    const current = sessions.list.getSnapshot().current
    const currentWorkspaceId = current === undefined
      ? undefined
      : workspaceState.items.find(item => item.sessionIds.includes(current))?.workspaceId
    const workspaceId = currentWorkspaceId ?? workspaceState.recentWorkspaceId
    if (workspaceId === undefined) return { ok: false, reason: 'no-workspace' }

    try {
      const sessionId = await workspaces.connectWorkspace(workspaceId)
      sessions.open(sessionId)
      // The session's client scope appears when the session mounts, which is
      // a render away from the open above — so the draft waits for its seat
      // rather than being written into nothing.
      const deadline = Date.now() + SCOPE_WAIT_MS
      let actx = sessions.scope(sessionId)
      while (actx === undefined && Date.now() < deadline) {
        await wait(SCOPE_POLL_MS)
        actx = sessions.scope(sessionId)
      }
      if (actx === undefined) {
        return { ok: false, reason: 'failed', message: 'the new session did not open' }
      }
      conversation.input.for(actx).setDraft(prompt)
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: 'failed', message: error instanceof Error ? error.message : String(error) }
    }
  }

  const t = ctx.locale.bind(NS)

  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'safe-market',
    // After the shipped configuration (0) and inventory (10) tabs.
    order: 20,
    label: () => t('tab'),
    locale: NS,
    inject: (): MarketTabInjected => ({
      hooks: { scope },
      setEnabled,
      loadCatalog,
      install,
    }),
  }, MarketTab))
}
