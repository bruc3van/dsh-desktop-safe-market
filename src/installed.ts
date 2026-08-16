/**
 * The installed-plugin manager: the host half of the market's "已安装" panel.
 *
 * It answers three verbs over the plugins a user installed into this profile,
 * plus the in-box seats the desktop client marked as its own. Shipped
 * template layers, and unmarked in-box bundles, are the deployment itself and
 * are never listed. A marked seat IS listed, because otherwise nothing could
 * remove it: the official CLI will not touch a name that is not a profile
 * dependency, and the client that seated it may be uninstalled by now.
 *
 * - **list** reads the profile manifest's user bundles, joins each bundle's
 *   patch-declared entry ids against the live Loader tree, and reports the
 *   package-level enable state the panel toggles.
 * - **setEnabled** writes (or removes) `disabled: true` rows in the profile's
 *   own patch layer — the durable seat the launcher recomposes from on every
 *   boot — and then nudges the live entries directly, so the change takes
 *   effect now even on a launcher without the patch-file watcher. The two
 *   paths are idempotent against each other: whichever lands second finds no
 *   diff left to apply.
 * - **uninstall** removes the bundle from the manifest (the next boot simply
 *   never composes it), stops its entries for the rest of this session with
 *   the same disable-row mechanism — which also keeps a mid-session
 *   patch-file recompose from reviving them — and records the rows it wrote
 *   (a small file seat under the harness home, independent of the storage
 *   domain) so the next boot's {@link InstalledManager.sweep} can take them
 *   back out of the user's file once the entries they target no longer
 *   exist.
 *
 * Nothing here spawns a process or touches the network: every effect is a
 * local file edit plus an in-process Loader call.
 */
import type { Entry, Loader } from '@deepseek-ai/cordis-plugin-loader'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type {
  MarketInstalledEntry,
  MarketInstalledPackage,
  MarketInstalledResult,
} from './contract.ts'
import {
  PROFILE_PATCH_FILENAME,
  atomicWrite,
  desktopSeatBundles,
  desktopSeatDir,
  readBundleInfo,
  readManifest,
  removeBundle,
  resolveDshHome,
  resolveProfileDir,
  setEntryDisabled,
  userBundles,
  writeManifest,
  type ProfileManifest,
} from './profile.ts'

/** Fiber state names, indexed by the cordis `FiberState` enum's numeric values. */
const FIBER_PHASE = ['pending', 'loading', 'active', 'failed', 'disposed', 'unloading'] as const

/** One uninstall the manager still has disable rows out for. */
export interface PendingUninstall {
  readonly packageName: string
  readonly entryIds: readonly string[]
  readonly at: string
}

/** The manager's construction facts. */
export interface InstalledManagerOptions {
  /** The profile name this Host booted (the market's `profile` config). */
  readonly profile: string
  /** This plugin's own package name: the one row the panel must not disable. */
  readonly selfName: string
  /** The live Loader (the `loader` service). */
  readonly loader: Loader
  /** Harness home override; defaults to the environment's resolution. */
  readonly home?: string
  /**
   * The pending-uninstall seat file: one small JSON array per profile under
   * the harness home (see {@link pendingFilePath}). A file, not the storage
   * domain, so the boot sweep still runs when the domain is unavailable —
   * losing the record is what strands stop rows in the user's patch file.
   */
  readonly pendingFile?: string
}

/** The manager face the Remote service delegates to. */
export interface InstalledManager {
  list(): Promise<MarketInstalledResult>
  setEnabled(packageName: string, enabled: boolean): Promise<MarketInstalledResult>
  uninstall(packageName: string): Promise<MarketInstalledResult>
  /** Take back disable rows of finished uninstalls; run once at plugin start. */
  sweep(): Promise<void>
  /**
   * Seed the file seat from a record an older version kept in the storage
   * domain (one-time migration). The file wins when it already holds
   * records; the caller then forgets the legacy field.
   */
  adoptPending(records: readonly PendingUninstall[]): Promise<void>
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** The harness-home directory holding every pending-uninstall seat. */
const PENDING_DIR = 'dsh-desktop-safe-market'

/**
 * The pending-uninstall seat for one profile: a small JSON file under the
 * harness home (`$DSH_HOME` or `~/.dsh`), owned by this plugin and per
 * profile — a sweep must only ever touch its own profile's rows. Profile
 * names are validated (no separators) before they reach this path.
 */
export function pendingFilePath(profile: string, home: string = resolveDshHome()): string {
  return join(home, PENDING_DIR, 'pending-' + profile + '.json')
}

/**
 * Read a pending-uninstall seat. A missing seat is an empty list; an
 * unreadable or corrupt one is too — but loudly, because a lost record is
 * what strands stop rows in the user's patch file (they then hold a
 * reinstall down until someone notices).
 */
async function readPendingFile(file: string): Promise<PendingUninstall[]> {
  let content: string
  try {
    content = await readFile(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    console.warn('[dsh-desktop-safe-market] pending-uninstall seat unreadable:', file, messageOf(error))
    return []
  }
  try {
    const parsed: unknown = JSON.parse(content)
    if (!Array.isArray(parsed)) throw new TypeError('seat does not hold an array')
    return parsed
      .filter(row => row !== null && typeof row === 'object' && !Array.isArray(row))
      .map(row => ({
        packageName: String((row as { packageName?: unknown }).packageName ?? ''),
        entryIds: (Array.isArray((row as { entryIds?: unknown }).entryIds) ? (row as { entryIds: unknown[] }).entryIds : [])
          .map(id => String(id)),
        at: String((row as { at?: unknown }).at ?? ''),
      }))
  } catch (error) {
    console.warn('[dsh-desktop-safe-market] pending-uninstall seat corrupt, treating as empty:', file, messageOf(error))
    return []
  }
}

/** Write a pending-uninstall seat (atomic, directory created on demand). */
async function writePendingFile(file: string, next: readonly PendingUninstall[]): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  await atomicWrite(file, JSON.stringify(next, undefined, 2) + '\n')
}

/**
 * Create the manager over one profile directory.
 * @param options - profile identity, the live Loader, and the durable record seat.
 */
export function createInstalledManager(options: InstalledManagerOptions): InstalledManager {
  const profileDir = resolveProfileDir(options.profile, options.home)
  const patchPath = join(profileDir, PROFILE_PATCH_FILENAME)
  const pendingPath = options.pendingFile ?? pendingFilePath(options.profile, options.home ?? resolveDshHome())
  const readPending = (): Promise<PendingUninstall[]> => readPendingFile(pendingPath)
  const writePending = (next: readonly PendingUninstall[]): Promise<void> => writePendingFile(pendingPath, next)

  /** The live entry map, keyed by the ids the Loader reports (`include:<id>` for composed rows). */
  const liveEntries = (): Map<string, Entry> => {
    const map = new Map<string, Entry>()
    for (const entry of options.loader.entries()) map.set(entry.id, entry)
    return map
  }

  /** Composed rows carry the root include's prefix; accept the bare form too for other boot shapes. */
  const findLive = (map: Map<string, Entry>, id: string): Entry | undefined =>
    map.get(`include:${id}`) ?? map.get(id)

  /**
   * What the panel manages: the packages installed as profile dependencies,
   * plus any in-box seat the desktop client marked as its own. The second
   * group is listed so it can be removed — nothing else can remove it, and
   * `seats` keeps it separate so the verbs know a seat has no dependency to
   * take away.
   */
  const readUserBundles = async (): Promise<{ manifest: ProfileManifest; bundles: string[]; seats: string[] }> => {
    const manifest = await readManifest(profileDir)
    return {
      manifest,
      bundles: userBundles(manifest),
      seats: desktopSeatBundles(manifest, profileDir),
    }
  }

  const assertInstalled = (bundles: readonly string[], packageName: string): void => {
    if (!bundles.includes(packageName)) {
      throw new Error(`${packageName} is not an installed plugin package of profile ${options.profile}`)
    }
  }

  // The mutating verbs read-modify-write two files (the manifest, the patch
  // layer). The panel serializes itself with its busy state, but two browser
  // tabs reach the same Remote, so the verbs serialize here too — a promise
  // chain, never a queue with its own failure semantics.
  let mutations: Promise<unknown> = Promise.resolve()
  const serialize = <T>(task: () => Promise<T>): Promise<T> => {
    const run = mutations.then(task, task)
    mutations = run.then(() => {}, () => {})
    return run
  }

  /** Apply the live half of a disable/enable, entry by entry, collecting failures. */
  const applyLive = async (ids: readonly string[], enabled: boolean): Promise<void> => {
    const live = liveEntries()
    const failures: string[] = []
    for (const id of ids) {
      const entry = findLive(live, id)
      if (entry === undefined) continue
      try {
        await entry.update({ disabled: enabled ? null : true })
      } catch (error) {
        failures.push(`${id}: ${messageOf(error)}`)
      }
    }
    if (failures.length > 0) throw new Error(failures.join('; '))
  }

  async function list(): Promise<MarketInstalledResult> {
    let bundles: string[]
    let seats: string[]
    try {
      ;({ bundles, seats } = await readUserBundles())
    } catch (error) {
      return { packages: [], profile: options.profile, error: messageOf(error) }
    }
    // A record for a package that is back in the manifest means a same-session
    // uninstall's stop rows are still holding it down (the boot sweep has not
    // run yet): surface it so the panel can explain the disabled state.
    const pending = await readPending()
    const heldDown = (packageName: string): boolean =>
      pending.some(record => record.packageName === packageName && record.entryIds.length > 0)
    const live = liveEntries()
    const packages: MarketInstalledPackage[] = []
    for (const packageName of [...bundles, ...seats]) {
      const inBox = seats.includes(packageName)
      const self = packageName === options.selfName
      try {
        const info = await readBundleInfo(profileDir, packageName)
        const entries: MarketInstalledEntry[] = info.entries.map(({ id, name }) => {
          const entry = findLive(live, id)
          return {
            id,
            name,
            present: entry !== undefined,
            enabled: entry !== undefined && !entry.disabled,
            phase: entry?.fiber === undefined ? null : (FIBER_PHASE[entry.fiber.state] ?? null),
          }
        })
        packages.push({
          packageName,
          version: info.version,
          description: info.description,
          repository: info.repository,
          self,
          inBox,
          enabled: entries.some(entry => entry.enabled),
          entries,
          error: '',
          heldDown: heldDown(packageName),
        })
      } catch (error) {
        // A bundle whose package vanished from node_modules is still an
        // install fact: list it, say why it cannot be read, and let the user
        // uninstall the residue.
        packages.push({ packageName, version: '', description: '', repository: '', self, inBox, enabled: false, entries: [], error: messageOf(error), heldDown: heldDown(packageName) })
      }
    }
    return { packages, profile: options.profile, error: '' }
  }

  async function setEnabled(packageName: string, enabled: boolean): Promise<MarketInstalledResult> {
    if (packageName === options.selfName) {
      // Disabling the market from inside the market is a one-way door: the
      // panel that would re-enable it goes down with the plugin.
      throw new Error('the marketplace cannot disable itself from its own panel')
    }
    // Seats count as installed here. Their entries are ordinary loader rows,
    // and the disable mechanism is the profile's own patch layer — neither
    // cares how the package arrived. Accepting only dependencies would leave
    // the panel showing a switch the Host refuses, which is worse than either
    // offering it or hiding it.
    const { bundles, seats } = await readUserBundles()
    assertInstalled([...bundles, ...seats], packageName)
    const info = await readBundleInfo(profileDir, packageName)
    const ids = info.entries.map(entry => entry.id)
    // Durable first: the patch row holds the state across boots even when the
    // live nudge below finds nothing to nudge (a launcher without the watcher
    // still converges at the next recompose or boot).
    await setEntryDisabled(patchPath, ids, !enabled)
    await applyLive(ids, enabled)
    // Whatever rows the patch layer now carries say what the user just asked
    // for, so a same-session uninstall's stop rows for this package are no
    // longer ours: an enable removed them, a deliberate disable is the user's
    // own and the boot sweep must not take it back. Drop the record. (A
    // failure here fails the verb: leaving the record would let the next
    // boot's sweep undo a disable the user just asked for, and the retry is
    // idempotent — the rows and the live nudge have already landed.)
    await writePending((await readPending()).filter(record => record.packageName !== packageName))
    return await list()
  }

  async function uninstall(packageName: string): Promise<MarketInstalledResult> {
    const { manifest, bundles, seats } = await readUserBundles()
    const inBox = seats.includes(packageName)
    assertInstalled(inBox ? seats : bundles, packageName)
    // An in-box seat has no dependency to drop and no pnpm-managed tree to
    // leave behind: the directory IS the install, and it was put there by a
    // client that may no longer exist to take it back. Removing the files is
    // therefore part of the uninstall, not litter for someone else to sweep.
    const seatDir = inBox ? desktopSeatDir(profileDir, packageName) : undefined
    const self = packageName === options.selfName
    const info = await readBundleInfo(profileDir, packageName).catch(() => ({ version: '', description: '', repository: '', entries: [] as { id: string; name: string }[] }))
    const ids = info.entries.map(entry => entry.id)
    if (!removeBundle(manifest, packageName)) {
      throw new Error(`${packageName} is listed as a bundle but nothing removable was found`)
    }
    // The manifest is the authoritative fact of an uninstall: once it is
    // written, the next boot never composes the bundle, so every later step
    // is a best-effort session nicety rather than something worth failing
    // the verb (and blocking a retry) over. But "best-effort" is not
    // "silent": a stop that cannot land means the plugin keeps running this
    // session, and a plugin whose selling point is review-before-install
    // should say so — the result notice carries every fault.
    await writeManifest(profileDir, manifest)
    const stopFaults: string[] = []
    if (!self && ids.length > 0) {
      // Stop the entries for the rest of this session and keep them stopped
      // across mid-session recomposes (the bundle's insert rows stay in the
      // booted layer stack until the next boot). The rows are ours: the next
      // boot's sweep takes them back once the composition no longer carries
      // the entries they target — so the sweep record is written only when
      // the rows actually landed.
      let rowsWritten = false
      try {
        await setEntryDisabled(patchPath, ids, true)
        rowsWritten = true
      } catch (error) {
        stopFaults.push('stop rows: ' + messageOf(error))
        console.warn('[dsh-desktop-safe-market] uninstall stop rows failed:', error)
      }
      if (rowsWritten) {
        try {
          const pending = (await readPending()).filter(record => record.packageName !== packageName)
          await writePending([...pending, { packageName, entryIds: ids, at: new Date().toISOString() }])
        } catch (error) {
          // Orphan rows — a record the boot sweep can never find — would hold
          // a reinstall down forever; the notice names the fault.
          stopFaults.push('sweep record: ' + messageOf(error))
          console.warn('[dsh-desktop-safe-market] uninstall sweep record failed:', error)
        }
      }
      try {
        await applyLive(ids, false)
      } catch (error) {
        // Stopping now is best-effort: the disable rows already hold the
        // entries down, and the manifest edit finishes the uninstall on boot.
        stopFaults.push('live stop: ' + messageOf(error))
      }
    }
    if (seatDir !== undefined) {
      try {
        await rm(seatDir, { recursive: true, force: true })
      } catch (error) {
        // The manifest edit already finished the uninstall; a directory left
        // behind is inert (nothing lists it) but it is still ours to name.
        stopFaults.push('seat directory: ' + messageOf(error))
      }
    }
    // Self-uninstall skips the STOP rows — this fiber is the one answering the
    // call, and the bundle layer simply never composes on the next boot. It
    // does not skip removing the copy: for a seat the directory IS the
    // install, and leaving it behind after taking the name out of `bundles`
    // would strand a plugin tree that nothing lists, nothing loads, and
    // nothing can offer to remove ever again (the panel finds seats through
    // the bundle list). Deleting the running plugin's own directory is safe:
    // its modules are resolved and cached in memory by the time this runs.
    const result = await list()
    if (stopFaults.length === 0) return result
    return {
      ...result,
      notice: packageName + ' is removed from the profile but may keep running until the next restart (' + stopFaults.join('; ') + ')',
    }
  }

  async function sweep(): Promise<void> {
    // The seat is a file precisely so a broken storage domain cannot strand
    // the rows; readPendingFile itself never rejects (it degrades to [] with
    // a warning), and a failed edit keeps the record for the next boot.
    const pending = await readPending()
    if (pending.length === 0) return
    try {
      // The record's whole job was bridging the uninstalling session: whether
      // the composition now lacks the entries (uninstall finished) or has
      // them again (reinstall — the rows would wrongly keep it down), the
      // rows come out and the record clears.
      await setEntryDisabled(patchPath, [...new Set(pending.flatMap(record => [...record.entryIds]))], false)
      await writePending([])
    } catch (error) {
      console.warn('[dsh-desktop-safe-market] uninstall sweep failed:', error)
    }
  }

  async function adoptPending(records: readonly PendingUninstall[]): Promise<void> {
    if (records.length === 0) return
    // The file wins: a seat that already holds records was written by the
    // current build, and the domain copy is older.
    if ((await readPending()).length > 0) return
    await writePending(records)
  }

  return {
    list,
    setEnabled: (packageName: string, enabled: boolean) => serialize(() => setEnabled(packageName, enabled)),
    uninstall: (packageName: string) => serialize(() => uninstall(packageName)),
    sweep,
    adoptPending,
  }
}
