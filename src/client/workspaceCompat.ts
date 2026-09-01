/** Workspace identities are opaque to this adapter and only passed back to DSH services. */
export type WorkspaceTarget = string

/** Workspace facts exposed by the DSH 0.1.2 Workspace Controller. */
export interface WorkspaceState {
  readonly phase: 'pending' | 'ready'
  readonly items: readonly {
    readonly workspaceId: WorkspaceTarget
    readonly sessionIds: readonly string[]
    readonly createdAt?: string
  }[]
}

/** Session-list facts needed to select the current or most recent Workspace. */
export interface SessionListState {
  readonly phase: 'pending' | 'ready'
  readonly current?: string
  readonly byId: Readonly<Record<string, { readonly updatedAt?: number }>>
}

/** Workspace Controller face consumed by the market. */
export interface MarketWorkspaces {
  readonly list: {
    getSnapshot(): WorkspaceState
    subscribe(listener: () => void): () => void
  }
  create(input: { path: string }): Promise<{ workspaceId: WorkspaceTarget }>
}

/** Cross-Controller navigation supplied by the DSH 0.1.2 Web profile. */
export interface MarketUiWorkspace {
  connectWorkspace(workspaceId: WorkspaceTarget): Promise<string>
  pickDirectory(): Promise<string | null>
}

/** Whether the active DSH generation has received both Workspace and Session baselines. */
export function workspaceReady(state: WorkspaceState, sessions: SessionListState): boolean {
  return state.phase === 'ready' && sessions.phase === 'ready'
}

/**
 * Select the same Workspace target used by DSH New Session: current first,
 * then recency derived from the split Controllers.
 */
export function workspaceTargetOf(
  state: WorkspaceState,
  sessions: SessionListState,
): WorkspaceTarget | undefined {
  const current = sessions.current
  const currentWorkspaceId = current === undefined
    ? undefined
    : state.items.find(item => item.sessionIds.includes(current))?.workspaceId
  if (currentWorkspaceId !== undefined) return currentWorkspaceId
  let selected: WorkspaceTarget | undefined
  let selectedTime = Number.NEGATIVE_INFINITY
  for (const workspace of state.items) {
    let latest = Number.NEGATIVE_INFINITY
    for (const sessionId of workspace.sessionIds) {
      const updatedAt = sessions.byId[sessionId]?.updatedAt
      if (updatedAt !== undefined) latest = Math.max(latest, updatedAt)
    }
    if (latest === Number.NEGATIVE_INFINITY && workspace.createdAt !== undefined) {
      latest = Date.parse(workspace.createdAt)
    }
    if (selected === undefined || latest > selectedTime) {
      selected = workspace.workspaceId
      selectedTime = latest
    }
  }
  return selected
}
