import type { Context } from '@deepseek-ai/cordis';
import type { MarketSkillsResult } from './contract.ts';
/** Show conventional skill roots; abbreviate verified workspace/home ancestors. */
export declare function skillDirectory(directory: string, cwd?: string, home?: string): string;
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
