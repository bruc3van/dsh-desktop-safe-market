/**
 * The skills read: what this deployment can currently resolve, reduced to the
 * wire shape the market renders.
 *
 * The read is addressed by a live agent, and it has to be. The registry is
 * host+per-scope layered, and the web deployment disables the host-plane
 * `skill-filesystem` row on purpose — local discovery belongs to whichever
 * agent preset a session runs. A read from the plugin's root context would
 * therefore see the global layer alone and report "no skills" to a user who
 * has plenty; the agent is what selects the layer chain that answers.
 *
 * Incompleteness is carried through rather than hidden: a list that silently
 * lost a provider's skills would read as "you have none of those", which is a
 * different and wrong statement.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { MarketSkill, MarketSkillsResult } from './contract.ts'

/** The registry face this module needs — structural, so the plugin body owns the import. */
interface SkillRegistryFace {
  snapshot(options: { cwd?: string; signal?: AbortSignal; scope?: unknown }): Promise<{
    skills: readonly {
      name: string
      description?: string
      whenToUse?: string
      provider: string
      invocation: { modelInvocable: boolean; userInvocable: boolean }
    }[]
    complete: boolean
  }>
}

function text(value: unknown, limit: number): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.replace(/\s+/g, ' ').trim()
  // Cut by code point, not by UTF-16 unit, so a limit landing inside a
  // surrogate pair cannot leave a lone half behind.
  const points = [...trimmed]
  return points.length > limit ? `${points.slice(0, limit - 1).join('')}…` : trimmed
}

/** The addressed agent, structurally: its scope key and its workspace. */
export interface SkillReadAgent {
  readonly session: { readonly header: { readonly cwd?: string } }
}

/**
 * Read the merged skill list an agent's scope chain selects.
 * @param ctx - the plugin context carrying the skill registry.
 * @param agent - the live agent resolved from the `agentId` wire field.
 * @param signal - caller lifetime; discovery races it.
 * @returns the reduced list, whether it is complete, and any failure reason.
 */
export async function readSkills(
  ctx: Context,
  agent: SkillReadAgent,
  signal: AbortSignal,
): Promise<MarketSkillsResult> {
  const registry = (ctx as unknown as { skills?: SkillRegistryFace }).skills
  if (registry === undefined) {
    return { skills: [], complete: false, error: 'the skill registry is not mounted' }
  }
  try {
    const observation = await registry.snapshot({ cwd: agent.session.header.cwd, signal, scope: agent })
    const skills: MarketSkill[] = observation.skills.map(entry => ({
      name: text(entry.name, 120),
      description: text(entry.description, 400),
      whenToUse: text(entry.whenToUse, 400),
      provider: text(entry.provider, 60),
      modelInvocable: entry.invocation.modelInvocable,
      userInvocable: entry.invocation.userInvocable,
    }))
    skills.sort((a, b) => a.name.localeCompare(b.name))
    return { skills, complete: observation.complete, error: '' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { skills: [], complete: false, error: message === '' ? 'unknown error' : message }
  }
}
