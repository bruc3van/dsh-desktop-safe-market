import { useEffect, useState, type RefObject } from 'react'

/** Return the active list to its start without scrolling the surrounding app. */
export function BackToTop({ root, page, label }: {
  root: RefObject<HTMLDivElement>
  page: string
  label: string
}) {
  const [visible, setVisible] = useState(false)
  const activeList = () => root.current?.querySelector<HTMLElement>(
    '[role="tabpanel"]:not([hidden]) .dsh_market_results',
  )
  useEffect(() => {
    const element = root.current
    if (!element) return
    const update = () => {
      const list = activeList()
      setVisible(Boolean(list && list.scrollTop > Math.max(240, list.clientHeight * .5)))
    }
    update()
    element.addEventListener('scroll', update, true)
    const resize = new ResizeObserver(update)
    resize.observe(element)
    const list = activeList()
    if (list) resize.observe(list)
    return () => { element.removeEventListener('scroll', update, true); resize.disconnect() }
  }, [root, page])
  if (!visible) return null
  return <button type="button" className="dsh_market_backToTop" title={label} aria-label={label}
    onClick={() => {
      const list = activeList()
      if (!list) return
      root.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true })
      list.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
    }}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 4h14M12 20V8M6 14l6-6 6 6" />
    </svg>
  </button>
}
