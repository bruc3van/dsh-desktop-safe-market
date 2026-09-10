import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Context } from '@deepseek-ai/cordis'
import {
  registerSafeMarketSettings,
  SAFE_MARKET_NAMESPACE,
} from '../src/settings.ts'

test('settings register through the DSH provider without the removed namespace factory', () => {
  const calls: unknown[][] = []
  const scope = { get: () => ({ enabled: false }) }
  const ctx = {
    settings: {
      register: (...args: unknown[]) => {
        calls.push(args)
        return scope
      },
    },
  } as unknown as Context

  assert.equal(SAFE_MARKET_NAMESPACE, 'safe-market')
  assert.equal(registerSafeMarketSettings(ctx), scope)
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.[0], 'safe-market')
  assert.deepEqual(calls[0]?.[2], { applies: 'live' })
})
