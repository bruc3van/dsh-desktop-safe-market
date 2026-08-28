import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  type MarketUiWorkspace,
  type MarketWorkspaces,
  workspaceNavigation,
  workspaceReady,
  workspaceTargetOf,
} from '../src/client/workspaceCompat.ts'

const workspaces = (over: Partial<MarketWorkspaces> = {}): MarketWorkspaces => ({
  list: {
    getSnapshot: () => ({ baselinesReady: true, items: [] }),
    subscribe: () => () => {},
  },
  create: async ({ path }) => ({ workspaceId: path }),
  ...over,
})

test('workspace readiness accepts legacy and split-Controller snapshots', () => {
  assert.equal(workspaceReady({ baselinesReady: false, items: [] }, {}), false)
  assert.equal(workspaceReady({ baselinesReady: true, items: [] }, {}), true)
  assert.equal(workspaceReady({ phase: 'pending', items: [] }, { phase: 'ready' }), false)
  assert.equal(workspaceReady({ phase: 'ready', items: [] }, { phase: 'pending' }), false)
  assert.equal(workspaceReady({ phase: 'ready', items: [] }, { phase: 'ready' }), true)
})

test('legacy double-field snapshots keep their aggregate baseline gate', () => {
  assert.equal(workspaceReady({ phase: 'ready', baselinesReady: false, items: [] }, { phase: 'ready' }), false)
  assert.equal(workspaceReady({ phase: 'pending', baselinesReady: true, items: [] }, { phase: 'pending' }), true)
})

test('workspace selection preserves the legacy recency projection', () => {
  assert.equal(workspaceTargetOf({
    baselinesReady: true,
    recentWorkspaceId: 'legacy-recent',
    items: [{ workspaceId: 'legacy-recent', sessionIds: [] }],
  }, {}), 'legacy-recent')
})

test('workspace selection derives the latest target for split Controllers', () => {
  const state = {
    phase: 'ready' as const,
    items: [
      { workspaceId: 'older', sessionIds: ['s1'], createdAt: '2026-01-01T00:00:00Z' },
      { workspaceId: 'newer', sessionIds: ['s2'], createdAt: '2026-02-01T00:00:00Z' },
    ],
  }
  assert.equal(workspaceTargetOf(state, {
    byId: { s1: { updatedAt: 10 }, s2: { updatedAt: 20 } },
  }), 'newer')
  assert.equal(workspaceTargetOf(state, {
    current: 's1',
    byId: { s1: { updatedAt: 10 }, s2: { updatedAt: 20 } },
  }), 'older')
})

test('workspace navigation prefers the new uiWorkspace service', async () => {
  const calls: string[] = []
  const legacy = workspaces({
    connectWorkspace: async () => { calls.push('legacy-connect'); return 'legacy-session' },
    pickDirectory: async () => { calls.push('legacy-pick'); return 'C:/legacy' },
  })
  const modern: MarketUiWorkspace = {
    connectWorkspace: async () => { calls.push('modern-connect'); return 'modern-session' },
    pickDirectory: async () => { calls.push('modern-pick'); return 'C:/modern' },
  }
  const navigation = workspaceNavigation(legacy, () => modern)
  assert.equal(await navigation.connectWorkspace('workspace'), 'modern-session')
  assert.equal(await navigation.pickDirectory(), 'C:/modern')
  assert.deepEqual(calls, ['modern-connect', 'modern-pick'])
})

test('workspace navigation falls back to legacy Client Runtime methods', async () => {
  const legacy = workspaces({
    connectWorkspace: async id => `session:${id}`,
    pickDirectory: async () => 'C:/legacy',
  })
  const navigation = workspaceNavigation(legacy, () => undefined)
  assert.equal(await navigation.connectWorkspace('workspace'), 'session:workspace')
  assert.equal(await navigation.pickDirectory(), 'C:/legacy')
})

test('workspace navigation fails clearly when neither generation supplies an operation', async () => {
  const navigation = workspaceNavigation(workspaces(), () => undefined)
  await assert.rejects(navigation.connectWorkspace('workspace'), /navigation service is not mounted/)
  await assert.rejects(navigation.pickDirectory(), /directory picker service is not mounted/)
})

test('workspace navigation resolves a late uiWorkspace service at call time', async () => {
  let modern: MarketUiWorkspace | undefined
  const navigation = workspaceNavigation(workspaces(), () => modern)
  modern = {
    connectWorkspace: async id => `modern:${id}`,
    pickDirectory: async () => 'C:/modern',
  }
  assert.equal(await navigation.connectWorkspace('workspace'), 'modern:workspace')
  assert.equal(await navigation.pickDirectory(), 'C:/modern')
})
