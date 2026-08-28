/** Workspace identities are opaque to this adapter and only passed back to DSH services. */
export type WorkspaceTarget = string

/** Workspace facts shared by the legacy Client Runtime and the split Controllers. */
export interface WorkspaceState {
  readonly phase?: 'pending' | 'ready'
  readonly baselinesReady?: boolean
  readonly recentWorkspaceId?: WorkspaceTarget
  readonly items: readonly {
    readonly workspaceId: WorkspaceTarget
    readonly sessionIds: readonly string[]
    readonly createdAt?: string
  }[]
}

/** Session-list facts needed to select the current or most recent Workspace. */
export interface SessionListState {
  readonly phase?: 'pending' | 'ready'
  readonly current?: string
  readonly byId?: Readonly<Record<string, { readonly updatedAt?: number }>>
}

/** Workspace Controller face consumed by the market. */
export interface MarketWorkspaces {
  readonly list: {
    getSnapshot(): WorkspaceState
    subscribe(listener: () => void): () => void
  }
  create(input: { path: string }): Promise<{ workspaceId: WorkspaceTarget }>
  /** Legacy Client Runtime operation; split out to uiWorkspace in DSH 0.1.2. */
  connectWorkspace?(workspaceId: WorkspaceTarget): Promise<string>
  /** Legacy Client Runtime operation; split out to uiWorkspace in DSH 0.1.2. */
  pickDirectory?(): Promise<string | null>
}

/** Cross-Controller navigation introduced when the Client Runtime was split. */
export interface MarketUiWorkspace {
  connectWorkspace(workspaceId: WorkspaceTarget): Promise<string>
  pickDirectory(): Promise<string | null>
}

/** Whether the active DSH generation has received both Workspace and Session baselines. */
export function workspaceReady(state: WorkspaceState, sessions: SessionListState): boolean {
  if (state.baselinesReady !== undefined) return state.baselinesReady
  return state.phase === 'ready' && sessions.phase === 'ready'
}

/**
 * Select the same Workspace target used by DSH New Session: current first,
 * then the legacy recency projection or its equivalent derived from split Controllers.
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
  if (state.recentWorkspaceId !== undefined) return state.recentWorkspaceId

  let selected: WorkspaceTarget | undefined
  let selectedTime = Number.NEGATIVE_INFINITY
  for (const workspace of state.items) {
    let latest = Number.NEGATIVE_INFINITY
    for (const sessionId of workspace.sessionIds) {
      const updatedAt = sessions.byId?.[sessionId]?.updatedAt
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

/** Prefer the split UI service and fall back to the legacy Runtime methods. */
export function workspaceNavigation(
  workspaces: MarketWorkspaces,
  getUiWorkspace: () => MarketUiWorkspace | undefined,
): MarketUiWorkspace {
  return {
    connectWorkspace: async (workspaceId) => {
      const uiWorkspace = getUiWorkspace()
      if (uiWorkspace !== undefined) return await uiWorkspace.connectWorkspace(workspaceId)
      if (workspaces.connectWorkspace !== undefined) return await workspaces.connectWorkspace(workspaceId)
      throw new Error('the Workspace navigation service is not mounted')
    },
    pickDirectory: async () => {
      const uiWorkspace = getUiWorkspace()
      if (uiWorkspace !== undefined) return await uiWorkspace.pickDirectory()
      if (workspaces.pickDirectory !== undefined) return await workspaces.pickDirectory()
      throw new Error('the directory picker service is not mounted')
    },
  }
}
