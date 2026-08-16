/**
 * Regression tests for the installed-plugin manager: the profile file edits
 * it makes and the verbs built on them. The Loader is stubbed structurally
 * (entries plus update), so these cover the manager's own logic — which ids,
 * which rows, which files — not the Loader's.
 *
 * Run with `pnpm test` (node --test). Fixtures are written into per-test
 * temp directories shaped like a harness home: `<tmp>/profiles/web/`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Loader } from '@deepseek-ai/cordis-plugin-loader'
import {
  collectEntryRows,
  readPatchList,
  readManifest,
  removeBundle,
  resolveProfileDir,
  setEntryDisabled,
  userBundles,
  type ProfileManifest,
} from '../src/profile.ts'
import { createInstalledManager, type PendingUninstall } from '../src/installed.ts'
import { adoptDomainState, initialDomainState, type SafeMarketDomainState } from '../src/store.ts'
import {
  marketInstalledResultSchema,
  packageNameSchema,
  setInstalledEnabledUpdateSchema,
} from '../src/contract.ts'

/** The harness's own template for a profile's user patch layer. */
const PATCH_TEMPLATE = `# Your patch layer for this dsh profile, applied after every bundle layer:
# a top-level YAML array of loader patch entries (id-targeted config
# overrides, disables, and insert lists; \`!!js\` expressions allowed).
[]
`

/** A temp harness home with one `web` profile carrying a manifest and patch layer. */
async function makeHome(patch: string = PATCH_TEMPLATE): Promise<{ home: string; profileDir: string }> {
  const home = await mkdtemp(join(tmpdir(), 'safe-market-'))
  const profileDir = join(home, 'profiles', 'web')
  await mkdir(profileDir, { recursive: true })
  await writeFile(join(profileDir, 'package.json'), JSON.stringify({
    name: 'dsh-profile-web',
    private: true,
    dependencies: { 'demo-plugin': '^1.0.0', zod: '^4.0.0' },
    dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'demo-plugin'] } },
  }, undefined, 2) + '\n')
  await writeFile(join(profileDir, 'cordis.patch.yml'), patch)
  return { home, profileDir }
}

/** One installed bundle under the profile's node_modules. */
async function makeBundle(profileDir: string, name: string, patch: string): Promise<void> {
  const dir = join(profileDir, 'node_modules', name)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'package.json'), JSON.stringify({
    name,
    version: '1.2.3',
    description: 'a demo plugin',
    dsh: { bundle: { patch: './cordis.patch.yml' } },
  }, undefined, 2))
  await writeFile(join(dir, 'cordis.patch.yml'), patch)
}

/** A structural Loader stub: entries by id, update recorded and applied. */
function stubLoader(rows: { id: string; name?: string; disabled?: boolean; fiberState?: number | null }[]) {
  const updates: Array<{ id: string; options: Record<string, unknown> }> = []
  const entries = rows.map(row => {
    const entry = {
      id: row.id,
      options: { id: row.id.split(':').pop(), name: row.name ?? 'demo-plugin', disabled: row.disabled } as Record<string, unknown>,
      get disabled() { return (this as { options: { disabled?: boolean } }).options.disabled === true },
      fiber: row.fiberState === null || row.fiberState === undefined ? undefined : { state: row.fiberState },
      update: async (options: Record<string, unknown>) => {
        updates.push({ id: row.id, options })
        Object.assign(entry.options, options)
      },
    }
    return entry
  })
  return {
    updates,
    loader: { entries: () => entries[Symbol.iterator]() } as unknown as Loader,
  }
}

/** A pending-record seat over a plain variable. */
function pendingSeat(initial: PendingUninstall[] = []) {
  let value = initial
  return {
    read: () => value,
    write: (next: readonly PendingUninstall[]) => { value = [...next] },
    get: () => value,
  }
}

/** The manager over a fixture home, with the given loader stub. */
async function manager(home: string, loader: Loader, pending = pendingSeat()) {
  return {
    manager: createInstalledManager({
      profile: 'web',
      selfName: 'dsh-desktop-safe-market',
      loader,
      home,
      readPending: pending.read,
      writePending: pending.write,
    }),
    pending,
  }
}

/** The manager over a fixture home, with its own pending seat. */
function makeManager(home: string, loader: Loader) {
  const pending = pendingSeat()
  return createInstalledManager({
    profile: 'web',
    selfName: 'dsh-desktop-safe-market',
    loader,
    home,
    readPending: pending.read,
    writePending: pending.write,
  })
}

// ——— profile path and manifest helpers ———

test('resolveProfileDir mirrors the launcher name rules', () => {
  assert.equal(resolveProfileDir('web', '/home').replaceAll('\\', '/'), '/home/profiles/web')
  for (const bad of ['', 'a/b', 'a\\b', '.', '..', 'node_modules']) {
    assert.throws(() => resolveProfileDir(bad, '/home'), /invalid profile name/)
  }
})

test('userBundles excludes the shipped template layers', async () => {
  const { home, profileDir } = await makeHome()
  try {
    assert.deepEqual(userBundles(await readManifest(profileDir)), ['demo-plugin'])
    assert.equal(resolveProfileDir('web', home), profileDir)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('removeBundle takes the dependency and the bundles seat, nothing else', () => {
  const manifest: ProfileManifest = {
    name: 'dsh-profile-web',
    private: true,
    dependencies: { 'demo-plugin': '^1.0.0', zod: '^4.0.0' },
    dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', 'demo-plugin'] } },
  }
  assert.equal(removeBundle(manifest, 'demo-plugin'), true)
  assert.deepEqual(manifest, {
    name: 'dsh-profile-web',
    private: true,
    dependencies: { zod: '^4.0.0' },
    dsh: { profile: { bundles: ['@deepseek-ai/dsh-base'] } },
  })
  assert.equal(removeBundle(manifest, 'demo-plugin'), false)
})

// ——— the user patch layer edits ———

test('setEntryDisabled appends rows to the template file, comments intact', async () => {
  const { home, profileDir } = await makeHome()
  try {
    const file = join(profileDir, 'cordis.patch.yml')
    assert.equal(await setEntryDisabled(file, ['demo-plugin'], true), true)
    const after = await readFile(file, 'utf8')
    assert.equal(after.startsWith('# Your patch layer for this dsh profile'), true)
    assert.match(after, /- id: demo-plugin\n  disabled: true/)
    // Idempotent: the same disable writes nothing.
    assert.equal(await setEntryDisabled(file, ['demo-plugin'], true), false)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('enable removes only this manager\'s exact rows, never hand-written ones', async () => {
  const original = `# a user comment that must survive
- id: other-plugin
  config:
    timeout: 5
- id: demo-plugin
  disabled: true
- id: demo-plugin
  disabled: !!js process.env.DEMO === 'on'
- id: demo-plugin
  disabled: true
  reason: hand-written
- id: demo-plugin
  disabled: true
`
    const { home, profileDir } = await makeHome(original)
    try {
      const file = join(profileDir, 'cordis.patch.yml')
      // The exact row already exists, so disabling writes nothing.
      assert.equal(await setEntryDisabled(file, ['demo-plugin'], true), false)
      assert.equal(await setEntryDisabled(file, ['demo-plugin'], false), true)
      const after = await readFile(file, 'utf8')
      assert.match(after, /^# a user comment that must survive/)
      assert.match(after, /timeout: 5/)
      assert.match(after, /disabled: !!js /)
      assert.match(after, /reason: hand-written/)
      // No exact two-key disable row survives; the hand-written richer row
      // and the expression row do. The `!!js` row may re-emit quoted, but it
      // must still parse to the same expression node the Loader builds.
      const patches = await readPatchList(file)
      assert.equal(patches.some(patch => JSON.stringify(Object.keys(patch).sort()) === JSON.stringify(['disabled', 'id'])
        && patch.id === 'demo-plugin' && patch.disabled === true), false)
      assert.deepEqual(
        patches.find(patch => (patch as { disabled?: unknown }).disabled !== undefined && patch.id === 'demo-plugin' && (patch as { disabled?: unknown }).disabled !== true),
        { id: 'demo-plugin', disabled: { __jsExpr: "process.env.DEMO === 'on'" } },
      )
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

test('setEntryDisabled creates the file when the patch layer is missing', async () => {
  const { home, profileDir } = await makeHome()
  try {
    const file = join(profileDir, 'elsewhere.patch.yml')
    assert.equal(await setEntryDisabled(file, ['a:b c"quote'], true), true)
    assert.equal(await readFile(file, 'utf8'), '- id: "a:b c\\"quote"\n  disabled: true\n')
    assert.equal(await setEntryDisabled(file, ['a:b c"quote'], false), true)
    assert.equal((await readFile(file, 'utf8')).trim(), '[]')
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('readPatchList parses the !!js dialect as expression nodes', async () => {
  const { home, profileDir } = await makeHome()
  try {
    const file = join(profileDir, 'expr.patch.yml')
    await writeFile(file, "- id: telemetry\n  disabled: !!js process.platform === 'win32'\n")
    const patches = await readPatchList(file)
    assert.deepEqual(patches, [{ id: 'telemetry', disabled: { __jsExpr: "process.platform === 'win32'" } }])
    assert.deepEqual(await readPatchList(join(profileDir, 'missing.yml')), [])
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('collectEntryRows walks top-level, group, and group-targeted inserts', () => {
  const rows = collectEntryRows([
    { insert: [{ id: 'plain', name: 'pkg-a' }] },
    { insert: [{ id: 'grp', name: 'cordis:group', group: true, config: [{ id: 'nested' }] }] },
    { id: 'other-grp', insert: [{ id: 'into-group' }] },
    { id: 'just-an-override' },
  ])
  assert.deepEqual(rows, [
    { id: 'plain', name: 'pkg-a' },
    { id: 'nested', name: '' },
    { id: 'into-group', name: '' },
  ])
})

// ——— the manager over a stubbed Loader ———

test('list joins the manifest bundles with the live entry tree', async () => {
  const { home, profileDir } = await makeHome()
  try {
    await makeBundle(profileDir, 'demo-plugin', '- insert:\n    - id: demo-plugin\n      name: demo-plugin\n')
    const { loader } = stubLoader([
      { id: 'include:demo-plugin', name: 'demo-plugin', fiberState: 2 },
      { id: 'timer', fiberState: 2 },
    ])
    const built = makeManager(home, loader)
    const result = await built.list()
    assert.equal(result.error, '')
    assert.equal(result.profile, 'web')
    assert.equal(result.packages.length, 1)
    assert.deepEqual(result.packages[0]!.entries, [
      { id: 'demo-plugin', name: 'demo-plugin', present: true, enabled: true, phase: 'active' },
    ])
    assert.equal(result.packages[0]!.version, '1.2.3')
    assert.equal(result.packages[0]!.self, false)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('setEnabled writes the durable rows and nudges the live entry', async () => {
  const { home, profileDir } = await makeHome()
  try {
    await makeBundle(profileDir, 'demo-plugin', '- insert:\n    - id: demo-plugin\n      name: demo-plugin\n')
    const seat = stubLoader([{ id: 'include:demo-plugin', name: 'demo-plugin', fiberState: 2 }])
    const built = makeManager(home, seat.loader)
    const result = await built.setEnabled('demo-plugin', false)
    assert.match(await readFile(join(profileDir, 'cordis.patch.yml'), 'utf8'), /- id: demo-plugin\n  disabled: true/)
    assert.deepEqual(seat.updates, [{ id: 'include:demo-plugin', options: { disabled: true } }])
    assert.equal(result.packages[0]!.enabled, false)

    // And back on: the row comes out and the entry updates again.
    const reEnabled = await built.setEnabled('demo-plugin', true)
    assert.equal((await readFile(join(profileDir, 'cordis.patch.yml'), 'utf8')).includes('disabled'), false)
    assert.equal(reEnabled.packages[0]!.enabled, true)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('setEnabled refuses unknown packages and its own row', async () => {
  const { home, profileDir } = await makeHome()
  try {
    await makeBundle(profileDir, 'demo-plugin', '[]\n')
    await makeBundle(profileDir, 'dsh-desktop-safe-market', '[]\n')
    const manifest = await readManifest(profileDir)
    manifest.dsh!.profile!.bundles!.push('dsh-desktop-safe-market')
    manifest.dependencies!['dsh-desktop-safe-market'] = '^0.2.0'
    await writeFile(join(profileDir, 'package.json'), JSON.stringify(manifest, undefined, 2) + '\n')
    const built = makeManager(home, stubLoader([]).loader)
    await assert.rejects(built.setEnabled('not-installed', false), /not an installed plugin package/)
    await assert.rejects(built.setEnabled('dsh-desktop-safe-market', false), /cannot disable itself/)
    // Nothing was written along either refusal.
    assert.equal((await readFile(join(profileDir, 'cordis.patch.yml'), 'utf8')).includes('disabled'), false)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('uninstall edits the manifest, records the rows, and stops the entries', async () => {
  const { home, profileDir } = await makeHome()
  try {
    await makeBundle(profileDir, 'demo-plugin', '- insert:\n    - id: demo-plugin\n      name: demo-plugin\n')
    const seat = stubLoader([{ id: 'include:demo-plugin', name: 'demo-plugin', fiberState: 2 }])
    const pending = pendingSeat()
    const built = createInstalledManager({
      profile: 'web',
      selfName: 'dsh-desktop-safe-market',
      loader: seat.loader,
      home,
      readPending: pending.read,
      writePending: pending.write,
    })
    const result = await built.uninstall('demo-plugin')
    assert.equal(result.packages.length, 0, 'the package is gone from the list')
    const manifest = await readManifest(profileDir)
    assert.deepEqual(manifest.dsh!.profile!.bundles, ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'])
    assert.equal('demo-plugin' in (manifest.dependencies ?? {}), false)
    assert.match(await readFile(join(profileDir, 'cordis.patch.yml'), 'utf8'), /- id: demo-plugin\n  disabled: true/)
    assert.deepEqual(pending.get().map(record => record.entryIds), [['demo-plugin']])
    assert.deepEqual(seat.updates, [{ id: 'include:demo-plugin', options: { disabled: true } }])

    // The next boot's sweep takes the rows back and clears the record.
    await built.sweep()
    assert.equal((await readFile(join(profileDir, 'cordis.patch.yml'), 'utf8')).includes('disabled'), false)
    assert.deepEqual(pending.get(), [])
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('uninstall of self edits the manifest only', async () => {
  const { home, profileDir } = await makeHome()
  try {
    await makeBundle(profileDir, 'dsh-desktop-safe-market', '- insert:\n    - id: dsh-desktop-safe-market\n      name: dsh-desktop-safe-market\n')
    const manifest = await readManifest(profileDir)
    manifest.dsh!.profile!.bundles!.push('dsh-desktop-safe-market')
    manifest.dependencies!['dsh-desktop-safe-market'] = '^0.2.0'
    await writeFile(join(profileDir, 'package.json'), JSON.stringify(manifest, undefined, 2) + '\n')
    const seat = stubLoader([{ id: 'include:dsh-desktop-safe-market', fiberState: 2 }])
    const pending = pendingSeat()
    const built = createInstalledManager({
      profile: 'web',
      selfName: 'dsh-desktop-safe-market',
      loader: seat.loader,
      home,
      readPending: pending.read,
      writePending: pending.write,
    })
    await built.uninstall('dsh-desktop-safe-market')
    assert.deepEqual(pending.get(), [])
    assert.deepEqual(seat.updates, [])
    assert.equal((await readFile(join(profileDir, 'cordis.patch.yml'), 'utf8')).includes('disabled'), false)
    const after = await readManifest(profileDir)
    assert.deepEqual(after.dsh!.profile!.bundles, ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'demo-plugin'])
    assert.equal('dsh-desktop-safe-market' in (after.dependencies ?? {}), false)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('sweep leaves the record alone when the edit fails', async () => {
  const { home, profileDir } = await makeHome()
  try {
    const pending = pendingSeat([{ packageName: 'demo-plugin', entryIds: ['demo-plugin'], at: '2026-01-01T00:00:00Z' }])
    const built = createInstalledManager({
      profile: 'web',
      selfName: 'dsh-desktop-safe-market',
      loader: stubLoader([]).loader,
      home,
      readPending: pending.read,
      writePending: pending.write,
    })
    // A directory where the patch file should be breaks every edit.
    await rm(join(profileDir, 'cordis.patch.yml'))
    await mkdir(join(profileDir, 'cordis.patch.yml'))
    await built.sweep()
    assert.equal(pending.get().length, 1, 'the record survives to retry next boot')
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('uninstall survives a broken patch layer: manifest edited, no record, live stop attempted', async () => {
  const { home, profileDir } = await makeHome()
  try {
    await makeBundle(profileDir, 'demo-plugin', '- insert:\n    - id: demo-plugin\n      name: demo-plugin\n')
    const seat = stubLoader([{ id: 'include:demo-plugin', name: 'demo-plugin', fiberState: 2 }])
    const pending = pendingSeat()
    const built = createInstalledManager({
      profile: 'web',
      selfName: 'dsh-desktop-safe-market',
      loader: seat.loader,
      home,
      readPending: pending.read,
      writePending: pending.write,
    })
    await rm(join(profileDir, 'cordis.patch.yml'))
    await mkdir(join(profileDir, 'cordis.patch.yml'))
    // The manifest is the authoritative fact; the stop rows are a session
    // nicety, so their failure must not fail (or block a retry of) the verb.
    const result = await built.uninstall('demo-plugin')
    assert.equal(result.packages.length, 0)
    const manifest = await readManifest(profileDir)
    assert.equal('demo-plugin' in (manifest.dependencies ?? {}), false)
    assert.deepEqual(manifest.dsh!.profile!.bundles, ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'])
    assert.deepEqual(pending.get(), [], 'no sweep record without rows to sweep')
    assert.deepEqual(seat.updates, [{ id: 'include:demo-plugin', options: { disabled: true } }], 'the live stop still ran')
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('concurrent mutating verbs serialize instead of interleaving', async () => {
  const { home, profileDir } = await makeHome()
  try {
    await makeBundle(profileDir, 'demo-plugin', '- insert:\n    - id: demo-plugin\n      name: demo-plugin\n')
    // The first live update parks mid-flight; whichever verb runs second must
    // only start once the first one's file edit has committed.
    let release: (() => void) | undefined
    const parked = new Promise<void>(resolve => { release = resolve })
    const updates: Array<{ id: string; options: Record<string, unknown> }> = []
    const entry = {
      id: 'include:demo-plugin',
      options: { id: 'demo-plugin', name: 'demo-plugin' } as Record<string, unknown>,
      get disabled() { return (this as { options: { disabled?: boolean } }).options.disabled === true },
      fiber: { state: 2 },
      update: async (options: Record<string, unknown>) => {
        if (updates.length === 0) await parked
        updates.push({ id: 'include:demo-plugin', options })
        Object.assign(entry.options, options)
      },
    }
    const loader = { entries: () => [entry][Symbol.iterator]() } as unknown as Loader
    const built = createInstalledManager({
      profile: 'web',
      selfName: 'dsh-desktop-safe-market',
      loader,
      home,
      readPending: () => [],
      writePending: () => {},
    })
    const first = built.setEnabled('demo-plugin', false)
    const second = built.setEnabled('demo-plugin', false)
    release!()
    await Promise.all([first, second])
    const patch = await readFile(join(profileDir, 'cordis.patch.yml'), 'utf8')
    assert.equal(patch.includes('- id: demo-plugin\n  disabled: true'), true)
    // The serialized chain ran the verb twice; the second found the row
    // already written and wrote nothing (idempotent), which is the point.
    assert.equal((patch.match(/- id: demo-plugin\n  disabled: true/g) ?? []).length, 1)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

// ——— the durable state adoption ———

/** A stored state cut under a real config (the shape the domain hands back). */
function storedState(overrides: Partial<SafeMarketDomainState> = {}): SafeMarketDomainState {
  return {
    catalog: {
      items: [],
      categories: [],
      fetchedAt: '2025-08-16T00:00:00Z',
      refreshedAt: '2025-08-16T00:00:00Z',
      scanned: 1,
    },
    repositoriesEtag: '"r1"',
    curatedEtag: '"c1"',
    marketSize: 100,
    catalogBase: 'https://example.test/data',
    pendingUninstall: [],
    ...overrides,
  }
}

test('adopting a usable stored catalog keeps the cache usable (the cut travels with the rows)', async () => {
  const usable = (candidate: SafeMarketDomainState): boolean =>
    candidate.catalog !== null && candidate.marketSize === 100 && candidate.catalogBase === 'https://example.test/data'
  const adopted = adoptDomainState(initialDomainState, storedState({ pendingUninstall: [{ packageName: 'x', entryIds: ['x'], at: '2026-01-01T00:00:00Z' }] }), usable)
  // The regression this locks out: adopting only the rows left the initial
  // marketSize (1) and catalogBase ('') behind, and the cache gate — which
  // re-checks those — turned the adopted catalog permanently unusable.
  assert.equal(usable(adopted), true)
  assert.equal(adopted.repositoriesEtag, '"r1"')
  assert.deepEqual(adopted.pendingUninstall, [{ packageName: 'x', entryIds: ['x'], at: '2026-01-01T00:00:00Z' }])
})

test('adoption keeps a newer memory catalog and skips an unusable stored one', async () => {
  const usable = (candidate: SafeMarketDomainState): boolean =>
    candidate.catalog !== null && candidate.marketSize === 100 && candidate.catalogBase === 'https://example.test/data'
  const memory = storedState({ repositoriesEtag: '"r-new"', curatedEtag: '"c-new"' })
  // A catalog that landed while the domain was opening is newer than disk.
  const kept = adoptDomainState(memory, storedState({ repositoriesEtag: '"r-old"' }), usable)
  assert.equal(kept.repositoriesEtag, '"r-new"')
  // A stored cut that answers a different config is not adopted at all…
  const skipped = adoptDomainState(initialDomainState, storedState({ marketSize: 50 }), usable)
  assert.equal(skipped.catalog, null)
  assert.equal(skipped.marketSize, 1)
  // …but the pending-uninstall record follows the disk either way.
  assert.deepEqual(skipped.pendingUninstall, [])
  const carried = adoptDomainState(initialDomainState, storedState({ marketSize: 50, pendingUninstall: [{ packageName: 'x', entryIds: ['x'], at: '2026-01-01T00:00:00Z' }] }), usable)
  assert.deepEqual(carried.pendingUninstall, [{ packageName: 'x', entryIds: ['x'], at: '2026-01-01T00:00:00Z' }])
})

// ——— the wire codecs ———

test('the installed wire codecs accept the real shapes and reject hostile ones', () => {
  const result = marketInstalledResultSchema.parse({
    packages: [{
      packageName: 'demo-plugin',
      version: '1.2.3',
      description: 'a demo',
      self: false,
      enabled: true,
      entries: [{ id: 'demo-plugin', name: 'demo-plugin', present: true, enabled: true, phase: 'active' }],
      error: '',
    }],
    profile: 'web',
    error: '',
  })
  assert.equal(result.packages[0]!.entries[0]!.phase, 'active')
  assert.throws(() => packageNameSchema.parse('../evil'))
  assert.throws(() => packageNameSchema.parse('a b'))
  assert.throws(() => setInstalledEnabledUpdateSchema.parse({ packageName: 'demo-plugin', enabled: 'yes' }))
})
