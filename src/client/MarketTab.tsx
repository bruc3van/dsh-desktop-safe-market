/**
 * The Marketplace tab inside the Plugins settings section.
 *
 * Two states. While the market is off the tab is one card that says what
 * turning it on will do and asks; the switch is the plugin's own durable
 * setting, so the answer survives a restart. While it is on the tab is a
 * searchable, category-filtered shortlist, and each card's action stages a
 * security-review prompt in a new session — it installs nothing itself.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { MarketCatalog, MarketPlugin, SafeMarketSettings } from '../contract.ts'

/** The live settings snapshot the tab renders from. */
export interface SafeMarketSettingsSnapshot { readonly value: SafeMarketSettings }
export type SafeMarketSettingsSource = ObservableSnapshot<SafeMarketSettingsSnapshot>

/** What the install hand-off reports back to the card that asked for it. */
export type InstallOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'no-workspace' }
  | { readonly ok: false; readonly reason: 'failed'; readonly message: string }

/** Injected business face: the live settings source and the tab's verbs. */
export interface MarketTabInjected {
  hooks: { scope: SafeMarketSettingsSource }
  /** Turn the market on or off (durable). */
  setEnabled: (enabled: boolean) => Promise<void>
  /** Read the reduced catalog; `force` bypasses the refresh interval. */
  loadCatalog: (force: boolean) => Promise<{ catalog: MarketCatalog | null; stale: boolean; error: string }>
  /** Open a session in the current or most recent workspace and stage the given prompt. */
  install: (target: MarketPlugin, prompt: string) => Promise<InstallOutcome>
}

/** Full tab props: runtime share + injected face + locale seat. */
export type MarketTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & InjectFace<MarketTabInjected>
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

/** The Marketplace tab. */
export function MarketTab({ useScope, setEnabled, loadCatalog, install, t }: MarketTabProps): ReactElement {
  const settings = useScope(snapshot => snapshot.value)
  // The slot props carry a translate function, not a locale tag; the
  // dictionary names its own language so the category labels and the staged
  // prompt follow the same setting the rest of the copy does.
  const english = t('lang') === 'en'
  const [state, setState] = useState<CatalogState>({ status: 'idle' })
  const [switching, setSwitching] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [cards, setCards] = useState<Readonly<Record<string, CardState>>>({})

  const load = useCallback((force: boolean) => {
    setState(previous => (previous.status === 'ready' ? previous : { status: 'loading' }))
    void loadCatalog(force).then((result) => {
      if (result.catalog === null) {
        setState({ status: 'error', message: result.error })
        return
      }
      setState({ status: 'ready', catalog: result.catalog, stale: result.stale })
    }, (error: unknown) => {
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    })
  }, [loadCatalog])

  // The first read happens when the market is switched on, not when the tab
  // mounts: a disabled market must not reach the network at all.
  useEffect(() => {
    if (!settings.enabled) {
      setState({ status: 'idle' })
      return
    }
    load(false)
  }, [settings.enabled, load])

  const toggle = (next: boolean): void => {
    setSwitching(true)
    void setEnabled(next).finally(() => { setSwitching(false) })
  }

  if (!settings.enabled) {
    return (
      <div className="dsh_market_tab">
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
    setCards(previous => ({ ...previous, [item.fullName]: { status: 'busy' } }))
    void install(item, t('prompt', { url: item.url })).then((outcome) => {
      setCards(previous => ({
        ...previous,
        [item.fullName]: outcome.ok
          ? { status: 'staged' }
          : {
              status: 'error',
              message: outcome.reason === 'no-workspace'
                ? t('install.noWorkspace')
                : t('install.failed', { reason: outcome.message }),
            },
      }))
    }, (error: unknown) => {
      setCards(previous => ({
        ...previous,
        [item.fullName]: {
          status: 'error',
          message: t('install.failed', { reason: error instanceof Error ? error.message : String(error) }),
        },
      }))
    })
  }

  return (
    <div className="dsh_market_tab">
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
          disabled={state.status === 'loading'}
          onClick={() => { load(true) }}
        >
          {state.status === 'loading' ? t('refreshing') : t('refresh')}
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
                        disabled={card?.status === 'busy'}
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
