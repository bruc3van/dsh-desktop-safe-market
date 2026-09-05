import type { MarketSkillsResult } from '../contract.ts'

/** Stable session identity and readiness, backed by the session list store. */
export interface SkillsSessionSource {
  getSnapshot(): string
  subscribe(listener: () => void): () => void
}

/** Refresh on session changes and discard responses from a superseded session. */
export function watchSkills(source: SkillsSessionSource, read: () => Promise<MarketSkillsResult>, observer: {
  loading(): void
  result(value: MarketSkillsResult): void
  error(error: unknown): void
}): () => void {
  let generation = 0
  let previous: string | undefined
  const refresh = (): void => {
    const current = source.getSnapshot()
    if (current === previous) return
    previous = current
    const request = ++generation
    observer.loading()
    void Promise.resolve().then(read).then(value => {
      if (generation === request) observer.result(value)
    }, error => {
      if (generation === request) observer.error(error)
    })
  }
  const unsubscribe = source.subscribe(refresh)
  refresh()
  return () => { generation += 1; unsubscribe() }
}
