import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  workspaceReady,
  workspaceTargetOf,
} from '../src/client/workspaceCompat.ts'

test('workspace readiness requires both split Controller baselines', () => {
  assert.equal(workspaceReady(
    { phase: 'pending', items: [] },
    { phase: 'ready', byId: {} },
  ), false)
  assert.equal(workspaceReady(
    { phase: 'ready', items: [] },
    { phase: 'pending', byId: {} },
  ), false)
  assert.equal(workspaceReady(
    { phase: 'ready', items: [] },
    { phase: 'ready', byId: {} },
  ), true)
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
    phase: 'ready',
    byId: { s1: { updatedAt: 10 }, s2: { updatedAt: 20 } },
  }), 'newer')
  assert.equal(workspaceTargetOf(state, {
    phase: 'ready',
    current: 's1',
    byId: { s1: { updatedAt: 10 }, s2: { updatedAt: 20 } },
  }), 'older')
})
