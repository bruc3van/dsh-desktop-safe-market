import { test } from 'node:test'
import assert from 'node:assert/strict'
import { en, zh } from '../src/client/locales.ts'

test('both locales pin npm installs and upgrades to the reviewed artifact', () => {
  for (const dictionary of [en, zh]) {
    for (const key of ['prompt', 'prompt.upgrade', 'prompt.compact', 'prompt.compact.upgrade'] as const) {
      const prompt = dictionary[key]
      assert.match(prompt, /add <npm [^>]+>@<[^>]+>/)
      assert.match(prompt, /dist\.integrity/)
      assert.match(prompt, /latest/)
      assert.doesNotMatch(prompt, /add <npm [^>]+>(?!@)/)
    }
  }
})


test('review mode selects separate install and upgrade prompts with target profile interpolation', async () => {
  const { reviewPromptKey, DEFAULT_REVIEW_MODE } = await import('../src/client/reviewMode.ts')
  assert.equal(DEFAULT_REVIEW_MODE, 'compact')
  for (const mode of ['full', 'compact'] as const) {
    for (const upgrade of [false, true]) {
      const key = reviewPromptKey(mode, upgrade)
      assert.equal(key.includes('compact'), mode === 'compact')
      assert.equal(key.endsWith('upgrade'), upgrade)
      for (const dictionary of [zh, en]) {
        const rendered = dictionary[key].replaceAll('{profile}', 'custom-profile')
        assert.match(rendered, /--profile custom-profile/)
        assert.equal(rendered.includes('{profile}'), false)
        assert.equal(rendered.includes('{installed}'), upgrade)
      }
    }
  }
  assert.ok(zh['prompt.compact'].length < zh.prompt.length)
  assert.ok(en['prompt.compact'].length < en.prompt.length)
})
