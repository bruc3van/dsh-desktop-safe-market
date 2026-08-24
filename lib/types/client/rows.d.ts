/**
 * The row rules: which catalog rows a filter keeps, and what an installed
 * row's badge says.
 *
 * A plain module for the same reason {@link ../client/owned.ts | owned.ts} is
 * one — these are decisions, not rendering, and `node --test` cannot import a
 * `.tsx` at all (it strips types but does not transform JSX). Logic that lives
 * beside the markup is logic that can only be checked through a React tree, so
 * it lives here and the section imports it.
 */
import type { MarketInstalledPackage, MarketPlugin, MarketSkill } from '../contract.ts';
/**
 * The category chip that selects the installed set instead of a catalog
 * category. The catalog's own keys are slugs from the shortlist, so a value
 * carrying a colon cannot collide with one.
 */
export declare const INSTALLED_FILTER = "dsh:installed";
/**
 * The card-state key the header's self-upgrade runs under.
 *
 * NOT `SELF_MARKET_PLUGIN.fullName`: this market is itself a dsh plugin, so
 * the catalog may well carry a row for the same repository — and a shared key
 * would make the header button and that card report each other's progress.
 * A colon cannot appear in a catalog key (they are `owner/name` slugs).
 */
export declare const SELF_CARD_KEY = "dsh:self";
/** Card-state key for an update launched from the installed-package view. */
export declare function installedUpdateCardKey(packageName: string): string;
/**
 * The market's own fixed repository identity. Unlike catalog rows this is
 * package-owned source, not remote snapshot text; keeping the complete
 * MarketPlugin shape lets the header use the exact same hand-off as a card.
 */
export declare const SELF_MARKET_PLUGIN: MarketPlugin;
/** `1998` → `2.0k`: a card has room for the magnitude, not the digits. */
export declare function starCount(stars: number): string;
/** Whether one row survives the current query and category filter. */
export declare function matches(item: MarketPlugin, query: string, category: string, english: boolean): boolean;
/** Whether one skill survives the current query. */
export declare function matchesSkill(skill: MarketSkill, query: string): boolean;
/** The status a package row shows, from its own live facts. */
export declare function stateOf(item: MarketInstalledPackage): 'readFailed' | 'unregistered' | 'disabled' | 'failed' | 'running' | 'installed';
