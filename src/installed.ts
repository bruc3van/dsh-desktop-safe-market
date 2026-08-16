/**
 * The installed-plugin manager: the host half of the market's "已安装" panel.
 *
 * It answers three verbs over the plugins a user installed into this profile
 * (the shipped template layers are the deployment itself and never listed):
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
 *   so the next boot's {@link InstalledManager.sweep} can take them back out
 *   of the user's file once the entries they target no longer exist.
 *
 * Nothing here spawns a process or touches the network: every effect is a
 * local file edit plus an in-process Loader call.
 */
import type { Entry, Loader } from '@deepseek-ai/cordis-plugin-loader'
import { join } from 'node:path'
import type {
  MarketInstalledEntry,
  MarketInstalledPackage,
  MarketInstalledResult,
} from './contract.ts'
import {
  PROFILE_PATCH_FILENAME,
  readBundleInfo,
  readManifest,
  removeBundle,
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
  /** Durable pending-uninstall record (the storage domain's seat). */
  readonly readPending: () => readonly PendingUninstall[]
  readonly writePending: (next: readonly PendingUninstall[]) => void
}

/** The manager face the Remote service delegates to. */
export interface InstalledManager {
  list(): Promise<MarketInstalledResult>
  setEnabled(packageName: string, enabled: boolean): Promise<MarketInstalledResult>
  uninstall(packageName: string): Promise<MarketInstalledResult>
  /** Take back disable rows of finished uninstalls; run once at plugin start. */
  sweep(): Promise<void>
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Create the manager over one profile directory.
 * @param options - profile identity, the live Loader, and the durable record seat.
 */
export function createInstalledManager(options: InstalledManagerOptions): InstalledManager {
  const profileDir = resolveProfileDir(options.profile, options.home)
  const patchPath = join(profileDir, PROFILE_PATCH_FILENAME)

  /** The live entry map, keyed by the ids the Loader reports (`include:<id>` for composed rows). */
  const liveEntries = (): Map<string, Entry> => {
    const map = new Map<string, Entry>()
    for (const entry of options.loader.entries()) map.set(entry.id, entry)
    return map
  }

  /** Composed rows carry the root include's prefix; accept the bare form too for other boot shapes. */
  const findLive = (map: Map<string, Entry>, id: string): Entry | undefined =>
    map.get(`include:${id}`) ?? map.get(id)

  const readUserBundles = async (): Promise<{ manifest: ProfileManifest; bundles: string[] }> => {
    const manifest = await readManifest(profileDir)
    return { manifest, bundles: userBundles(manifest) }
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
    try {
      ;({ bundles } = await readUserBundles())
    } catch (error) {
      return { packages: [], profile: options.profile, error: messageOf(error) }
    }
    const live = liveEntries()
    const packages: MarketInstalledPackage[] = []
    for (const packageName of bundles) {
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
          self,
          enabled: entries.some(entry => entry.enabled),
          entries,
          error: '',
        })
      } catch (error) {
        // A bundle whose package vanished from node_modules is still an
        // install fact: list it, say why it cannot be read, and let the user
        // uninstall the residue.
        packages.push({ packageName, version: '', description: '', self, enabled: false, entries: [], error: messageOf(error) })
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
    const { bundles } = await readUserBundles()
    assertInstalled(bundles, packageName)
    const info = await readBundleInfo(profileDir, packageName)
    const ids = info.entries.map(entry => entry.id)
    // Durable first: the patch row holds the state across boots even when the
    // live nudge below finds nothing to nudge (a launcher without the watcher
    // still converges at the next recompose or boot).
    await setEntryDisabled(patchPath, ids, !enabled)
    await applyLive(ids, enabled)
    return await list()
  }

  async function uninstall(packageName: string): Promise<MarketInstalledResult> {
    const { manifest, bundles } = await readUserBundles()
    assertInstalled(bundles, packageName)
    const self = packageName === options.selfName
    const info = await readBundleInfo(profileDir, packageName).catch(() => ({ version: '', description: '', entries: [] as { id: string; name: string }[] }))
    const ids = info.entries.map(entry => entry.id)
    if (!removeBundle(manifest, packageName)) {
      throw new Error(`${packageName} is listed as a bundle but nothing removable was found`)
    }
    // The manifest is the authoritative fact of an uninstall: once it is
    // written, the next boot never composes the bundle, so every later step
    // is a best-effort session nicety rather than something worth failing
    // the verb (and blocking a retry) over.
    await writeManifest(profileDir, manifest)
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
        console.warn('[dsh-desktop-safe-market] uninstall stop rows failed:', error)
      }
      if (rowsWritten) {
        const pending = options.readPending().filter(record => record.packageName !== packageName)
        options.writePending([...pending, { packageName, entryIds: ids, at: new Date().toISOString() }])
      }
      await applyLive(ids, false).catch(() => {
        // Stopping now is best-effort: the disable rows already hold the
        // entries down, and the manifest edit finishes the uninstall on boot.
      })
    }
    // Self-uninstall edits the manifest only: this fiber is the one answering
    // the call, and the bundle layer simply never composes on the next boot.
    return await list()
  }

  async function sweep(): Promise<void> {
    const pending = options.readPending()
    if (pending.length === 0) return
    try {
      // The record's whole job was bridging the uninstalling session: whether
      // the composition now lacks the entries (uninstall finished) or has
      // them again (reinstall — the rows would wrongly keep it down), the
      // rows come out and the record clears. A failed edit keeps the record
      // so the next boot retries.
      await setEntryDisabled(patchPath, [...new Set(pending.flatMap(record => [...record.entryIds]))], false)
      options.writePending([])
    } catch (error) {
      console.warn('[dsh-desktop-safe-market] uninstall sweep failed:', error)
    }
  }

  return {
    list,
    setEnabled: (packageName: string, enabled: boolean) => serialize(() => setEnabled(packageName, enabled)),
    uninstall: (packageName: string) => serialize(() => uninstall(packageName)),
    sweep,
  }
}
