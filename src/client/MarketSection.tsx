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
import { useCallback, useEffect, useId, useRef, useState, type ReactElement } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  MarketCatalog,
  MarketPlugin,
  MarketSkillsResult,
  SafeMarketSettings,
} from '../contract.ts'
import type { MarketLocale } from './copy.ts'
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
}
export type SafeMarketSource = ObservableSnapshot<SafeMarketSnapshot>

/** What the install hand-off reports back to the card that asked for it. */
export type InstallOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'not-ready' }
  | { readonly ok: false; readonly reason: 'no-workspace' }
  | { readonly ok: false; readonly reason: 'failed'; readonly message: string }

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

/** The Plugins page. */
function PluginsPage({ t, english, snapshot, setEnabled, loadCatalog, cards, installBusy, onInstall }: {
  t: MarketLocale
  english: boolean
  snapshot: SafeMarketSnapshot
  setEnabled: MarketSectionInjected['setEnabled']
  loadCatalog: MarketSectionInjected['loadCatalog']
  cards: Readonly<Record<string, CardState>>
  installBusy: boolean
  onInstall: (target: MarketPlugin, prompt: string) => void
}): ReactElement {
  const [state, setState] = useState<CatalogState>({ status: 'idle' })
  const [switching, setSwitching] = useState(false)
  // A force refresh from `ready` keeps showing the catalog, so the busy
  // answer is a separate flag rather than the `loading` status.
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const enabled = snapshot.value.enabled
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
    : catalog.items.filter(item => matches(item, query.trim().toLocaleLowerCase(), category, english))

  const runInstall = (item: MarketPlugin): void => {
    // The profile is what names the install command's target; until the Host
    // confirmed it, staging a prompt would write a command aimed at the
    // wrong deployment. The button is disabled in that state, and this
    // guard keeps the verb honest even if the click races the describe.
    const profile = snapshot.profile
    if (profile === null) return
    onInstall(item, t('prompt', {
      url: item.url,
      profile,
      // The Host reduces defaultBranch to a safe pattern (falling back to
      // `main`), so the interpolated value can only be a branch name.
      branch: item.defaultBranch,
    }))
  }

  return (
    <div className="dsh_market_page">
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

      {snapshot.profile === null && catalog !== null && (
        <p className="dsh_market_status">{t('install.profilePending')}</p>
      )}

      {shown.length > 0 && (
        <ul className="dsh_market_cards">
          {shown.map((item) => {
            const card = cards[item.fullName]
            return (
              <li key={item.fullName} className="dsh_market_card">
                <div className="dsh_market_head">
                  <span className="dsh_market_name" title={item.fullName}>{item.name}</span>
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
                      {/* The href is rebuilt from owner/name on the Host, so this
                          link cannot carry a scheme the snapshot chose. */}
                      <a className="dsh_market_link" href={item.url} target="_blank" rel="noreferrer">{t('repo')}</a>
                      <button
                        type="button"
                        className="dsh_market_install"
                        disabled={card?.status === 'busy' || installBusy || snapshot.profile === null}
                        onClick={() => { runInstall(item) }}
                      >
                        {card?.status === 'busy' ? t('installing') : t('install')}
                      </button>
                    </div>
                    )}
              </li>
            )
          })}
        </ul>
      )}

      {catalog !== null && (
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
  useScope, setEnabled, loadCatalog, listSkills, install, close, t,
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
  const installBusy = Object.values(cards).some(card => card.status === 'busy')

  const report = (fullName: string, next: CardState): void => {
    cardsRef.current = { ...cardsRef.current, [fullName]: next }
    if (mounted.current) setCards(cardsRef.current)
  }

  const runInstall = (target: MarketPlugin, prompt: string): void => {
    if (Object.values(cardsRef.current).some(card => card.status === 'busy')) return
    report(target.fullName, { status: 'busy' })
    void install(target, prompt).then((outcome) => {
      if (outcome.ok) {
        report(target.fullName, { status: 'staged' })
        // The prompt is staged in a session the user cannot see from here.
        // Closing is the second half of the hand-off, not a courtesy.
        close()
        return
      }
      const message = outcome.reason === 'not-ready'
        ? t('install.notReady')
        : outcome.reason === 'no-workspace'
          ? t('install.noWorkspace')
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
      <h2 className="dsh_market_heading">{t('nav')}</h2>
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
