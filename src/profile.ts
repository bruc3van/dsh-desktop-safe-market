/**
 * The profile layer the installed-plugin manager reads and edits.
 *
 * A dsh profile is a directory under `$DSH_HOME/profiles/<name>` (default home
 * `~/.dsh`) holding a `package.json` — whose `dsh.profile.bundles` lists the
 * plugin bundle layers in composition order — and a `cordis.patch.yml`, the
 * user's own patch layer applied AFTER every bundle layer and hot-reloaded by
 * the launcher. That makes the user patch file the durable seat for a runtime
 * disable: a `- id: <entryId>` / `disabled: true` row stops the entry now
 * (the launcher's watcher recomposes the tree on save) and keeps stopping it
 * on every later boot, all without touching files the installation owns.
 *
 * The file is the user's own, comments and `!!js` expressions included, so
 * edits go through a CST-preserving yaml Document: rows the manager did not
 * touch keep their original text byte for byte. The one exception is a
 * `!!js` scalar the serializer cannot keep in its original spelling — it
 * re-emits quoted, which parses back to the same expression node the Loader
 * expects (the tests assert the semantic round-trip).
 */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { isMap, isScalar, isSeq, parse, parseDocument, type ScalarTag } from 'yaml'

/** Environment variable overriding the default harness home. */
export const DSH_HOME_ENV = 'DSH_HOME'

/** Directory under the harness home holding every profile. */
export const PROFILES_DIR = 'profiles'

/** The user patch layer inside a profile directory. */
export const PROFILE_PATCH_FILENAME = 'cordis.patch.yml'

/**
 * Bundle layers every shipped profile template carries. Anything else in
 * `dsh.profile.bundles` arrived by user install (`dsh plugin add`), which is
 * the set the manager lists and may edit; the shipped layers are the
 * deployment itself and stay out of it.
 */
export const SHIPPED_BUNDLES: ReadonlySet<string> = new Set([
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
  '@deepseek-ai/dsh-headless',
])

/** Expand a leading `~` against the OS home, mirroring the harness's helper. */
function expandHome(path: string): string {
  if (path === '~') return homedir()
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(homedir(), path.slice(2))
  return path
}

/** Resolve the harness home: `$DSH_HOME`, then `~/.dsh`. */
export function resolveDshHome(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env[DSH_HOME_ENV]
  return resolve(fromEnv !== undefined && fromEnv.trim() !== '' ? expandHome(fromEnv) : join(homedir(), '.dsh'))
}

/**
 * Resolve a profile's directory. The name rules (and the `node_modules`
 * exclusion, the launcher's flat fallback path) mirror the harness's own
 * `resolveProfileDir`, so a profile the launcher accepts resolves identically
 * here.
 */
export function resolveProfileDir(name: string, home: string = resolveDshHome()): string {
  if (name === '' || name.includes('/') || name.includes('\\') || name === '.' || name === '..'
    || name === 'node_modules') {
    throw new Error(`invalid profile name ${JSON.stringify(name)}`)
  }
  return join(home, PROFILES_DIR, name)
}

/** The `!!js` scalar dialect: expression nodes the Loader evaluates lazily. */
interface JsExprNode {
  __jsExpr: string
}

function isJsExprNode(value: unknown): value is JsExprNode {
  return typeof value === 'object' && value !== null && '__jsExpr' in value
}

/**
 * The custom tag keeping `!!js process.platform === 'win32'` parseable and
 * re-emittable: resolved to the expression node the Loader's own dialect
 * uses, and stringified double-quoted — valid for any expression text, at
 * the cost of quotes the author may not have written.
 */
const jsExprTag: ScalarTag = {
  tag: 'tag:yaml.org,2002:js',
  identify: isJsExprNode,
  resolve: (text: string): JsExprNode => ({ __jsExpr: text }),
  stringify: (item: { value: unknown }): string =>
    `"${String(isJsExprNode(item.value) ? item.value.__jsExpr : item.value).replace(/(["\\])/g, '\\$1')}"`,
}

/** One entry row inside a patch's `insert` list. */
export interface PatchInsertRow {
  id?: string
  name?: string
  group?: boolean | null
  config?: unknown
  [key: string]: unknown
}

/** One row of a patch list: an `insert` list, or an id-targeted override. */
export interface PatchRow {
  id?: string
  insert?: PatchInsertRow[]
  [key: string]: unknown
}

/** The profile manifest's slices the manager reads and edits. */
export type ProfileManifest = Record<string, unknown> & {
  dependencies?: Record<string, string>
  dsh?: {
    bundle?: { patch?: string }
    profile?: { bundles?: string[] }
  }
}

/** Write a file atomically (tmp + rename), the include's own discipline. */
async function atomicWrite(file: string, content: string): Promise<void> {
  await writeFile(`${file}.tmp`, content, 'utf8')
  await rename(`${file}.tmp`, file)
}

/** Read and parse the profile manifest. */
export async function readManifest(profileDir: string): Promise<ProfileManifest> {
  const file = join(profileDir, 'package.json')
  const parsed = JSON.parse(await readFile(file, 'utf8')) as unknown
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError(`profile manifest ${file} must hold a JSON object`)
  }
  return parsed as ProfileManifest
}

/** Write the manifest back (2-space JSON, trailing newline, atomic). */
export async function writeManifest(profileDir: string, manifest: ProfileManifest): Promise<void> {
  await atomicWrite(join(profileDir, 'package.json'), JSON.stringify(manifest, undefined, 2) + '\n')
}

/** The bundles a user installed (the shipped template layers excluded). */
export function userBundles(manifest: ProfileManifest): string[] {
  const bundles = manifest.dsh?.profile?.bundles
  if (!Array.isArray(bundles)) return []
  return bundles.filter(name => typeof name === 'string' && !SHIPPED_BUNDLES.has(name))
}

/**
 * Remove one bundle from the manifest: its dependency entry and its
 * `dsh.profile.bundles` seat, the exact two facts the next boot's composition
 * and the CLI's reconcile read. Leftover files under `node_modules` become
 * inert the moment the layer is gone and are pruned by the next
 * `dsh plugin` command's pnpm run.
 * @returns true when the manifest changed.
 */
export function removeBundle(manifest: ProfileManifest, packageName: string): boolean {
  let changed = false
  if (manifest.dependencies !== undefined && packageName in manifest.dependencies) {
    delete manifest.dependencies[packageName]
    changed = true
  }
  const bundles = manifest.dsh?.profile?.bundles
  if (Array.isArray(bundles) && bundles.includes(packageName)) {
    bundles.splice(bundles.indexOf(packageName), 1)
    changed = true
  }
  return changed
}

/** Parse a patch-list file (a missing file is an empty list, per the launcher's own rule). */
export async function readPatchList(file: string): Promise<PatchRow[]> {
  let content: string
  try {
    content = await readFile(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const data = parse(content, { customTags: [jsExprTag] }) as unknown
  if (data === null || data === undefined) return []
  if (!Array.isArray(data)) {
    throw new TypeError(`patch file ${file} must hold a top-level array`)
  }
  return data as PatchRow[]
}

/**
 * The loader entry rows a patch list introduces, in patch-addressable form:
 * top-level inserts, group children (a group row itself is always enabled and
 * never listed, but its children are real entries), and rows inserted into a
 * group another layer declared. These ids are what `{ id, disabled: true }`
 * override rows target.
 */
export function collectEntryRows(patches: readonly PatchRow[]): { id: string; name: string }[] {
  const rows: { id: string; name: string }[] = []
  const walk = (inserts: readonly PatchInsertRow[]): void => {
    for (const row of inserts) {
      if (typeof row.id !== 'string' || row.id === '') continue
      if (row.group === true) {
        if (Array.isArray(row.config)) walk(row.config as PatchInsertRow[])
        continue
      }
      rows.push({ id: row.id, name: typeof row.name === 'string' ? row.name : '' })
    }
  }
  for (const patch of patches) {
    if (Array.isArray(patch.insert)) walk(patch.insert)
  }
  return rows
}

/**
 * Resolve a package's root directory from the profile anchor: Node's own
 * node_modules lookup order (the profile's `node_modules` first, then the
 * launcher's healed `profiles/node_modules` fallback on the parent walk), so
 * the result matches what the Loader imports.
 */
export function packageDirFromProfile(profileDir: string, packageName: string): string | undefined {
  for (const searchPath of createRequire(join(profileDir, 'package.json')).resolve.paths(packageName) ?? []) {
    const candidate = join(searchPath, packageName)
    if (existsSync(join(candidate, 'package.json'))) return candidate
  }
  return undefined
}

/** One installed bundle's display facts plus the entry ids it introduces. */
export interface BundleInfo {
  version: string
  description: string
  entries: { id: string; name: string }[]
}

/** Read one installed bundle: its manifest display facts and its patch's entry rows. */
export async function readBundleInfo(profileDir: string, packageName: string): Promise<BundleInfo> {
  const dir = packageDirFromProfile(profileDir, packageName)
  if (dir === undefined) {
    throw new Error(`package ${packageName} is not resolvable from the profile`)
  }
  const manifest = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')) as ProfileManifest
  const declared = manifest.dsh?.bundle?.patch
  if (typeof declared !== 'string' || declared === '') {
    throw new Error(`package ${packageName} declares no dsh.bundle patch`)
  }
  const entries = collectEntryRows(await readPatchList(join(dir, declared)))
  return {
    version: typeof (manifest as { version?: unknown }).version === 'string' ? (manifest as { version: string }).version : '',
    description: typeof manifest.description === 'string' ? manifest.description : '',
    entries,
  }
}

/** Whether one patch-list item is exactly the two-key disable row this manager writes. */
function isExactDisableRow(item: unknown, id: string): boolean {
  if (!isMap(item)) return false
  if (item.items.length !== 2) return false
  let sawId = false
  let sawDisabled = false
  for (const pair of item.items) {
    if (!isScalar(pair.key)) return false
    if (pair.key.value === 'id' && isScalar(pair.value) && pair.value.value === id) sawId = true
    else if (pair.key.value === 'disabled' && isScalar(pair.value) && pair.value.value === true) sawDisabled = true
    else return false
  }
  return sawId && sawDisabled
}

/**
 * Set or clear this manager's disable rows for the given entry ids in the
 * profile's user patch layer — the edit every enable/disable/uninstall funnel
 * through. Disable appends `- id: <id>` / `disabled: true` rows (skipping ids
 * already carrying one); enable removes exactly the rows this manager writes,
 * never a hand-written override (more keys, a `!!js` expression, a config
 * override), which keeps its own shape. The document round-trips through the
 * yaml CST, so comments and untouched rows keep their original text; the
 * launcher recomposes the tree on the save, which is what makes the edit live.
 * @returns true when the file changed.
 */
export async function setEntryDisabled(file: string, ids: readonly string[], disabled: boolean): Promise<boolean> {
  let content = ''
  try {
    content = await readFile(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const doc = parseDocument(content, { customTags: [jsExprTag] })
  if (doc.errors.length > 0) {
    throw new Error(`cannot edit patch file ${file}: ${doc.errors[0]!.message}`)
  }
  if (doc.contents === null) {
    // No file (or an empty one): there is nothing to remove, and rows to add
    // are the whole content — written directly, JSON-quoted ids and all.
    if (!disabled) return false
    const rows = ids.map(id => `- id: ${JSON.stringify(id)}\n  disabled: true\n`).join('')
    await atomicWrite(file, rows)
    return true
  }
  const seq = doc.contents
  if (!isSeq(seq)) {
    throw new TypeError(`patch file ${file} must hold a top-level array`)
  }
  let changed = false
  if (disabled) {
    // A template file's `[]` is a flow sequence; rows append in block style —
    // the file is the user's own and block rows read as the harness writes
    // them elsewhere.
    seq.flow = false
    for (const id of ids) {
      if (seq.items.some(item => isExactDisableRow(item, id))) continue
      const node = doc.createNode({ id, disabled: true })
      node.flow = false
      // The created node lacks a source range until serialized, which is all
      // it is used for — the seq types it as parsed, hence the cast.
      seq.add(node as Parameters<typeof seq.add>[0])
      changed = true
    }
  } else {
    for (let index = seq.items.length - 1; index >= 0; index -= 1) {
      const item = seq.items[index]!
      if (ids.some(id => isExactDisableRow(item, id))) {
        seq.items.splice(index, 1)
        changed = true
      }
    }
  }
  if (!changed) return false
  let output = doc.toString()
  if (!output.endsWith('\n')) output += '\n'
  await atomicWrite(file, output)
  return true
}
