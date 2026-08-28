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
  type ClientContext,
  type ISessions,
} from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: the ctx.locale Context merge.
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: brings the settings SlotMap declarations (settings.plugins.tab) in.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { IConversation } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {
  MarketCatalogResult,
  MarketEnvironment,
  MarketInstalledResult,
  MarketSkillsResult,
  SafeMarketSettings,
  SafeMarketSettingsUpdate,
} from '../contract.ts'
import { SAFE_MARKET_REMOTE } from './remote.ts'
import {
  MarketSection,
  type ChooseWorkspaceOutcome,
  type InstallOutcome,
  type MarketSectionInjected,
  type WorkspaceReadiness,
} from './MarketSection.tsx'
import { NO_SESSION, SESSIONS_PENDING } from './SkillsView.tsx'
import { en, zh, type SafeMarketLocaleKey } from './locales.ts'
import { adoptNavIcon } from './navIcon.ts'
import { adoptStyles } from './styles.ts'
import {
  type MarketUiWorkspace,
  type MarketWorkspaces,
  type WorkspaceTarget,
  workspaceNavigation,
  workspaceReady,
  workspaceTargetOf,
} from './workspaceCompat.ts'

export type {
  ChooseWorkspaceOutcome,
  InstallOutcome,
  MarketSectionInjected,
  MarketSectionProps,
  WorkspaceReadiness,
} from './MarketSection.tsx'
export type { SafeMarketLocaleKey } from './locales.ts'
export { NO_SESSION, SESSIONS_PENDING } from './SkillsView.tsx'

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
/** How long a freshly registered workspace gets to reach the list mirror. */
const WORKSPACE_WAIT_MS = 4_000

/** A dependency-free root store; its identity and snapshots stay stable between writes. */
function createMarketStore<T>(initial: T): {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
  set(next: T): void
} {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => value,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set: (next) => {
      if (Object.is(value, next)) return
      value = next
      for (const listener of [...listeners]) listener()
    },
  }
}

/** The mounted safeMarket namespace service's callable face. */
interface SafeMarketFace {
  getCatalog(force: boolean, signal?: AbortSignal): Promise<{ ok: true; value: MarketCatalogResult } | { ok: false; error: { code: string; message: string } }>
  listSkills(agentId: string, signal?: AbortSignal): Promise<{ ok: true; value: MarketSkillsResult } | { ok: false; error: { code: string; message: string } }>
  describe(): Promise<{ ok: true; value: MarketEnvironment } | { ok: false; error: { code: string; message: string } }>
  getSettings(): Promise<{ ok: true; value: SafeMarketSettings } | { ok: false; error: { code: string; message: string } }>
  updateSettings(update: SafeMarketSettingsUpdate): Promise<{ ok: true; value: SafeMarketSettings } | { ok: false; error: { code: string; message: string } }>
  listInstalled(): Promise<{ ok: true; value: MarketInstalledResult } | { ok: false; error: { code: string; message: string } }>
  setInstalledEnabled(update: { packageName: string; enabled: boolean }): Promise<{ ok: true; value: MarketInstalledResult } | { ok: false; error: { code: string; message: string } }>
  uninstallInstalled(update: { packageName: string }): Promise<{ ok: true; value: MarketInstalledResult } | { ok: false; error: { code: string; message: string } }>
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
  ctx.effect(() => adoptStyles(), 'dsh-desktop-safe-market: styles')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-desktop-safe-market: dictionaries')
  // The settings shell hardcodes section nav icons by id (unknown ids get the
  // gear); re-skin this section's row with the market's own storefront.
  ctx.effect(() => adoptNavIcon(), 'dsh-desktop-safe-market: nav icon')

  const scope = createMarketStore({ value: defaultSettings(), profile: null as string | null, version: '' })
  let settingsGeneration = 0

  const workspaces = ctx.get('workspaces') as unknown as MarketWorkspaces
  const sessions = ctx.get('sessions') as unknown as ISessions
  const navigation = workspaceNavigation(
    workspaces,
    () => (ctx as unknown as { get(name: string): unknown }).get('uiWorkspace') as MarketUiWorkspace | undefined,
  )

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
      scope.set({ ...scope.getSnapshot(), value: result.value })
    } catch (error) {
      if (market === remote && generation === settingsGeneration) reportError('settings read', error)
    }
  }

  /**
   * The deployment facts the install prompt needs. Read once per mount: the
   * profile a Host boots does not change under a running client.
   */
  const loadEnvironment = async (): Promise<void> => {
    const remote = market
    if (remote === undefined) return
    try {
      const result = await remote.describe()
      if (market !== remote) return
      if (!result.ok) {
        reportError('describe', result.error)
        return
      }
      scope.set({ ...scope.getSnapshot(), profile: result.value.profile, version: result.value.version })
    } catch (error) {
      if (market === remote) reportError('describe', error)
    }
  }

  ctx.effect(async () => {
    const dispose = await ctx.remote.$mount(SAFE_MARKET_REMOTE)
    market = (ctx.reflect as unknown as { get(name: string): unknown }).get('remote.safeMarket') as SafeMarketFace | undefined
    if (market === undefined) {
      throw new Error('dsh-desktop-safe-market: the safeMarket Remote namespace did not mount')
    }
    await Promise.all([loadSettings(), loadEnvironment()])
    return () => {
      settingsGeneration += 1
      market = undefined
      void dispose()
    }
  }, 'dsh-desktop-safe-market: remote')

  // Reconnect may have rebuilt the host: the durable switch and the
  // deployment facts are re-read rather than assumed to have survived.
  ctx.on('connection/reset', () => {
    void loadSettings()
    void loadEnvironment()
  })

  const setEnabled = async (enabled: boolean): Promise<void> => {
    const remote = market
    if (remote === undefined) {
      const error = new Error('the safeMarket Remote is not mounted')
      reportError('settings update', error)
      throw error
    }
    const generation = ++settingsGeneration
    let result: { ok: true; value: SafeMarketSettings } | { ok: false; error: { code: string; message: string } }
    try {
      result = await remote.updateSettings({ field: 'enabled', value: enabled })
    } catch (error) {
      if (market === remote && generation === settingsGeneration) {
        reportError('settings update', error)
        throw error
      }
      return
    }
    if (market !== remote || generation !== settingsGeneration) return
    if (!result.ok) {
      reportError('settings update', result.error)
      throw new Error(result.error.message)
    }
    scope.set({ ...scope.getSnapshot(), value: result.value })
  }

  /**
   * The skills read is addressed by the current session, not by the plugin's
   * root context. The registry is host+per-scope layered and the web
   * deployment leaves local discovery to whichever agent preset a session
   * runs, so only a session's scope chain can answer what the user actually
   * has. With no session open there is nothing to address, and saying so is
   * the honest answer.
   */
  const listSkills = async (): Promise<MarketSkillsResult> => {
    const remote = market
    if (remote === undefined) throw new Error('the safeMarket Remote is not mounted')
    const sessions = ctx.get('sessions') as unknown as ISessions
    const snapshot = sessions.list.getSnapshot()
    // "Pending" means the first list pull has not landed yet — telling the
    // user "open a session first" while the list is still loading would be
    // a wrong answer, not the honest one.
    if (snapshot.phase !== 'ready') return { skills: [], complete: true, error: SESSIONS_PENDING }
    if (snapshot.current === undefined) return { skills: [], complete: true, error: NO_SESSION }
    const result = await remote.listSkills(snapshot.current as unknown as string)
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    return result.value
  }

  const loadCatalog = async (force: boolean): Promise<MarketCatalogResult> => {
    const remote = market
    if (remote === undefined) throw new Error('the safeMarket Remote is not mounted')
    const result = await remote.getCatalog(force)
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    return result.value
  }

  /** The installed-panel verbs: local profile facts, so they need no market switch. */
  const listInstalled = async (): Promise<MarketInstalledResult> => {
    const remote = market
    if (remote === undefined) throw new Error('the safeMarket Remote is not mounted')
    const result = await remote.listInstalled()
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    return result.value
  }

  const setInstalledEnabled = async (packageName: string, enabled: boolean): Promise<MarketInstalledResult> => {
    const remote = market
    if (remote === undefined) throw new Error('the safeMarket Remote is not mounted')
    const result = await remote.setInstalledEnabled({ packageName, enabled })
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    return result.value
  }

  const uninstallInstalled = async (packageName: string): Promise<MarketInstalledResult> => {
    const remote = market
    if (remote === undefined) throw new Error('the safeMarket Remote is not mounted')
    const result = await remote.uninstallInstalled({ packageName })
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    return result.value
  }

  /**
   * The second half of every install hand-off: connect the workspace, navigate
   * to its session, and write the draft. Every step goes through a published
   * service face; nothing here reads the DOM, and nothing here sends.
   */
  const stageIn = async (workspaceId: WorkspaceTarget, prompt: string): Promise<InstallOutcome> => {
    const conversation = ctx.get('conversation') as IConversation
    try {
      const sessionId = await navigation.connectWorkspace(workspaceId)
      const typedSessionId = sessionId as Parameters<ISessions['open']>[0]
      sessions.open(typedSessionId)
      // The session's client scope appears when the session mounts, which is
      // a render away from the open above — so the draft waits for its seat
      // rather than being written into nothing.
      const deadline = Date.now() + SCOPE_WAIT_MS
      let actx = sessions.scope(typedSessionId)
      while (actx === undefined && Date.now() < deadline) {
        await wait(SCOPE_POLL_MS)
        actx = sessions.scope(typedSessionId)
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

  /**
   * Register a directory as a Workspace, through the Host's own picker.
   *
   * The directory is the one thing here that cannot be inferred: it is where
   * the agent will work, so the choice stays with the person making it. What
   * this removes is the errand — the old answer sent them to the sidebar and
   * asked them to come back and start over.
   */
  const chooseWorkspaceId = async (): Promise<
    | { ok: true; id: WorkspaceTarget; path: string }
    | { ok: false; reason: 'cancelled' }
    | { ok: false; reason: 'failed'; message: string }
  > => {
    try {
      const path = await navigation.pickDirectory()
      // A cancelled picker is an answer, not a failure: the user changed
      // their mind, and the card says so instead of showing an error.
      if (path === null) return { ok: false, reason: 'cancelled' }
      const created = await workspaces.create({ path })
      // `connectWorkspace` resolves against the list mirror, which the create
      // response reaches one projection later. Same shape as the scope wait.
      const deadline = Date.now() + WORKSPACE_WAIT_MS
      while (Date.now() < deadline
        && !workspaces.list.getSnapshot().items.some(item => item.workspaceId === created.workspaceId)) {
        await wait(SCOPE_POLL_MS)
      }
      return { ok: true, id: created.workspaceId, path }
    } catch (error) {
      return { ok: false, reason: 'failed', message: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * The install hand-off: resolve the workspace, then stage the prompt in it.
   */
  const install = async (prompt: string): Promise<InstallOutcome> => {
    // The same target rule the shell's own New Session action uses: the
    // current session's workspace, then the recency projection. Both derive
    // from the two-baseline readiness flag — in the first moments of boot
    // `items` is still empty and "no workspace yet" would be a wrong answer.
    const workspaceState = workspaces.list.getSnapshot()
    const sessionState = sessions.list.getSnapshot()
    if (!workspaceReady(workspaceState, sessionState)) return { ok: false, reason: 'not-ready' }
    const workspaceId = workspaceTargetOf(
      workspaceState,
      sessionState as unknown as Parameters<typeof workspaceTargetOf>[1],
    )
    if (workspaceId === undefined) return { ok: false, reason: 'no-workspace' }
    return await stageIn(workspaceId, prompt)
  }

  /** The install hand-off for a deployment with no workspace yet. */
  const installIntoNewWorkspace = async (prompt: string): Promise<InstallOutcome> => {
    const chosen = await chooseWorkspaceId()
    if (!chosen.ok) return chosen
    return await stageIn(chosen.id, prompt)
  }

  /** Pick and register a workspace on its own, for the page's standing notice. */
  const chooseWorkspace = async (): Promise<ChooseWorkspaceOutcome> => {
    const chosen = await chooseWorkspaceId()
    return chosen.ok ? { ok: true, path: chosen.path } : chosen
  }

  /**
   * Live workspace readiness for the notice at the top of the Plugins page,
   * read straight off the domain's own list store so it clears itself the
   * moment a workspace appears — from this flow or from anywhere else.
   */
  const workspaceReadiness = {
    getSnapshot: (): WorkspaceReadiness => {
      const state = workspaces.list.getSnapshot()
      if (!workspaceReady(state, sessions.list.getSnapshot())) return 'pending'
      return state.items.length > 0 ? 'present' : 'none'
    },
    subscribe: (fn: () => void): (() => void) => {
      const disposeWorkspaces = workspaces.list.subscribe(fn)
      const disposeSessions = sessions.list.subscribe(fn)
      return () => {
        disposeSessions()
        disposeWorkspaces()
      }
    },
  }

  const t = ctx.locale.bind(NS)

  // A section of its own rather than a tab inside the official Plugins page:
  // the settings shell hands every section a `close`, and closing is the
  // second half of the install hand-off (the prompt is staged in a session
  // this window is covering).
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'safe-market',
    // After the shipped sections (General 0, Plugins 15, …), beside the
    // other feature-owned entries.
    order: 60,
    label: () => t('nav'),
    locale: NS,
    inject: (): MarketSectionInjected => ({
      hooks: { scope },
      setEnabled,
      loadCatalog,
      listSkills,
      install,
      installIntoNewWorkspace,
      chooseWorkspace,
      workspaceReadiness,
      listInstalled,
      setInstalledEnabled,
      uninstallInstalled,
    }),
  }, MarketSection))
}
