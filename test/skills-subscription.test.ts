import { test } from 'node:test'
import assert from 'node:assert/strict'
import { watchSkills } from '../src/client/skillsSubscription.ts'
import type { MarketSkillsResult } from '../src/contract.ts'

const result = (error: string): MarketSkillsResult => ({ skills: [], complete: true, error })
const tick = () => new Promise(resolve => setImmediate(resolve))

test('skills refresh when sessions become ready and ignore superseded responses', async () => {
  let identity = 'pending'
  let listener = () => {}
  let unsubscribed = false
  let reads = 0
  let oldResponse!: (value: MarketSkillsResult) => void
  const seen: string[] = []
  const stop = watchSkills({
    getSnapshot: () => identity,
    subscribe: fn => { listener = fn; return () => { unsubscribed = true } },
  }, async () => {
    reads += 1
    if (identity === 'pending') return result('sessions-pending')
    if (identity === 'first') return new Promise(resolve => { oldResponse = resolve })
    return result(identity)
  }, { loading() {}, result: value => { seen.push(value.error) }, error: error => { throw error } })
  await tick()
  identity = 'first'; listener(); await tick()
  identity = 'second'; listener(); await tick()
  oldResponse(result('obsolete')); await tick()
  assert.deepEqual(seen, ['sessions-pending', 'second'])
  listener(); await tick()
  assert.equal(reads, 3)
  stop()
  assert.equal(unsubscribed, true)
})
