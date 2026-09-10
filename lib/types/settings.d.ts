/**
 * The `safe-market` settings namespace: the durable enable switch the market
 * tab owns. Registered with the settings provider at plugin load; the runtime
 * reads the owner scope's live value on every call, so turning the market on
 * or off takes effect without a restart.
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { SettingsScope } from '@deepseek-ai/dsh-settings';
import type { SafeMarketSettings } from './contract.ts';
/** Namespace validated by the DSH settings provider at registration. */
export declare const SAFE_MARKET_NAMESPACE = "safe-market";
/**
 * Schemastery schema of the `safe-market` namespace section.
 *
 * `enabled` defaults to FALSE on purpose. Turning the market on is what
 * starts reaching a public snapshot on GitHub from this machine, and a
 * plugin that arrives already reaching out is a plugin that decided
 * something on the user's behalf. The tab explains itself and asks.
 */
export declare const SafeMarketSettingsSchema: z<SafeMarketSettings>;
/**
 * Register the namespace with the settings provider and return its owner scope.
 * @param ctx - the plugin context carrying the settings provider.
 * @returns the owner scope backing the runtime's live enable check.
 */
export declare function registerSafeMarketSettings(ctx: Context): SettingsScope<SafeMarketSettings>;
