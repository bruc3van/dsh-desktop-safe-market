import type { Context } from '@deepseek-ai/cordis';
import type { PropsRuntime, PropsLocale, InjectFace } from '@deepseek-ai/dsh-client-ui-slots';
import { type MarketSectionInjected } from './MarketSection.tsx';
export declare const MARKET_TAB_ID = "dsh-desktop-safe-market";
declare const NS = "settings.safeMarket";
type MarketSidebarProps = PropsRuntime<'sidebar.right.pane.tab'> & InjectFace<MarketSectionInjected> & PropsLocale<typeof NS>;
/** Reuse the market face; the tab owns dismissal after a successful hand-off. */
export declare function MarketSidebar({ useTabInfo, ...props }: MarketSidebarProps): import("react").JSX.Element;
/** An optional child fiber keeps settings available without the right Sidebar. */
export declare function registerMarketSidebar(ctx: Context, injectMarket: () => MarketSectionInjected): void;
export {};
