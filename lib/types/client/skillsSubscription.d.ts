import type { MarketSkillsResult } from '../contract.ts';
/** Stable session identity and readiness, backed by the session list store. */
export interface SkillsSessionSource {
    getSnapshot(): string;
    subscribe(listener: () => void): () => void;
}
/** Refresh on session changes and discard responses from a superseded session. */
export declare function watchSkills(source: SkillsSessionSource, read: () => Promise<MarketSkillsResult>, observer: {
    loading(): void;
    result(value: MarketSkillsResult): void;
    error(error: unknown): void;
}): () => void;
