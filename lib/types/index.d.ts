/**
 * dsh-desktop-safe-market host plugin: mounts the `safeMarket` Typert Remote
 * service (the reduced community plugin catalog, the deployment's resolvable
 * skills, and the market's own durable settings) and registers its strict
 * Typert manifest. The client half ships in the same package (`./client`); the
 * web server serves it under /plugins/dsh-desktop-safe-market/client.js.
 *
 * The plugin installs nothing and runs no command. Its whole job is to put a
 * reviewed shortlist in front of the user and hand a security-review prompt —
 * naming the official install command — to a session the user then confirms.
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
/** Cordis plugin name (the Loader entry and client bundle id). */
export declare const name = "dsh-desktop-safe-market";
/**
 * Services required before load. `skills` and `storageDomain` join the
 * settings and Typert seats: the market lists what this deployment can
 * resolve, and keeps its reduction across restarts. `loader` is the installed
 * panel's live view of the entry tree its enable/disable verbs nudge.
 */
export declare const inject: string[];
export type { MarketCatalog, MarketCatalogResult, MarketCategory, MarketEnvironment, MarketPlugin, MarketSkill, MarketSkillsResult, SafeMarketSettings, } from './contract.ts';
/** Host plugin configuration, validated at load by the Loader. */
export interface Config {
    /** Base URL holding `repositories.json` and `curated.json`. */
    catalogBase: string;
    /** How many plugins the market shows. */
    marketSize: number;
    /**
     * The profile an install would change. It names the `--profile` argument in
     * the review prompt's install command; the web GUI boots the `web` profile.
     */
    profile: string;
}
/**
 * Configuration schema. Every field is deployment-varying: a fork can point
 * the market at its own curation, a smaller list suits a smaller window, and
 * a deployment booting a differently-named profile must not hand the user a
 * command aimed at someone else's.
 */
export declare const Config: z<Schemastery.ObjectS<{
    catalogBase: z<string, string>;
    marketSize: z<number, number>;
    profile: z<string, string>;
}>, Schemastery.ObjectT<{
    catalogBase: z<string, string>;
    marketSize: z<number, number>;
    profile: z<string, string>;
}>>;
/**
 * Mount the market service.
 * @param ctx - host cordis context.
 * @param config - validated plugin configuration (schema defaults applied).
 */
export declare function apply(ctx: Context, config?: Config): void;
