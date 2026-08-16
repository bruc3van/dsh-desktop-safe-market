import type { MarketInstalledPackage, MarketPlugin } from '../contract.ts';
/** `@scope/name` → `name`; a bare name stays itself. */
export declare function shortName(packageName: string): string;
/**
 * Index the installed set by every key a catalog row may find it under.
 *
 * The first key is the installed manifest's `repository` field, which the
 * Host reduces to a slug. It is the only fact that reliably joins the two
 * sides, so it is preferred wherever it exists.
 *
 * The second is the package's short name against the repository name, for the
 * many plugins published from a repository of the same name but without a
 * `repository` field to prove it. It is a guess, so it is fenced twice. It is
 * used ONLY for packages that offered no slug at all — a package that named
 * its repository and named a different one is answering the question, and its
 * answer wins over the resemblance of two names — and only while the name
 * picks out ONE package: two installs sharing a short name (`@a/foo` and
 * `@b/foo`) make the guess ambiguous, and an answer that depends on iteration
 * order is worse than no answer, so the key is dropped instead.
 *
 * What survives is a guess that can still be wrong across owners: an install
 * of `foo` with no repository field marks the catalog's `someone-else/foo`.
 * The consequence stops at that badge and the verb beside it — the upgrade
 * prompt's own first step is to establish which version upstream actually
 * publishes, and to change nothing if that is not newer.
 * @param packages - the installed set as the Host reported it.
 * @returns the lookup {@link ownedBy} reads.
 */
export declare function ownedIndexOf(packages: readonly MarketInstalledPackage[]): ReadonlyMap<string, MarketInstalledPackage>;
/** The installed package a catalog row stands for, when there is one. */
export declare function ownedBy(index: ReadonlyMap<string, MarketInstalledPackage>, item: MarketPlugin): MarketInstalledPackage | undefined;
/**
 * How the upgrade prompt names what is installed: `package version`, or the
 * package alone when the version is not in a shape safe to interpolate. Both
 * halves are shape-checked — see the INVARIANT in locales.ts.
 */
export declare function describeInstalled(item: MarketInstalledPackage): string;
