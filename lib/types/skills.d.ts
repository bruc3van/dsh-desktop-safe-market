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
import type { Context } from '@deepseek-ai/cordis';
import type { MarketSkillsResult } from './contract.ts';
/** The addressed agent, structurally: its scope key and its workspace. */
export interface SkillReadAgent {
    readonly session: {
        readonly header: {
            readonly cwd?: string;
        };
    };
}
/**
 * Read the merged skill list an agent's scope chain selects.
 * @param ctx - the plugin context carrying the skill registry.
 * @param agent - the live agent resolved from the `agentId` wire field.
 * @param signal - caller lifetime; discovery races it.
 * @returns the reduced list, whether it is complete, and any failure reason.
 */
export declare function readSkills(ctx: Context, agent: SkillReadAgent, signal: AbortSignal): Promise<MarketSkillsResult>;
