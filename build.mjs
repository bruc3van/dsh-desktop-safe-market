/**
 * Single-file client + ESM host build for dsh-desktop-safe-market.
 *
 * The web server serves exactly one file per plugin
 * (/plugins/dsh-desktop-safe-market/client.js), so the client half is one CJS
 * bundle wrapped in the ModuleLoader factory handshake; @deepseek-ai/dsh-* and
 * react stay external (the profile's healed node_modules and the app's module
 * system provide them). The host half is plain ESM for Node, externalizing
 * @deepseek-ai/dsh-* plus cordis while bundling schemastery (the Loader
 * validates Config against the schema).
 */
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'

// The version lives in two seats (package.json and dsh.plugin.json) and
// nothing syncs them but this gate: a drifted manifest would ship a release
// that misnames itself in the plugin list. Fail before any artifact lands.
const { version: packageVersion } = JSON.parse(readFileSync('package.json', 'utf8'))
const { version: manifestVersion } = JSON.parse(readFileSync('dsh.plugin.json', 'utf8'))
if (packageVersion !== manifestVersion) {
  throw new Error(`version drift: package.json is ${packageVersion} but dsh.plugin.json is ${manifestVersion} — bump both`)
}

mkdirSync('lib', { recursive: true })

const dshExternal = ['@deepseek-ai/cordis', '@deepseek-ai/dsh-*']

for (const entry of ['src/index.ts', 'src/invariant.ts']) {
  await build({
    entryPoints: [entry],
    outfile: entry.replace('src/', 'lib/').replace('.ts', '.js'),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: ['node22'],
    sourcemap: true,
    external: dshExternal,
    logLevel: 'info',
  })
}

await build({
  entryPoints: ['src/client/index.ts'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['es2022'],
  sourcemap: true,
  jsx: 'automatic',
  external: [...dshExternal, 'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'scheduler'],
  banner: {
    js: "window.__ModuleLoader__.load({ id: 'dsh-desktop-safe-market', factory: (require) => { var module = { exports: {} }; var exports = module.exports;",
  },
  footer: {
    js: 'return module.exports; } });',
  },
  logLevel: 'info',
})

execFileSync('node_modules/.bin/tsc', ['-p', 'tsconfig.json'], { stdio: 'inherit' })
