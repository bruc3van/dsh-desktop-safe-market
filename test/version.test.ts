/**
 * The version-consistency gate.
 *
 * The install instructions hardcode the release tarball URL — the official
 * command takes a concrete tarball, and the copyable agent prompt must carry
 * it verbatim — so a version bump has more seats than package.json. This test
 * is the gate: every tarball tag in the READMEs must be the version this
 * package declares, each README must keep at least one install URL, and the
 * plugin manifest must not drift from the package version.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')) as { version: string }
const plugin = JSON.parse(await readFile(resolve(root, 'dsh.plugin.json'), 'utf8')) as { version: string }

/** Every release-tarball tag a README pins, e.g. `v0.2.2`. */
function tarballTags(markdown: string): string[] {
  return [...markdown.matchAll(/archive\/refs\/tags\/(v\d+\.\d+\.\d+)\.tar\.gz/g)].map(match => match[1]!)
}

test('dsh.plugin.json declares the same version as package.json', () => {
  assert.equal(
    plugin.version,
    pkg.version,
    `dsh.plugin.json says ${plugin.version} but package.json says ${pkg.version} — bump both together`,
  )
})

for (const name of ['README.md', 'README_EN.md'] as const) {
  test(`${name} pins the release tarball to the current version`, async () => {
    const markdown = await readFile(resolve(root, name), 'utf8')
    const tags = tarballTags(markdown)
    assert.ok(
      tags.length > 0,
      `${name} must keep at least one release-tarball install URL (the command and the agent prompt each carry one)`,
    )
    for (const tag of tags) {
      assert.equal(
        tag,
        `v${pkg.version}`,
        `${name} references ${tag}, but the package version is ${pkg.version} — update the install command and the agent prompt alongside the bump`,
      )
    }
  })
}
