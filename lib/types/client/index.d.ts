import { type ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type SafeMarketLocaleKey } from './locales.ts';
export type { MarketSectionInjected, MarketSectionProps, InstallOutcome } from './MarketSection.tsx';
export type { SafeMarketLocaleKey } from './locales.ts';
export { NO_SESSION, SESSIONS_PENDING } from './SkillsView.tsx';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The safe plugin marketplace's copy. */
        'settings.safeMarket': SafeMarketLocaleKey;
    }
}
/** Dictionary namespace owned by this plugin. */
export declare const NS = "settings.safeMarket";
/** Required services: settings seat, locale, the Remote face, and the session/composer domains. */
export declare const inject: string[];
/**
 * Compose the marketplace surface.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
