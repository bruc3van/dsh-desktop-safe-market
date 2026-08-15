/**
 * The catalog source: the community snapshot published by awesome-dsh-plugin,
 * reduced on the Host to a balanced top 100.
 *
 * The snapshot lives in two files. `repositories.json` is the machine-readable
 * daily crawl (every repository carrying the `dsh-plugin` topic, with its
 * assigned category already applied); `curated.json` carries the human
 * judgement the crawl cannot make — which entries are not plugins at all
 * (competing catalog sites, product repos whose stars belong to something
 * else). The crawl does NOT have those exclusions applied, so a client that
 * read only the first file would put a rival catalog at the top of its own
 * market. Both are therefore read together, and the reduction happens here
 * rather than in the browser: the client receives 100 rows, not 2.4 MB.
 */
import type { MarketCatalog, MarketCategory, MarketPlugin } from './contract.ts'
import { isSafeBranchName, REPOSITORY_SLUG_PATTERN } from './contract.ts'

/** A snapshot is refreshed daily upstream; asking more often than this is noise. */
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1_000

const FETCH_TIMEOUT_MS = 20_000

/** A description longer than this is a README pasted into the field, not a summary. */
const DESCRIPTION_LIMIT = 300

/**
 * Repositories the market never lists even though the crawl and the curation
 * both keep them: this plugin, the desktop client it is named for, and the
 * catalog that feeds this view. None is a plugin a session can install.
 */
const SELF_EXCLUDED = new Set([
  'bruc3van/dsh-desktop',
  'bruc3van/dsh-desktop-safe-market',
  'bruc3van/awesome-dsh-plugin',
])

interface RawRepository {
  default_branch?: unknown
  full_name?: unknown
  description?: unknown
  category?: unknown
  category_zh?: unknown
  category_en?: unknown
  language?: unknown
  stargazers_count?: unknown
  license?: unknown
  archived?: unknown
  disabled?: unknown
  pushed_at?: unknown
}

/**
 * Where a reduction survives a restart. The catalog source neither opens nor
 * closes this — the plugin body owns the domain's lifecycle and hands the
 * source a narrow port, so a deployment without durable storage can still run
 * the market from memory alone.
 */
export interface CatalogCache {
  /** The last reduction and the ETags it was derived with. */
  read: () => { catalog: MarketCatalog | null; repositoriesEtag: string; curatedEtag: string }
  /** Persist a fresh reduction. Failures are the cache's own business. */
  write: (next: { catalog: MarketCatalog; repositoriesEtag: string; curatedEtag: string }) => void
}

/** Deployment-varying knobs the plugin config owns. */
export interface CatalogOptions {
  /** Base URL holding `repositories.json` and `curated.json`. */
  readonly base: string
  /** How many plugins the market shows. */
  readonly marketSize: number
  /** Durable seat for the reduction; absent means memory-only. */
  readonly cache?: CatalogCache
}

function text(value: unknown, limit: number): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.replace(/\s+/g, ' ').trim()
  // Cut by code point, not by UTF-16 unit, so a limit landing inside a
  // surrogate pair cannot leave a lone half behind.
  const points = [...trimmed]
  return points.length > limit ? `${points.slice(0, limit - 1).join('')}…` : trimmed
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
}

/** `owner/name` with nothing else in it — the only shape a link is built from. */
function repositorySlug(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return REPOSITORY_SLUG_PATTERN.test(value) ? value : null
}

/**
 * The branch the prompt's tarball fallback names. Remote text from a public
 * snapshot: anything outside the safe pattern (which excludes whitespace and
 * every prompt-injection character) falls back to `main` rather than being
 * interpolated into the review prompt.
 */
function branchName(value: unknown): string {
  if (typeof value !== 'string') return 'main'
  const trimmed = text(value, 100)
  return trimmed !== '' && isSafeBranchName(trimmed) ? trimmed : 'main'
}

/**
 * The market's selection rule. A straight star ranking would hand almost every
 * seat to two or three categories — the crawl's biggest bucket alone holds
 * about a third of the ecosystem — and the point of this view is to answer
 * "what can DSH do", not "what has the most stars". So each category is sorted
 * by stars and the seats are dealt round by round: every category places its
 * best entry before any category places its second. The result is then ordered
 * by stars for display, so the list still reads as a leaderboard.
 * @param pool - every kept row, already sorted by stars descending.
 * @param marketSize - how many seats to deal.
 * @returns the dealt rows, ordered by stars descending.
 */
export function selectBalanced(pool: readonly MarketPlugin[], marketSize: number): MarketPlugin[] {
  const buckets = new Map<string, MarketPlugin[]>()
  for (const item of pool) {
    const bucket = buckets.get(item.category)
    if (bucket === undefined) buckets.set(item.category, [item])
    else bucket.push(item)
  }
  // Deal in a stable order: the category whose best entry is strongest goes
  // first each round, so the very top of the list is never an accident of
  // map insertion order.
  const best = (bucket: readonly MarketPlugin[]): number => bucket[0]?.stars ?? 0
  const order = [...buckets.values()].sort((a, b) => best(b) - best(a))
  const picked: MarketPlugin[] = []
  for (let round = 0; picked.length < marketSize; round += 1) {
    let dealt = false
    for (const bucket of order) {
      const item = bucket[round]
      if (item === undefined) continue
      picked.push(item)
      dealt = true
      if (picked.length >= marketSize) break
    }
    if (!dealt) break
  }
  return picked.sort((a, b) => b.stars - a.stars)
}

/**
 * Reduce one crawl plus its curation into the catalog the browser renders.
 * @param repositoriesJson - the parsed `repositories.json` snapshot.
 * @param curatedJson - the parsed `curated.json` curation.
 * @param marketSize - how many rows the market shows.
 * @returns the reduced catalog.
 */
export function deriveCatalog(
  repositoriesJson: unknown,
  curatedJson: unknown,
  marketSize: number,
): MarketCatalog {
  const snapshot = repositoriesJson as { repositories?: unknown; fetched_at?: unknown; total_count?: unknown }
  const rows = Array.isArray(snapshot.repositories) ? snapshot.repositories as RawRepository[] : []
  if (rows.length === 0) throw new Error('the catalog snapshot carried no repositories')

  const curated = curatedJson as { excluded_repos?: unknown; leaderboard_exclusions?: unknown }
  const excluded = new Set(SELF_EXCLUDED)
  for (const key of ['excluded_repos', 'leaderboard_exclusions'] as const) {
    const map = curated[key]
    if (typeof map !== 'object' || map === null) continue
    for (const name of Object.keys(map)) excluded.add(name)
  }

  const pool: MarketPlugin[] = []
  for (const row of rows) {
    const fullName = repositorySlug(row.full_name)
    if (fullName === null || excluded.has(fullName)) continue
    if (row.archived === true || row.disabled === true) continue
    const category = text(row.category, 60)
    if (category === '') continue
    const slash = fullName.indexOf('/')
    pool.push({
      fullName,
      owner: fullName.slice(0, slash),
      name: fullName.slice(slash + 1),
      url: `https://github.com/${fullName}`,
      description: text(row.description, DESCRIPTION_LIMIT),
      stars: count(row.stargazers_count),
      language: text(row.language, 40),
      license: text(row.license, 40),
      pushedAt: text(row.pushed_at, 30),
      defaultBranch: branchName(row.default_branch),
      category,
      categoryZh: text(row.category_zh, 60) || category,
      categoryEn: text(row.category_en, 60) || category,
    })
  }
  pool.sort((a, b) => b.stars - a.stars)

  const items = selectBalanced(pool, marketSize)
  const categories: MarketCategory[] = []
  for (const item of items) {
    const seen = categories.find(entry => entry.key === item.category)
    if (seen === undefined) categories.push({ key: item.category, zh: item.categoryZh, en: item.categoryEn, count: 1 })
    else (seen as { count: number }).count += 1
  }
  categories.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))

  return {
    items,
    categories,
    fetchedAt: text(snapshot.fetched_at, 40),
    refreshedAt: new Date().toISOString(),
    scanned: count(snapshot.total_count) || rows.length,
  }
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message === '' ? 'unknown error' : error.message
  const value = String(error)
  return value === '' ? 'unknown error' : value
}

/** The catalog reader: memory first, then the network. */
export interface CatalogSource {
  /**
   * Read the catalog.
   * @param force - bypass the refresh interval (a user gesture, not a poll).
   * @param signal - caller lifetime.
   */
  read: (force: boolean, signal?: AbortSignal) => Promise<{ catalog: MarketCatalog | null; stale: boolean; error: string }>
}

/**
 * Build the catalog reader.
 * @param options - the base URL, the market size, and the durable seat.
 * @returns the reader.
 */
export function createCatalogSource(options: CatalogOptions): CatalogSource {
  const base = options.base.replace(/\/+$/, '')
  // The durable seat is NOT seeded at construction time. The plugin body
  // hands the source a cache port whose backing domain opens asynchronously
  // after this constructor returns, so reading it here would always see the
  // initial (empty) state and a restart would pay a full download instead of
  // two 304s. The seed is instead pulled lazily, on the first read — by then
  // the domain is open, and the port answers from the state the effect
  // adopted. Reading it again whenever the closure is still empty also
  // covers the rare read that wins the race against the domain opening.
  let catalog: MarketCatalog | null = null
  let repositoriesEtag = ''
  let curatedEtag = ''
  const seedFromCache = (): void => {
    if (catalog !== null) return
    const cached = options.cache?.read()
    if (cached === undefined || cached.catalog === null) return
    catalog = cached.catalog
    repositoriesEtag = cached.repositoriesEtag
    curatedEtag = cached.curatedEtag
  }
  let inFlight: Promise<{ catalog: MarketCatalog | null; stale: boolean; error: string }> | null = null

  const fresh = (): boolean => {
    if (catalog === null) return false
    const at = Date.parse(catalog.refreshedAt)
    return Number.isFinite(at) && Date.now() - at < REFRESH_INTERVAL_MS
  }

  const refresh = async (signal: AbortSignal): Promise<{ catalog: MarketCatalog | null; stale: boolean; error: string }> => {
    const repositoriesUrl = `${base}/repositories.json`
    const curatedUrl = `${base}/curated.json`
    // Conditional first: the crawl is 2.4 MB and moves once a day, so most
    // reads should cost two 304s. Either file moving invalidates the
    // reduction — the curation decides who is dropped — so a single change
    // re-reads both.
    if (catalog !== null && repositoriesEtag !== '' && curatedEtag !== '') {
      const [repositories, curatedResponse] = await Promise.all([
        fetch(repositoriesUrl, { signal, headers: { 'if-none-match': repositoriesEtag } }),
        fetch(curatedUrl, { signal, headers: { 'if-none-match': curatedEtag } }),
      ])
      if (repositories.status === 304 && curatedResponse.status === 304) {
        catalog = { ...catalog, refreshedAt: new Date().toISOString() }
        options.cache?.write({ catalog, repositoriesEtag, curatedEtag })
        return { catalog, stale: false, error: '' }
      }
    }

    const [repositories, curatedResponse] = await Promise.all([
      fetch(repositoriesUrl, { signal }),
      fetch(curatedUrl, { signal }),
    ])
    if (!repositories.ok) throw new Error(`catalog HTTP ${String(repositories.status)}`)
    if (!curatedResponse.ok) throw new Error(`curation HTTP ${String(curatedResponse.status)}`)
    catalog = deriveCatalog(await repositories.json(), await curatedResponse.json(), options.marketSize)
    repositoriesEtag = repositories.headers.get('etag') ?? ''
    curatedEtag = curatedResponse.headers.get('etag') ?? ''
    options.cache?.write({ catalog, repositoriesEtag, curatedEtag })
    return { catalog, stale: false, error: '' }
  }

  return {
    read: async (force, signal) => {
      seedFromCache()
      // A caller that arrives already aborted must not start the network
      // read its answer would have needed.
      if (signal?.aborted) throw signal.reason ?? new Error('This operation was aborted')
      if (!force && fresh() && catalog !== null) return { catalog, stale: false, error: '' }
      // One network read at a time: the tab can be reopened while the first
      // is still running, and two 2.4 MB downloads answer the same question.
      // The shared request is bound to the fetch timeout only — caller
      // lifetimes never abort it, because the abort of one caller must not
      // hand every other caller a dead answer. A caller that aborts stops
      // waiting for its own copy of the result; the read itself finishes and
      // serves whoever is still listening. `force` against an already
      // running read merges into it (that read IS the fresh download force
      // asked for), so no force gesture is dropped or duplicated.
      const pending = (inFlight ??= (async () => {
        const lifetime = AbortSignal.timeout(FETCH_TIMEOUT_MS)
        try {
          return await refresh(lifetime)
        } catch (error) {
          // A snapshot already in memory still answers the question; the
          // browser is told the answer is old rather than shown a blank tab.
          const message = errorText(error)
          if (catalog !== null) return { catalog, stale: true, error: message }
          return { catalog: null, stale: false, error: message }
        } finally {
          inFlight = null
        }
      })())
      if (signal === undefined) return await pending
      // This caller's abort resolves its wait as a cancellation; the shared
      // read is untouched and stays in flight for the other callers.
      let abort: (() => void) | undefined
      const aborted = new Promise<never>((_, reject) => {
        abort = (): void => { reject(signal.reason ?? new Error('This operation was aborted')) }
        signal.addEventListener('abort', abort, { once: true })
      })
      try {
        return await Promise.race([pending, aborted])
      } finally {
        if (abort !== undefined) signal.removeEventListener('abort', abort)
      }
    },
  }
}
