/**
 * The safeMarket wire contract, shared verbatim by the host manifest
 * (`ctx.typert.register` in typert.ts) and the client contribution
 * (`ctx.remote.$mount` in client/remote.ts). The service exposes the reduced
 * community catalog and the plugin's own durable settings.
 *
 * Everything that crosses this boundary is remote text from a public
 * snapshot. It is reduced and sanitized on the Host — the repository link in
 * particular is rebuilt from `owner/name` rather than carried over from the
 * snapshot — so the browser half only ever renders values this contract has
 * already fixed the shape of.
 */
import { z } from 'zod';
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol';
/**
 * The only `owner/name` shape the market keeps. The repository link is
 * rebuilt on the Host from a slug matching this pattern, and the wire codec
 * enforces the same shape, so the "host rebuilds the href" invariant is held
 * by the contract rather than by a comment.
 */
export declare const REPOSITORY_SLUG_PATTERN: RegExp;
/**
 * The only branch-name shape the review prompt may interpolate. Branches are
 * remote text from a public snapshot: anything outside this pattern (no
 * whitespace, no punctuation beyond `._/-`) could inject instructions into
 * the prompt or steer the tarball path, so the Host falls back to `main` for
 * it. The trailing checks mirror the git ref rules GitHub enforces: no `..`
 * anywhere, no segment may be `.` or end in `.`/`.lock`, and the name must
 * not end in `/` or `.`.
 */
export declare const BRANCH_PATTERN: RegExp;
/** Whether a trimmed branch name is safe to interpolate into the prompt. */
export declare function isSafeBranchName(value: string): boolean;
/** One row of the market: a community plugin the catalog kept. */
export interface MarketPlugin {
    /** `owner/name`, the catalog's identity for the entry. */
    readonly fullName: string;
    readonly owner: string;
    readonly name: string;
    /** Rebuilt from fullName on the Host — never the snapshot's own href. */
    readonly url: string;
    readonly description: string;
    readonly stars: number;
    readonly language: string;
    readonly license: string;
    /** ISO date of the last push, for the "still maintained" read. */
    readonly pushedAt: string;
    /** The repository's default branch — the install command's fallback ref. */
    readonly defaultBranch: string;
    readonly category: string;
    readonly categoryZh: string;
    readonly categoryEn: string;
}
/** One category filter, with how many of the kept rows fall under it. */
export interface MarketCategory {
    readonly key: string;
    readonly zh: string;
    readonly en: string;
    readonly count: number;
}
/** The reduced catalog the browser renders. */
export interface MarketCatalog {
    readonly items: readonly MarketPlugin[];
    readonly categories: readonly MarketCategory[];
    /** When the upstream crawl ran (the snapshot's own timestamp). */
    readonly fetchedAt: string;
    /** When this Host last read the snapshot. */
    readonly refreshedAt: string;
    /** How many repositories the crawl saw, before curation and the top cut. */
    readonly scanned: number;
}
/** A catalog read: the answer, plus whether it is the last good one. */
export interface MarketCatalogResult {
    readonly catalog: MarketCatalog | null;
    /** The catalog is a cached one; this read did not reach the snapshot. */
    readonly stale: boolean;
    /** Why the read did not reach the snapshot, when it did not. */
    readonly error: string;
}
/** One skill this deployment can currently resolve. */
export interface MarketSkill {
    readonly name: string;
    readonly description: string;
    readonly whenToUse: string;
    /** The provider that owns the skill body (`filesystem`, `runtime`, …). */
    readonly provider: string;
    /** Whether the model may invoke it on its own. */
    readonly modelInvocable: boolean;
    /** Whether the user may invoke it with `/name`. */
    readonly userInvocable: boolean;
}
/** Wire codec: one session identity (branded string on the wire). */
export declare const sessionIdSchema: z.ZodString;
/** A skills read: the answer, or the reason there is none. */
export interface MarketSkillsResult {
    readonly skills: readonly MarketSkill[];
    /** False when a provider failed or reported incomplete discovery. */
    readonly complete: boolean;
    readonly error: string;
}
/**
 * What the browser needs to name the install command. The profile is a
 * deployment fact (the Host is the only side that knows which profile it
 * boots), and the command is the official one — this plugin never runs it.
 */
export interface MarketEnvironment {
    /** The profile whose plugins an install would change. */
    readonly profile: string;
}
/** The `safe-market` settings namespace's durable shape. */
export interface SafeMarketSettings {
    /**
     * Whether the market is on. Default false: the tab explains itself and
     * asks first, because turning it on is what starts reaching GitHub.
     */
    readonly enabled: boolean;
}
/** One field update sent through the plugin-owned settings Remote. */
export type SafeMarketSettingsUpdate = {
    readonly field: 'enabled';
    readonly value: boolean;
};
/** Strict wire codec for one market row. */
export declare const marketPluginSchema: z.ZodReadonly<z.ZodObject<{
    fullName: z.ZodString;
    owner: z.ZodString;
    name: z.ZodString;
    url: z.ZodString;
    description: z.ZodString;
    stars: z.ZodNumber;
    language: z.ZodString;
    license: z.ZodString;
    pushedAt: z.ZodString;
    defaultBranch: z.ZodString;
    category: z.ZodString;
    categoryZh: z.ZodString;
    categoryEn: z.ZodString;
}, z.core.$strip>>;
/** Strict wire codec for one category filter. */
export declare const marketCategorySchema: z.ZodReadonly<z.ZodObject<{
    key: z.ZodString;
    zh: z.ZodString;
    en: z.ZodString;
    count: z.ZodNumber;
}, z.core.$strip>>;
/** Strict wire codec for the reduced catalog. */
export declare const marketCatalogSchema: z.ZodReadonly<z.ZodObject<{
    items: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
        fullName: z.ZodString;
        owner: z.ZodString;
        name: z.ZodString;
        url: z.ZodString;
        description: z.ZodString;
        stars: z.ZodNumber;
        language: z.ZodString;
        license: z.ZodString;
        pushedAt: z.ZodString;
        defaultBranch: z.ZodString;
        category: z.ZodString;
        categoryZh: z.ZodString;
        categoryEn: z.ZodString;
    }, z.core.$strip>>>>;
    categories: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
        key: z.ZodString;
        zh: z.ZodString;
        en: z.ZodString;
        count: z.ZodNumber;
    }, z.core.$strip>>>>;
    fetchedAt: z.ZodString;
    refreshedAt: z.ZodString;
    scanned: z.ZodNumber;
}, z.core.$strip>>;
/** Strict wire codec for one catalog read. */
export declare const marketCatalogResultSchema: z.ZodReadonly<z.ZodObject<{
    catalog: z.ZodUnion<readonly [z.ZodReadonly<z.ZodObject<{
        items: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
            fullName: z.ZodString;
            owner: z.ZodString;
            name: z.ZodString;
            url: z.ZodString;
            description: z.ZodString;
            stars: z.ZodNumber;
            language: z.ZodString;
            license: z.ZodString;
            pushedAt: z.ZodString;
            defaultBranch: z.ZodString;
            category: z.ZodString;
            categoryZh: z.ZodString;
            categoryEn: z.ZodString;
        }, z.core.$strip>>>>;
        categories: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
            key: z.ZodString;
            zh: z.ZodString;
            en: z.ZodString;
            count: z.ZodNumber;
        }, z.core.$strip>>>>;
        fetchedAt: z.ZodString;
        refreshedAt: z.ZodString;
        scanned: z.ZodNumber;
    }, z.core.$strip>>, z.ZodNull]>;
    stale: z.ZodBoolean;
    error: z.ZodString;
}, z.core.$strip>>;
/** Strict wire codec for one resolvable skill. */
export declare const marketSkillSchema: z.ZodReadonly<z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    whenToUse: z.ZodString;
    provider: z.ZodString;
    modelInvocable: z.ZodBoolean;
    userInvocable: z.ZodBoolean;
}, z.core.$strip>>;
/** Strict wire codec for one skills read. */
export declare const marketSkillsResultSchema: z.ZodReadonly<z.ZodObject<{
    skills: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        whenToUse: z.ZodString;
        provider: z.ZodString;
        modelInvocable: z.ZodBoolean;
        userInvocable: z.ZodBoolean;
    }, z.core.$strip>>>>;
    complete: z.ZodBoolean;
    error: z.ZodString;
}, z.core.$strip>>;
/** Strict wire codec for the deployment facts the browser needs. */
export declare const marketEnvironmentSchema: z.ZodReadonly<z.ZodObject<{
    profile: z.ZodString;
}, z.core.$strip>>;
/** Strict wire codec for the resolved settings section. */
export declare const safeMarketSettingsSchema: z.ZodReadonly<z.ZodObject<{
    enabled: z.ZodBoolean;
}, z.core.$strip>>;
/** Strict wire codec for one field update. */
export declare const safeMarketSettingsUpdateSchema: z.ZodDiscriminatedUnion<[z.ZodReadonly<z.ZodObject<{
    field: z.ZodLiteral<"enabled">;
    value: z.ZodBoolean;
}, z.core.$strip>>], "field">;
/** The safeMarket Remote namespace's strict invocation descriptors. */
export declare const SAFE_MARKET_INVOCATIONS: readonly InvocationDescriptor[];
