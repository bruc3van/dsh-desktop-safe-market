import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pnpmRemoveCommand } from '../src/installed.ts'

test('Windows pnpm uses an explicit interpreter with safe command text', () => {
  assert.deepEqual(pnpmRemoveCommand('@scope/plugin', 'win32'), {
    command: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', 'pnpm.cmd remove @scope/plugin'],
  })
  assert.deepEqual(pnpmRemoveCommand('plugin', 'linux'), { command: 'pnpm', args: ['remove', 'plugin'] })
  for (const name of ['--global', '-r', 'x & calc', 'x%PATH%', 'x\nwhoami', 'x"']) {
    assert.throws(() => pnpmRemoveCommand(name, 'win32'), /invalid npm package name/)
  }
})

test('Windows executes a pnpm.cmd shim through the uninstall runner', { skip: process.platform !== 'win32' }, async () => {
  const { mkdtemp, writeFile, readFile, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { spawnPnpmRemove } = await import('../src/installed.ts')
  const dir = await mkdtemp(join(tmpdir(), 'market cmd test '))
  try {
    await writeFile(join(dir, 'pnpm.cmd'), '@echo off\r\necho %1 %2>args.txt\r\nexit /b 0\r\n')
    assert.deepEqual(await spawnPnpmRemove(dir, '@scope/plugin'), { ok: true, detail: '' })
    assert.equal((await readFile(join(dir, 'args.txt'), 'utf8')).trim(), 'remove @scope/plugin')
  } finally { await rm(dir, { recursive: true, force: true }) }
})
