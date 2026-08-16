/**
 * The Marketplace settings section: its own entry in the Settings navigation,
 * with two pages of its own.
 *
 * **Plugins** is the community shortlist. While the market is off it is one
 * card that says what turning it on will do and asks; the switch is the
 * plugin's own durable setting, so the answer survives a restart. While it is
 * on, each card's action stages a security-review prompt in a new session —
 * it installs nothing itself.
 *
 * **Skills** is what this deployment can already resolve. It needs neither the
 * switch nor the network.
 *
 * A section (rather than a tab inside the official Plugins page) is what makes
 * the hand-off complete: the settings shell hands every section a `close`,
 * so staging the prompt can end with the user looking at the session it was
 * staged in.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactElement } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  MarketCatalog,
  MarketInstalledPackage,
  MarketInstalledResult,
  MarketPlugin,
  MarketSkillsResult,
  SafeMarketSettings,
} from '../contract.ts'
import { isSafeVersion } from '../contract.ts'
import type { MarketLocale } from './copy.ts'
import { describeInstalled, ownedBy, ownedIndexOf, shortName } from './owned.ts'
import { SkillsView } from './SkillsView.tsx'

/** The live snapshot the section renders from: the switch plus the deployment facts. */
export interface SafeMarketSnapshot {
  readonly value: SafeMarketSettings
  /**
   * The profile an install would change; names `--profile` in the prompt.
   * Null until the Host's `describe` has answered — the install button stays
   * disabled while it is, because naming the wrong profile in the official
   * command would hand the user a command aimed at someone else's deployment.
   */
  readonly profile: string | null
  /** The market's own version, from the same `describe`; '' until it answers. */
  readonly version: string
}
export type SafeMarketSource = ObservableSnapshot<SafeMarketSnapshot>

/** What the install hand-off reports back to the card that asked for it. */
export type InstallOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'not-ready' }
  | { readonly ok: false; readonly reason: 'no-workspace' }
  | { readonly ok: false; readonly reason: 'cancelled' }
  | { readonly ok: false; readonly reason: 'failed'; readonly message: string }

/** What registering a directory as a Workspace reports back. */
export type ChooseWorkspaceOutcome =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly reason: 'cancelled' }
  | { readonly ok: false; readonly reason: 'failed'; readonly message: string }

/**
 * Whether this deployment has a Workspace to install into.
 *
 * `pending` is its own answer rather than a flavour of `none`: for the first
 * moments of a boot the list mirror is legitimately empty, and telling someone
 * with a dozen workspaces that they have none is worse than saying nothing.
 */
export type WorkspaceReadiness = 'pending' | 'none' | 'present'

/** Injected business face: the live source and the section's verbs. */
export interface MarketSectionInjected {
  hooks: { scope: SafeMarketSource }
  /** Turn the market on or off (durable). */
  setEnabled: (enabled: boolean) => Promise<void>
  /** Read the reduced catalog; `force` bypasses the refresh interval. */
  loadCatalog: (force: boolean) => Promise<{ catalog: MarketCatalog | null; stale: boolean; error: string }>
  /** Read the skills this deployment resolves. */
  listSkills: () => Promise<MarketSkillsResult>
  /** Open a session in the current or most recent workspace and stage the given prompt. */
  install: (target: MarketPlugin, prompt: string) => Promise<InstallOutcome>
  /**
   * The same hand-off for someone who has no workspace yet: pick a directory
   * through the Host's own picker, register it, then stage the prompt in it.
   */
  installIntoNewWorkspace: (target: MarketPlugin, prompt: string) => Promise<InstallOutcome>
  /** Pick a directory and register it as a Workspace, installing nothing. */
  chooseWorkspace: () => Promise<ChooseWorkspaceOutcome>
  /** Live answer to "is there a workspace to install into?". */
  workspaceReadiness: {
    getSnapshot: () => WorkspaceReadiness
    subscribe: (fn: () => void) => () => void
  }
  /** Read the plugins installed into this profile, with live enable state. */
  listInstalled: () => Promise<MarketInstalledResult>
  /** Enable or disable one installed package (durable and immediate). */
  setInstalledEnabled: (packageName: string, enabled: boolean) => Promise<MarketInstalledResult>
  /** Uninstall one installed package (stops now, finishes on restart). */
  uninstallInstalled: (packageName: string) => Promise<MarketInstalledResult>
}

/** Full section props: runtime share + injected face + locale seat. */
export type MarketSectionProps =
  PropsRuntime<'settings.section'>
  & InjectFace<MarketSectionInjected>
  & PropsLocale<'settings.safeMarket'>

type CatalogState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly catalog: MarketCatalog; readonly stale: boolean }
  | { readonly status: 'error'; readonly message: string }

type CardState =
  | { readonly status: 'busy' }
  /** The Host's directory picker is open for this card. */
  | { readonly status: 'picking' }
  /** The install is one directory choice away; the card offers to make it. */
  | { readonly status: 'needs-workspace'; readonly message: string }
  | { readonly status: 'staged' }
  | { readonly status: 'error'; readonly message: string }

type Page = 'plugins' | 'skills'

/** `1998` → `2.0k`: a card has room for the magnitude, not the digits. */
function starCount(stars: number): string {
  if (stars < 1_000) return String(stars)
  return `${(stars / 1_000).toFixed(stars < 10_000 ? 1 : 0)}k`
}

/** Whether one row survives the current query and category filter. */
function matches(item: MarketPlugin, query: string, category: string, english: boolean): boolean {
  if (category !== '' && item.category !== category) return false
  if (query === '') return true
  const haystack = `${item.fullName} ${item.description} ${english ? item.categoryEn : item.categoryZh} ${item.language}`
    .toLocaleLowerCase()
  return query.split(/\s+/).every(word => haystack.includes(word))
}

/** The status a package row shows, from its own live facts. */
function stateOf(item: MarketInstalledPackage): 'readFailed' | 'disabled' | 'failed' | 'running' | 'installed' {
  if (item.error !== '') return 'readFailed'
  // A bundle whose patch declares no entry rows is neither running nor
  // stopped — installed, with nothing live to report.
  if (item.entries.length === 0) return 'installed'
  if (!item.enabled) return 'disabled'
  return item.entries.some(entry => entry.phase === 'failed') ? 'failed' : 'running'
}

type InstalledState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly result: MarketInstalledResult }
  | { readonly status: 'error'; readonly message: string }

/**
 * The category chip that selects the installed set instead of a catalog
 * category. The catalog's own keys are slugs from the shortlist, so a value
 * carrying a colon cannot collide with one.
 */
const INSTALLED_FILTER = 'dsh:installed'

/**
 * The installed set's own state and verbs: the plugins installed into this
 * profile, with enable/disable and uninstall. It is local profile facts all
 * the way down — reading them reaches nothing outside this machine, so this
 * answers with the market off too.
 *
 * A hook rather than a panel because the count belongs to the filter chip and
 * the rows belong to the same card grid the catalog uses: one list of cards,
 * one of whose filters happens to be "the ones I already have".
 */
function useInstalled({ t, active, listInstalled, setInstalledEnabled, uninstallInstalled }: {
  t: MarketLocale
  /**
   * Whether the panel is on screen at all. The read is local and cheap, but
   * with the market off there is nothing rendering it — and a read fired for
   * a panel nobody is looking at would report its failures into a page whose
   * only job is to explain the switch.
   */
  active: boolean
  listInstalled: MarketSectionInjected['listInstalled']
  setInstalledEnabled: MarketSectionInjected['setInstalledEnabled']
  uninstallInstalled: MarketSectionInjected['uninstallInstalled']
}): {
  state: InstalledState
  busy: string | null
  confirming: string | null
  notice: string
  actionError: string
  count: number
  reload: () => void
  toggle: (item: MarketInstalledPackage) => void
  uninstall: (item: MarketInstalledPackage) => void
  setConfirming: (name: string | null) => void
} {
  const [state, setState] = useState<InstalledState>({ status: 'loading' })
  // `${name}:toggle` / `${name}:uninstall`: one verb at a time.
  const [busy, setBusy] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const load = useCallback((): void => {
    if (!active) return
    setState(previous => (previous.status === 'ready' ? previous : { status: 'loading' }))
    void listInstalled().then((result) => {
      if (!mounted.current) return
      setState({ status: 'ready', result })
    }, (error: unknown) => {
      if (!mounted.current) return
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    })
  }, [active, listInstalled])

  // One read per mount, and one more the first time the market is switched
  // on: the list changes only through these verbs (or a `dsh plugin` command,
  // which needs a restart anyway) — a poll would add nothing but motion.
  useEffect(() => { load() }, [load])

  const describe = (error: unknown): string => error instanceof Error ? error.message : String(error)

  const toggle = (item: MarketInstalledPackage): void => {
    setBusy(`${item.packageName}:toggle`)
    setActionError('')
    // A new action retires the last outcome line, whatever it said.
    setNotice('')
    void setInstalledEnabled(item.packageName, !item.enabled).then((result) => {
      if (!mounted.current) return
      setBusy(null)
      setState({ status: 'ready', result })
    }, (error: unknown) => {
      if (!mounted.current) return
      setBusy(null)
      setActionError(t('installed.actionFailed', { reason: describe(error) }))
      // The durable half may have landed even when the live half reports a
      // failure — what the list says now is the truth to show.
      setState(previous => (previous.status === 'ready' ? { status: 'loading' } : previous))
      load()
    })
  }

  const uninstall = (item: MarketInstalledPackage): void => {
    setBusy(`${item.packageName}:uninstall`)
    setConfirming(null)
    setActionError('')
    setNotice('')
    void uninstallInstalled(item.packageName).then((result) => {
      if (!mounted.current) return
      setBusy(null)
      // The host may have an outcome line of its own (e.g. the in-session
      // stop failed and the plugin runs until the next restart) — prefer it
      // over the default success copy.
      setNotice(result.notice !== undefined && result.notice !== '' ? result.notice : t('installed.uninstalled', { name: item.packageName }))
      setState({ status: 'ready', result })
    }, (error: unknown) => {
      if (!mounted.current) return
      setBusy(null)
      setActionError(t('installed.actionFailed', { reason: describe(error) }))
      setState(previous => (previous.status === 'ready' ? { status: 'loading' } : previous))
      load()
    })
  }

  const reload = (): void => {
    setState({ status: 'loading' })
    setNotice('')
    setActionError('')
    load()
  }

  const count = state.status === 'ready' && state.result.error === '' ? state.result.packages.length : 0
  return { state, busy, confirming, notice, actionError, count, reload, toggle, uninstall, setConfirming }
}

/**
 * One installed package, in the same card the catalog rows use — so the grid
 * stays one grid and the eye does not have to re-learn the layout when the
 * filter changes.
 */
function InstalledCard({ t, item, installed }: {
  t: MarketLocale
  item: MarketInstalledPackage
  installed: ReturnType<typeof useInstalled>
}): ReactElement {
  const { busy, confirming, setConfirming, toggle, uninstall } = installed
  const busyRow = busy !== null && (busy === `${item.packageName}:toggle` || busy === `${item.packageName}:uninstall`)
  const stateLabels: Record<ReturnType<typeof stateOf>, string> = {
    running: t('installed.running'),
    disabled: t('installed.disabled'),
    failed: t('installed.failedState'),
    readFailed: t('installed.readFailedState'),
    installed: t('installed.installedState'),
  }
  return (
    <li className="dsh_market_card">
      <div className="dsh_market_head">
        <span className="dsh_market_name" title={item.packageName}>{shortName(item.packageName)}</span>
        <span className="dsh_market_installedState" data-state={stateOf(item)}>{stateLabels[stateOf(item)]}</span>
      </div>
      <p className="dsh_market_meta">
        {[
          item.self ? t('installed.self') : '',
          item.inBox ? t('installed.inBox') : '',
          item.version === '' ? '' : `v${item.version}`,
        ].filter(part => part !== '').join(' · ')}
        {/* The how-and-why of a desktop seat, folded behind a hint icon: it
            matters exactly once — when someone wonders what this row is —
            and as a standing paragraph it dwarfed the card it explains.
            Focusable, so the tooltip is reachable without a pointer. */}
        {item.inBox && (
          <span className="dsh_market_hint" tabIndex={0} aria-label={t('installed.inBoxNotice')}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <path d="M8 7.3v3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="8" cy="4.9" r="0.85" fill="currentColor" />
            </svg>
            <span className="dsh_market_hintTip" role="tooltip">{t('installed.inBoxNotice')}</span>
          </span>
        )}
      </p>
      {item.description !== '' && <p className="dsh_market_desc">{item.description}</p>}
      {item.error !== '' && <p className="dsh_market_cardError">{t('installed.readFailed', { reason: item.error })}</p>}
      {item.heldDown && item.entries.length > 0
        && <p className="dsh_market_cardNotice">{t('installed.heldDown')}</p>}
      <div className="dsh_market_foot">
        {confirming === item.packageName
          ? (
            <>
              <span className="dsh_market_cardNotice">{t('installed.confirmUninstall', { name: shortName(item.packageName) })}</span>
              <button
                type="button"
                className="dsh_market_danger"
                disabled={busyRow}
                onClick={() => { uninstall(item) }}
              >
                {busy === `${item.packageName}:uninstall` ? t('installed.uninstalling') : t('installed.confirm')}
              </button>
              <button
                type="button"
                className="dsh_market_ghost"
                disabled={busyRow}
                onClick={() => { setConfirming(null) }}
              >
                {t('installed.cancel')}
              </button>
            </>
            )
          : (
            <>
              {!item.self && (
                <button
                  type="button"
                  className="dsh_market_ghost"
                  disabled={busyRow || busy !== null || item.error !== '' || item.entries.length === 0}
                  onClick={() => { toggle(item) }}
                >
                  {busy === `${item.packageName}:toggle`
                    ? (item.enabled ? t('installed.disabling') : t('installed.enabling'))
                    : (item.enabled ? t('installed.disable') : t('installed.enable'))}
                </button>
              )}
              <button
                type="button"
                className="dsh_market_danger"
                disabled={busyRow || busy !== null}
                onClick={() => { setConfirming(item.packageName) }}
              >
                {t('installed.uninstall')}
              </button>
            </>
            )}
      </div>
    </li>
  )
}

/** The installed set as a card grid, with its own status lines above it. */
function InstalledCards({ t, installed }: {
  t: MarketLocale
  installed: ReturnType<typeof useInstalled>
}): ReactElement {
  const { state, notice, actionError, reload } = installed
  return (
    <>
      <p className="dsh_market_installedBody">{t('installed.body')}</p>
      {notice !== '' && <p className="dsh_market_installedNotice">{notice}</p>}
      {actionError !== '' && <p className="dsh_market_status" data-error="true">{actionError}</p>}
      {state.status === 'loading' && <p className="dsh_market_status">{t('installed.loading')}</p>}
      {state.status === 'error' && (
        <p className="dsh_market_status" data-error="true">
          {t('installed.failed', { reason: state.message })}
          <button type="button" className="dsh_market_ghost" onClick={reload}>{t('retry')}</button>
        </p>
      )}
      {state.status === 'ready' && state.result.error !== '' && (
        <p className="dsh_market_status" data-error="true">{t('installed.failed', { reason: state.result.error })}</p>
      )}
      {state.status === 'ready' && state.result.error === '' && state.result.packages.length === 0 && (
        <p className="dsh_market_status">{t('installed.empty')}</p>
      )}
      {state.status === 'ready' && state.result.packages.length > 0 && (
        <ul className="dsh_market_cards">
          {state.result.packages.map(item => (
            <InstalledCard key={item.packageName} t={t} item={item} installed={installed} />
          ))}
        </ul>
      )}
    </>
  )
}

/** The Plugins page. */
function PluginsPage({ t, english, snapshot, setEnabled, loadCatalog, listInstalled, setInstalledEnabled, uninstallInstalled, chooseWorkspace, workspaceReadiness, cards, installBusy, onInstall }: {
  t: MarketLocale
  english: boolean
  snapshot: SafeMarketSnapshot
  setEnabled: MarketSectionInjected['setEnabled']
  loadCatalog: MarketSectionInjected['loadCatalog']
  listInstalled: MarketSectionInjected['listInstalled']
  setInstalledEnabled: MarketSectionInjected['setInstalledEnabled']
  uninstallInstalled: MarketSectionInjected['uninstallInstalled']
  chooseWorkspace: MarketSectionInjected['chooseWorkspace']
  workspaceReadiness: MarketSectionInjected['workspaceReadiness']
  cards: Readonly<Record<string, CardState>>
  installBusy: boolean
  onInstall: (target: MarketPlugin, prompt: string, viaNewWorkspace: boolean) => void
}): ReactElement {
  const [state, setState] = useState<CatalogState>({ status: 'idle' })
  const [switching, setSwitching] = useState(false)
  // A force refresh from `ready` keeps showing the catalog, so the busy
  // answer is a separate flag rather than the `loading` status.
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const enabled = snapshot.value.enabled
  const installed = useInstalled({ t, active: enabled, listInstalled, setInstalledEnabled, uninstallInstalled })
  const installedSelected = category === INSTALLED_FILTER
  // Rebuilt only when the installed set itself changes — every enable,
  // disable and uninstall answers with the whole list, so the catalog's
  // "already installed" marks follow those verbs without a second read.
  // Above the market-off early return, where the rules of hooks need it.
  const ownedIndex = useMemo(
    () => ownedIndexOf(installed.state.status === 'ready' ? installed.state.result.packages : []),
    [installed.state],
  )
  // The notice's own state, kept apart from the cards': it can be answered
  // before any card has been clicked.
  const [choosing, setChoosing] = useState(false)
  const [chooseError, setChooseError] = useState('')
  // Read from the workspace domain's own store, so the notice clears itself
  // whether the workspace arrived from this button or from the sidebar.
  const readiness = useSyncExternalStore(workspaceReadiness.subscribe, workspaceReadiness.getSnapshot)
  // The section keeps this page mounted across tab switches (see
  // MarketSection), but the settings shell can still unmount the whole
  // section mid-read — the guard stops the late answer from touching state.
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const load = useCallback((force: boolean) => {
    setState(previous => (previous.status === 'ready' ? previous : { status: 'loading' }))
    if (force) setRefreshing(true)
    void loadCatalog(force).then((result) => {
      if (!mounted.current) return
      setRefreshing(false)
      if (result.catalog === null) {
        setState({ status: 'error', message: result.error })
        return
      }
      setState({ status: 'ready', catalog: result.catalog, stale: result.stale })
    }, (error: unknown) => {
      if (!mounted.current) return
      setRefreshing(false)
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    })
  }, [loadCatalog])

  // The first read happens when the market is switched on, not when the page
  // mounts: a disabled market must not reach the network at all.
  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle' })
      return
    }
    load(false)
  }, [enabled, load])

  const toggle = (next: boolean): void => {
    setSwitching(true)
    void setEnabled(next).finally(() => { setSwitching(false) })
  }

  if (!enabled) {
    // Off means off: the page is the switch and nothing else. The installed
    // set is local enough that showing it here would break no privacy promise
    // — but a marketplace the user has turned off should not still be running
    // a plugin manager in their settings, and a panel with no filter chips
    // above it read as a second, always-on feature rather than as part of the
    // market they had just declined.
    return (
      <div className="dsh_market_page">
        <div className="dsh_market_intro">
          <p className="dsh_market_introTitle">{t('intro.title')}</p>
          <p className="dsh_market_introBody">{t('intro.body')}</p>
          <p className="dsh_market_disclaimer">{t('intro.disclaimer')}</p>
          <div className="dsh_market_introActions">
            <button
              type="button"
              className="dsh_market_primary"
              disabled={switching}
              onClick={() => { toggle(true) }}
            >
              {switching ? t('intro.enabling') : t('intro.enable')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const catalog = state.status === 'ready' ? state.catalog : null
  const shown = catalog === null
    ? []
    : catalog.items
      .filter(item => matches(item, query.trim().toLocaleLowerCase(), category, english))
      // The All view answers "what the community uses", so it ranks by stars;
      // a category chip keeps the publisher's order, whose front rows are its
      // own picks. `filter` copies, so the sort cannot reorder the catalog
      // the other views read.
      .sort((a, b) => (category === '' ? b.stars - a.stars : 0))

  const pickWorkspace = (): void => {
    setChoosing(true)
    setChooseError('')
    void chooseWorkspace().then((outcome) => {
      if (!mounted.current) return
      setChoosing(false)
      // A cancelled picker leaves the notice exactly as it was: the user
      // declined, and there is nothing to report about it.
      if (!outcome.ok && outcome.reason === 'failed') {
        setChooseError(t('workspace.failed', { reason: outcome.message }))
      }
    }, (error: unknown) => {
      if (!mounted.current) return
      setChoosing(false)
      setChooseError(t('workspace.failed', { reason: error instanceof Error ? error.message : String(error) }))
    })
  }

  const runInstall = (item: MarketPlugin, viaNewWorkspace: boolean): void => {
    // The profile is what names the install command's target; until the Host
    // confirmed it, staging a prompt would write a command aimed at the
    // wrong deployment. The button is disabled in that state, and this
    // guard keeps the verb honest even if the click races the describe.
    const profile = snapshot.profile
    if (profile === null) return
    const owned = ownedBy(ownedIndex, item)
    const common = {
      url: item.url,
      profile,
      // The Host reduces defaultBranch to a safe pattern (falling back to
      // `main`), so the interpolated value can only be a branch name.
      branch: item.defaultBranch,
    }
    // Already installed: the hand-off is the same one, aimed at the newer
    // version. Whether one EXISTS is the agent's first task, not something
    // this card can know — the published catalog carries repository facts,
    // not release versions — so the prompt opens by asking it to establish
    // that and to stop if the answer is no.
    onInstall(item, owned === undefined
      ? t('prompt', common)
      : t('prompt.upgrade', { ...common, installed: describeInstalled(owned) }), viaNewWorkspace)
  }

  return (
    <div className="dsh_market_page">
      {/* Says the prerequisite out loud before a click runs into it, and
          offers the same one action the cards do. It does not block browsing:
          the shortlist is worth reading without a workspace. */}
      {readiness === 'none' && (
        <div className="dsh_market_notice">
          <p className="dsh_market_noticeBody">{t('workspace.needed')}</p>
          {chooseError !== '' && <p className="dsh_market_status" data-error="true">{chooseError}</p>}
          <button
            type="button"
            className="dsh_market_primary"
            disabled={choosing || installBusy}
            onClick={pickWorkspace}
          >
            {choosing ? t('workspace.choosing') : t('workspace.choose')}
          </button>
        </div>
      )}
      <div className="dsh_market_bar">
        <input
          className="dsh_market_search"
          type="search"
          spellCheck={false}
          placeholder={t('search')}
          value={query}
          onChange={(event) => { setQuery(event.target.value) }}
        />
        <button
          type="button"
          className="dsh_market_ghost"
          disabled={state.status === 'loading' || refreshing}
          onClick={() => { load(true) }}
        >
          {refreshing ? t('refreshing') : t('refresh')}
        </button>
        <button
          type="button"
          className="dsh_market_ghost"
          disabled={switching}
          onClick={() => { toggle(false) }}
        >
          {t('intro.disable')}
        </button>
      </div>

      {catalog !== null && (
        <div className="dsh_market_chips">
          <button
            type="button"
            className="dsh_market_chip"
            data-on={category === '' ? 'true' : 'false'}
            onClick={() => { setCategory('') }}
          >
            {`${t('all')} ${String(catalog.items.length)}`}
          </button>
          {/* The installed set is a filter over the same grid, not a panel of
              its own: "the ones I already have" is just another way to narrow
              the list, and it reads that way sitting among the categories. */}
          <button
            type="button"
            className="dsh_market_chip"
            data-on={installedSelected ? 'true' : 'false'}
            onClick={() => { setCategory(current => (current === INSTALLED_FILTER ? '' : INSTALLED_FILTER)) }}
          >
            {`${t('installed.chip')} ${String(installed.count)}`}
          </button>
          {catalog.categories.map(entry => (
            <button
              key={entry.key}
              type="button"
              className="dsh_market_chip"
              data-on={category === entry.key ? 'true' : 'false'}
              onClick={() => { setCategory(current => (current === entry.key ? '' : entry.key)) }}
            >
              {`${english ? entry.en : entry.zh} ${String(entry.count)}`}
            </button>
          ))}
        </div>
      )}

      {installedSelected
        ? <InstalledCards t={t} installed={installed} />
        : (
          <p className="dsh_market_status" data-error={state.status === 'error' ? 'true' : 'false'}>
            {state.status === 'error'
              ? (
                <>
                  {t('failed', { reason: state.message })}
                  <button type="button" className="dsh_market_ghost" onClick={() => { load(true) }}>{t('retry')}</button>
                </>
                )
              : catalog === null
                ? t('loading')
                : shown.length === 0
                  ? t('empty')
                  : t('summary', { shown: String(shown.length), total: String(catalog.items.length) })}
          </p>
          )}

      {snapshot.profile === null && catalog !== null && !installedSelected && (
        <p className="dsh_market_status">{t('install.profilePending')}</p>
      )}

      {!installedSelected && shown.length > 0 && (
        <ul className="dsh_market_cards">
          {shown.map((item) => {
            const card = cards[item.fullName]
            const owned = ownedBy(ownedIndex, item)
            return (
              <li key={item.fullName} className="dsh_market_card">
                <div className="dsh_market_head">
                  <span className="dsh_market_name" title={item.fullName}>{item.name}</span>
                  {/* Says "you already have this" where the eye lands first,
                      so the card's verb below is read as the upgrade it is.
                      The version is shown only in a shape that cannot carry a
                      line of its own into the layout. */}
                  {owned !== undefined && (
                    <span className="dsh_market_owned" title={owned.packageName}>
                      {isSafeVersion(owned.version)
                        ? t('installedHere', { version: owned.version })
                        : t('installedHereUnknown')}
                    </span>
                  )}
                  <span className="dsh_market_stars" title={`${String(item.stars)} ${t('stars')}`}>
                    {`★ ${starCount(item.stars)}`}
                  </span>
                </div>
                <p className="dsh_market_meta">
                  {[
                    english ? item.categoryEn : item.categoryZh,
                    item.owner,
                    item.language,
                    item.license,
                    item.pushedAt.slice(0, 10),
                  ].filter(part => part !== '').join(' · ')}
                </p>
                {item.description !== '' && <p className="dsh_market_desc">{item.description}</p>}
                {card?.status === 'staged'
                  ? (
                    <div className="dsh_market_staged">
                      <span className="dsh_market_stagedTitle">{t('staged')}</span>
                      <span className="dsh_market_stagedHint">{t('staged.hint')}</span>
                    </div>
                    )
                  : (
                    <div className="dsh_market_foot">
                      {card?.status === 'error' && <span className="dsh_market_cardError">{card.message}</span>}
                      {card?.status === 'needs-workspace' && <span className="dsh_market_cardNotice">{card.message}</span>}
                      {/* The href is rebuilt from owner/name on the Host, so this
                          link cannot carry a scheme the snapshot chose. */}
                      <a className="dsh_market_link" href={item.url} target="_blank" rel="noreferrer">{t('repo')}</a>
                      {/* One button, two spellings: with no workspace the click
                          picks a folder first and then goes on installing, so
                          the user's single "install this" still lands. */}
                      {card?.status === 'needs-workspace' || (readiness === 'none' && card === undefined)
                        ? (
                          <button
                            type="button"
                            className="dsh_market_install"
                            disabled={installBusy || snapshot.profile === null}
                            onClick={() => { runInstall(item, true) }}
                          >
                            {t('install.pickAndInstall')}
                          </button>
                          )
                        : (
                          <button
                            type="button"
                            className="dsh_market_install"
                            disabled={card?.status === 'busy' || card?.status === 'picking' || installBusy || snapshot.profile === null}
                            onClick={() => { runInstall(item, false) }}
                          >
                            {card?.status === 'picking'
                              ? t('install.picking')
                              : card?.status === 'busy'
                                ? t('installing')
                                : owned === undefined ? t('install') : t('upgrade')}
                          </button>
                          )}
                    </div>
                    )}
              </li>
            )
          })}
        </ul>
      )}

      {catalog !== null && !installedSelected && (
        <p className="dsh_market_note">
          {t('snapshot', { date: catalog.fetchedAt.slice(0, 10), scanned: String(catalog.scanned) })}
          {' · '}
          <a href="https://github.com/bruc3van/awesome-dsh-plugin" target="_blank" rel="noreferrer">{t('source')}</a>
          {state.status === 'ready' && state.stale ? ` · ${t('stale')}` : ''}
        </p>
      )}
    </div>
  )
}

/** The Marketplace section. */
export function MarketSection({
  useScope, setEnabled, loadCatalog, listSkills, install, installIntoNewWorkspace, chooseWorkspace, workspaceReadiness,
  listInstalled, setInstalledEnabled, uninstallInstalled, close, t,
}: MarketSectionProps): ReactElement {
  const snapshot = useScope(value => value)
  // The slot props carry a translate function, not a locale tag; the
  // dictionary names its own language so the category labels and the staged
  // prompt follow the same setting the rest of the copy does.
  const english = t('lang') === 'en'
  const [page, setPage] = useState<Page>('plugins')
  const [cards, setCards] = useState<Readonly<Record<string, CardState>>>({})
  const tabsId = useId()
  // Mirror of the card states for same-tick guards (the rendered copy lags a
  // frame behind), and a live flag so a hand-off that resolves after the
  // section unmounted stops touching state.
  const cardsRef = useRef<Readonly<Record<string, CardState>>>({})
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])
  // One install hand-off at a time: two cards clicked back to back must not
  // open two sessions and stage two drafts.
  const installBusy = Object.values(cards).some(card => card.status === 'busy' || card.status === 'picking')

  const report = (fullName: string, next: CardState): void => {
    cardsRef.current = { ...cardsRef.current, [fullName]: next }
    if (mounted.current) setCards(cardsRef.current)
  }

  const runInstall = (target: MarketPlugin, prompt: string, viaNewWorkspace: boolean): void => {
    if (Object.values(cardsRef.current).some(card => card.status === 'busy' || card.status === 'picking')) return
    report(target.fullName, { status: viaNewWorkspace ? 'picking' : 'busy' })
    const handOff = viaNewWorkspace ? installIntoNewWorkspace : install
    void handOff(target, prompt).then((outcome) => {
      if (outcome.ok) {
        report(target.fullName, { status: 'staged' })
        // The prompt is staged in a session the user cannot see from here.
        // Closing is the second half of the hand-off, not a courtesy.
        close()
        return
      }
      // Both of these leave the card one directory choice from installing, so
      // the card keeps the offer up rather than turning into an error the
      // user has to translate back into an action.
      if (outcome.reason === 'no-workspace' || outcome.reason === 'cancelled') {
        report(target.fullName, {
          status: 'needs-workspace',
          message: outcome.reason === 'cancelled' ? t('install.cancelled') : t('install.noWorkspace'),
        })
        return
      }
      const message = outcome.reason === 'not-ready'
        ? t('install.notReady')
        : t('install.failed', { reason: outcome.message })
      report(target.fullName, { status: 'error', message })
    }, (error: unknown) => {
      report(target.fullName, {
        status: 'error',
        message: t('install.failed', { reason: error instanceof Error ? error.message : String(error) }),
      })
    })
  }

  const pages: readonly { id: Page; label: string }[] = [
    { id: 'plugins', label: t('tab.plugins') },
    { id: 'skills', label: t('tab.skills') },
  ]

  return (
    <div className="dsh_market_section">
      {/* The market's own version, where it is legible without scrolling. The
          installed panel does carry a row for the in-box seat now, but that
          row is one card among many and only exists while the seat is listed
          — the header states which market this is, always. */}
      <h2 className="dsh_market_heading">
        {t('nav')}
        {isSafeVersion(snapshot.version) && <span className="dsh_market_selfVersion">{`v${snapshot.version}`}</span>}
      </h2>
      <div className="dsh_market_tabs" role="tablist" aria-label={t('tabs.aria')}>
        {pages.map(entry => (
          <button
            key={entry.id}
            id={`${tabsId}-tab-${entry.id}`}
            type="button"
            role="tab"
            className="dsh_market_tab"
            aria-selected={page === entry.id}
            aria-controls={`${tabsId}-panel-${entry.id}`}
            data-active={page === entry.id ? 'true' : undefined}
            tabIndex={page === entry.id ? 0 : -1}
            onClick={() => { setPage(entry.id) }}
          >
            {entry.label}
          </button>
        ))}
      </div>
      {/* The Plugins panel stays mounted across tab switches: unmounting it
          would drop the search/filter state and re-pull the catalog on every
          return. The Skills panel remounts per visit, so each visit re-reads
          the live skill list. */}
      <div
        id={`${tabsId}-panel-plugins`}
        role="tabpanel"
        aria-labelledby={`${tabsId}-tab-plugins`}
        hidden={page !== 'plugins'}
      >
        <PluginsPage
          t={t}
          english={english}
          snapshot={snapshot}
          setEnabled={setEnabled}
          loadCatalog={loadCatalog}
          listInstalled={listInstalled}
          setInstalledEnabled={setInstalledEnabled}
          uninstallInstalled={uninstallInstalled}
          chooseWorkspace={chooseWorkspace}
          workspaceReadiness={workspaceReadiness}
          cards={cards}
          installBusy={installBusy}
          onInstall={runInstall}
        />
      </div>
      {page === 'skills' && (
        <div
          id={`${tabsId}-panel-skills`}
          role="tabpanel"
          aria-labelledby={`${tabsId}-tab-skills`}
        >
          <SkillsView t={t} listSkills={listSkills} />
        </div>
      )}
    </div>
  )
}
