/**
 * The installed-plugin manager: the host half of the market's "已安装" panel.
 *
 * It answers three verbs over the plugins a user installed into this profile
 * (shipped template layers and in-box seats that are not profile
 * dependencies are the deployment itself and never listed):
 *
 * - **list** reads the profile manifest's user bundles, joins each bundle's
 *   patch-declared entry ids against the live Loader tree, and reports the
 *   package-level enable state the panel toggles.
 * - **setEnabled** writes (or removes) `disabled: true` rows in the profile's
 *   own patch layer — the durable seat the launcher recomposes from on every
 *   boot — and then nudges the live entries directly, so the change takes
 *   effect now even on a launcher without the patch-file watcher. The two
 *   paths are idempotent against each other: whichever lands second finds no
 *   diff left to apply.
 * - **uninstall** removes the bundle from the manifest (the next boot simply
 *   never composes it), stops its entries for the rest of this session with
 *   the same disable-row mechanism — which also keeps a mid-session
 *   patch-file recompose from reviving them — and records the rows it wrote
 *   (a small file seat under the harness home, independent of the storage
 *   domain) so the next boot's {@link InstalledManager.sweep} can take them
 *   back out of the user's file once the entries they target no longer
 *   exist.
 *
 * Nothing here spawns a process or touches the network: every effect is a
 * local file edit plus an in-process Loader call.
 */
import type { Loader } from '@deepseek-ai/cordis-plugin-loader';
import type { MarketInstalledResult } from './contract.ts';
/** One uninstall the manager still has disable rows out for. */
export interface PendingUninstall {
    readonly packageName: string;
    readonly entryIds: readonly string[];
    readonly at: string;
}
/** The manager's construction facts. */
export interface InstalledManagerOptions {
    /** The profile name this Host booted (the market's `profile` config). */
    readonly profile: string;
    /** This plugin's own package name: the one row the panel must not disable. */
    readonly selfName: string;
    /** The live Loader (the `loader` service). */
    readonly loader: Loader;
    /** Harness home override; defaults to the environment's resolution. */
    readonly home?: string;
    /**
     * The pending-uninstall seat file: one small JSON array per profile under
     * the harness home (see {@link pendingFilePath}). A file, not the storage
     * domain, so the boot sweep still runs when the domain is unavailable —
     * losing the record is what strands stop rows in the user's patch file.
     */
    readonly pendingFile?: string;
}
/** The manager face the Remote service delegates to. */
export interface InstalledManager {
    list(): Promise<MarketInstalledResult>;
    setEnabled(packageName: string, enabled: boolean): Promise<MarketInstalledResult>;
    uninstall(packageName: string): Promise<MarketInstalledResult>;
    /** Take back disable rows of finished uninstalls; run once at plugin start. */
    sweep(): Promise<void>;
    /**
     * Seed the file seat from a record an older version kept in the storage
     * domain (one-time migration). The file wins when it already holds
     * records; the caller then forgets the legacy field.
     */
    adoptPending(records: readonly PendingUninstall[]): Promise<void>;
}
/**
 * The pending-uninstall seat for one profile: a small JSON file under the
 * harness home (`$DSH_HOME` or `~/.dsh`), owned by this plugin and per
 * profile — a sweep must only ever touch its own profile's rows. Profile
 * names are validated (no separators) before they reach this path.
 */
export declare function pendingFilePath(profile: string, home?: string): string;
/**
 * Create the manager over one profile directory.
 * @param options - profile identity, the live Loader, and the durable record seat.
 */
export declare function createInstalledManager(options: InstalledManagerOptions): InstalledManager;
