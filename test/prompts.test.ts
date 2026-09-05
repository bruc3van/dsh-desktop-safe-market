import { test } from 'node:test'
import assert from 'node:assert/strict'
import { en, zh } from '../src/client/locales.ts'

test('both locales pin npm installs and upgrades to the reviewed artifact', () => {
  for (const dictionary of [en, zh]) {
    for (const key of ['prompt', 'prompt.upgrade'] as const) {
      const prompt = dictionary[key]
      assert.match(prompt, /add <npm [^>]+>@<[^>]+>/)
      assert.match(prompt, /dist\.integrity/)
      assert.match(prompt, /latest/)
      assert.doesNotMatch(prompt, /add <npm [^>]+>(?!@)/)
    }
  }
})
