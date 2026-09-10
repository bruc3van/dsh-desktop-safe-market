import type { Context } from '@deepseek-ai/cordis'
import type { PropsRuntime, PropsLocale, InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { SidebarRightTabDefinition } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { MarketSection, type MarketSectionInjected } from './MarketSection.tsx'

export const MARKET_TAB_ID = 'dsh-desktop-safe-market'
const NS = 'settings.safeMarket'

type MarketSidebarProps = PropsRuntime<'sidebar.right.pane.tab'>
  & InjectFace<MarketSectionInjected> & PropsLocale<typeof NS>

/** Reuse the market face; the tab owns dismissal after a successful hand-off. */
export function MarketSidebar({ useTabInfo, ...props }: MarketSidebarProps) {
  const { tab } = useTabInfo()
  return <div className="dsh_market_sidebar">
    <MarketSection {...props} close={() => tab.actions.close()} />
  </div>
}

function MarketIcon({ size = 24, className }: { size?: number; className?: string }) {
  return <svg width={size} height={size} className={className} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 10v10h16V10M3 10l2-6h14l2 6M3 10c0 3 4 3 4 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 4 3 4 0M9 20v-6h6v6" />
  </svg>
}

/** An optional child fiber keeps settings available without the right Sidebar. */
export function registerMarketSidebar(ctx: Context, injectMarket: () => MarketSectionInjected): void {
  ctx.inject(['sidebarRightTabs'], (sidebarCtx) => {
    const t = sidebarCtx.locale.bind(NS)
    const definition: SidebarRightTabDefinition = {
      id: MARKET_TAB_ID,
      kind: MARKET_TAB_ID,
      title: () => t('nav'),
      guide: [{ order: 60, title: () => t('nav'), description: () => t('sidebar.description'), icon: MarketIcon }],
    }
    sidebarCtx.effect(() => sidebarCtx.sidebarRightTabs.register(definition), 'safe-market: sidebar type')
    sidebarCtx.effect(() => sidebarCtx.slots.inject('sidebar.right.pane.tab', () => sidebarCtx.slots.register({
      name: 'sidebar.right.pane.tab', key: MARKET_TAB_ID, locale: NS, inject: injectMarket,
    }, MarketSidebar)), 'safe-market: sidebar body')
  })
}
