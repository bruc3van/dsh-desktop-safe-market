/** Environment variable overriding the default harness home. */
export declare const DSH_HOME_ENV = "DSH_HOME";
/** Directory under the harness home holding every profile. */
export declare const PROFILES_DIR = "profiles";
/** The user patch layer inside a profile directory. */
export declare const PROFILE_PATCH_FILENAME = "cordis.patch.yml";
/**
 * Bundle layers every shipped profile template carries. Anything else in
 * `dsh.profile.bundles` arrived by user install (`dsh plugin add`), which is
 * the set the manager lists and may edit; the shipped layers are the
 * deployment itself and stay out of it.
 */
export declare const SHIPPED_BUNDLES: ReadonlySet<string>;
/** Resolve the harness home: `$DSH_HOME`, then `~/.dsh`. */
export declare function resolveDshHome(env?: NodeJS.ProcessEnv): string;
/**
 * Resolve a profile's directory. The name rules (and the `node_modules`
 * exclusion, the launcher's flat fallback path) mirror the harness's own
 * `resolveProfileDir`, so a profile the launcher accepts resolves identically
 * here.
 */
export declare function resolveProfileDir(name: string, home?: string): string;
/** One entry row inside a patch's `insert` list. */
export interface PatchInsertRow {
    id?: string;
    name?: string;
    group?: boolean | null;
    config?: unknown;
    [key: string]: unknown;
}
/** One row of a patch list: an `insert` list, or an id-targeted override. */
export interface PatchRow {
    id?: string;
    insert?: PatchInsertRow[];
    [key: string]: unknown;
}
/** The profile manifest's slices the manager reads and edits. */
export type ProfileManifest = Record<string, unknown> & {
    dependencies?: Record<string, string>;
    dsh?: {
        bundle?: {
            patch?: string;
        };
        profile?: {
            bundles?: string[];
        };
    };
};
/** Read and parse the profile manifest. */
export declare function readManifest(profileDir: string): Promise<ProfileManifest>;
/** Write the manifest back (2-space JSON, trailing newline, atomic). */
export declare function writeManifest(profileDir: string, manifest: ProfileManifest): Promise<void>;
/** The bundles a user installed (the shipped template layers excluded). */
export declare function userBundles(manifest: ProfileManifest): string[];
/**
 * Remove one bundle from the manifest: its dependency entry and its
 * `dsh.profile.bundles` seat, the exact two facts the next boot's composition
 * and the CLI's reconcile read. Leftover files under `node_modules` become
 * inert the moment the layer is gone and are pruned by the next
 * `dsh plugin` command's pnpm run.
 * @returns true when the manifest changed.
 */
export declare function removeBundle(manifest: ProfileManifest, packageName: string): boolean;
/** Parse a patch-list file (a missing file is an empty list, per the launcher's own rule). */
export declare function readPatchList(file: string): Promise<PatchRow[]>;
/**
 * The loader entry rows a patch list introduces, in patch-addressable form:
 * top-level inserts, group children (a group row itself is always enabled and
 * never listed, but its children are real entries), and rows inserted into a
 * group another layer declared. These ids are what `{ id, disabled: true }`
 * override rows target.
 */
export declare function collectEntryRows(patches: readonly PatchRow[]): {
    id: string;
    name: string;
}[];
/**
 * Resolve a package's root directory from the profile anchor: Node's own
 * node_modules lookup order (the profile's `node_modules` first, then the
 * launcher's healed `profiles/node_modules` fallback on the parent walk), so
 * the result matches what the Loader imports.
 */
export declare function packageDirFromProfile(profileDir: string, packageName: string): string | undefined;
/** One installed bundle's display facts plus the entry ids it introduces. */
export interface BundleInfo {
    version: string;
    description: string;
    entries: {
        id: string;
        name: string;
    }[];
}
/** Read one installed bundle: its manifest display facts and its patch's entry rows. */
export declare function readBundleInfo(profileDir: string, packageName: string): Promise<BundleInfo>;
/**
 * Set or clear this manager's disable rows for the given entry ids in the
 * profile's user patch layer — the edit every enable/disable/uninstall funnel
 * through. Disable appends `- id: <id>` / `disabled: true` rows (skipping ids
 * already carrying one); enable removes exactly the rows this manager writes,
 * never a hand-written override (more keys, a `!!js` expression, a config
 * override), which keeps its own shape. The document round-trips through the
 * yaml CST, so comments and untouched rows keep their original text; the
 * launcher recomposes the tree on the save, which is what makes the edit live.
 * @returns true when the file changed.
 */
export declare function setEntryDisabled(file: string, ids: readonly string[], disabled: boolean): Promise<boolean>;
